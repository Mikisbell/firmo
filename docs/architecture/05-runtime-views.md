# 5. Vistas de Runtime

> Cómo se comporta el sistema en escenarios clave.

## Escenario 1: Venta Normal (Happy Path)

```
Cajero          POS (Browser)      Dexie       SyncClient    API Ingest     PostgreSQL    KDS (Cocina)
  │                │                 │              │              │              │              │
  ├─ Abre turno ──▶│                 │              │              │              │              │
  │                ├─ SHIFT_OPENED ─▶│              │              │              │              │
  │                │                 │──synced=0───▶│              │              │              │
  │                │                 │              ├─ POST ──────▶│              │              │
  │                │                 │              │              ├─$transaction▶│              │
  │                │                 │              │              │  event+proj  │              │
  │                │                 │              │              ├─ outbox ────▶│              │
  │                │                 │              │              │              │              │
  │                │                 │              │              ├─ NOTIFY ─────┼─────────────▶│
  │                │                 │              │◀─ 200 ───────│              │              │
  │                │                 │◀─synced=1────│              │              │              │
  │                │                 │              │              │              │              │
  ├─ Toma orden ──▶│                 │              │              │              │              │
  │                ├─ ORDER_CREATED ▶│              │              │              │              │
  │                ├─ ITEM_ADDED ───▶│   (batch)    │              │              │              │
  │                ├─ ITEM_ADDED ───▶│─────────────▶│              │              │              │
  │                ├─ ORDER_SUBMIT ─▶│              ├─ POST batch─▶│              │              │
  │                │                 │              │              ├─$transaction▶│              │
  │                │                 │              │              │  (per event) │              │
  │                │                 │              │              ├─ NOTIFY ────▶│──────SSE───▶│
  │                │                 │              │              │              │         ┌───┤
  │                │                 │              │              │              │         │ Shows
  │                │                 │              │              │              │         │ ticket
  │                │                 │              │              │              │         └───┘
  ├─ Cobra ───────▶│                 │              │              │              │              │
  │                ├─ CHECK_CREATED ▶│              │              │              │              │
  │                ├─ PAYMENT_ADD ──▶│              │              │              │              │
  │                ├─ CHECK_PAID ───▶│─────────────▶│──────POST──▶│──$txn──────▶│              │
  │                │                 │              │              │              │              │
  │                ├─ Print receipt  │              │              │              │              │
  │                │  (ESC/POS)      │              │              │              │              │
```

### Transacción de Ingest (Detalle)

```
prisma.$transaction(async (tx) => {
  1. markAsProcessed(tx, event)      // Dedup: INSERT en processed_events
  2. validateEvent(tx, event)        // Reglas de negocio
  3. checkDependencies(tx, event)    // ¿Faltan eventos previos?
  4. detectAndResolveConflict(tx)    // Revisión OCC
  5. tx.events.create(event)         // APPEND al event store
  6. projectEvent(tx, event)         // UPDATE tabla de projections (orders, shifts, etc.)
  7. tx.orders.update({ revision++ })// Incrementar revisión OCC
  8. tx.event_outbox.create(outbox)  // Outbox para pub/sub
}, {
  isolationLevel: RepeatableRead,
  timeout: 30000
})

// DESPUÉS del commit:
eventBus.publish(event)              // LISTEN/NOTIFY → SSE → otros terminales
```

## Escenario 2: Venta Offline → Reconexión

```
Cajero          POS (Browser)      Dexie       SyncClient    API Ingest
  │                │                 │              │              │
  │          ┌─ INTERNET CAE ─────────────────────────────────────┐
  │          │     │                 │              │              │
  ├─ Vende ─▶│    │                 │              │              │
  │          │    ├─ ORDER_CREATED ─▶│              │              │
  │          │    ├─ ITEM_ADDED ────▶│              │              │
  │          │    ├─ CHECK_PAID ────▶│              │              │
  │          │    │                  │──synced=0───▶│              │
  │          │    │                  │              ├─ POST ──X    │
  │          │    │                  │              │  FAIL        │
  │          │    │                  │              ├─ Retry 1 ─X  │
  │          │    │                  │              ├─ Retry 2 ─X  │
  │          │    │                  │              ├─ Circuit     │
  │          │    │                  │              │  OPEN (60s)  │
  │          │    │                  │              │              │
  ├─ Vende ─▶│   (sigue offline)    │              │              │
  │          │    ├─ más eventos ───▶│              │              │
  │          │    │                  │  (acumula    │              │
  │          │    │                  │   en outbox) │              │
  │          │     │                 │              │              │
  │          └─ INTERNET REGRESA ──────────────────────────────────┘
  │                │                 │              │              │
  │                │                 │              ├─ HALF_OPEN   │
  │                │                 │              ├─ Probe ─────▶│
  │                │                 │              │◀─ 200 ───────│
  │                │                 │              ├─ CLOSED      │
  │                │                 │              │              │
  │                │                 │──flush all──▶│              │
  │                │                 │  (en orden)  ├─ Batch POST─▶│
  │                │                 │              │              ├─ $txn
  │                │                 │              │              │  (dedup
  │                │                 │              │              │   protects
  │                │                 │              │              │   against
  │                │                 │              │              │   replays)
  │                │                 │◀─synced=1────│◀─ 200 ───────│
```

## Escenario 3: Conflicto entre Terminales

```
Terminal A (offline)     Terminal B (online)     API Ingest         Conflict Resolver
  │                        │                      │                     │
  ├─ ITEM_ADDED (rev=5) ──▶│(Dexie)              │                     │
  │                        ├─ ITEM_STATUS_CHANGED▶│                     │
  │                        │  (PENDING→COOKING)   ├─ $txn ────────────▶│
  │                        │  rev=5               │  rev actual = 5     │
  │                        │                      │  expected = 5       │
  │                        │                      │  → NO CONFLICT     │
  │                        │                      │  → rev = 6         │
  │                        │                      │                     │
  │ (Internet regresa)     │                      │                     │
  ├─ SYNC ITEM_ADDED ─────────────────────────────▶│                     │
  │  rev_esperada=5        │                      ├─ $txn ────────────▶│
  │                        │                      │  rev actual = 6     │
  │                        │                      │  expected = 5       │
  │                        │                      │  → CONFLICT!       │
  │                        │                      │                     │
  │                        │                      │  Tipo: ITEM_ADDED  │
  │                        │                      │  → Strategy: MERGE │
  │                        │                      │  → shouldApply:true│
  │                        │                      │  → conflict_log    │
  │                        │                      │  → rev = 7         │
```

### Estrategias de Resolución por Tipo

| Tipo de Evento | Estrategia | Resultado |
|----------------|-----------|-----------|
| `ORDER_ITEM_ADDED`, `CHECK_CREATED`, `CHECK_ITEMS_UPDATED` | **MERGE** | Aplicar siempre, log conflicto |
| `ORDER_ITEM_STATUS_CHANGED`, otros | **LWW** (Last-Write-Wins) | Aplicar incoming, log conflicto |
| `CHECK_PAYMENT_ADDED`, `CHECK_MARKED_PAID` | **REJECT** | Rechazar, requiere retry manual |

## Escenario 4: Pedido desde Plataforma Externa

```
PedidosYa        Webhook Handler          Adapter        Platform Service    Event Ingest
  │                    │                     │                  │                │
  ├─ POST /webhooks/──▶│                     │                  │                │
  │  pedidosya         │                     │                  │                │
  │  ?tenant_id=xxx    ├─ verify HMAC ──────▶│                  │                │
  │  x-signature: xxx  │  SHA256(body,secret)│                  │                │
  │                    │                     │                  │                │
  │                    ├─ normalize ────────▶│                  │                │
  │                    │  soles→centavos     │                  │                │
  │                    │  Spanish fields     │                  │                │
  │                    │                     ├─ create order ──▶│                │
  │                    │                     │                  ├─ emit events ─▶│
  │                    │                     │                  │  PLATFORM_ORDER │
  │                    │                     │                  │  _RECEIVED      │
  │                    │                     │                  │                │
  │                    │                     │                  ├─ auto-accept? ─▶│
  │                    │                     │                  │  (config)       │
  │◀─ 200 ────────────│                     │                  │                │
  │                    │                     │                  │                │
  │ (later)            │                     │                  │                │
  │◀─ PUT /status ─────┼─────────────────────┼──────────────────│                │
  │   "COOKING"        │                     │                  │                │
```
