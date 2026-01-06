# 🔌 FLUJO DE SINCRONIZACIÓN OFFLINE — Análisis Profundo

> **Documento:** Análisis del sistema offline-first y sincronización  
> **Fecha:** Enero 2026  
> **Estado:** Análisis pre-implementación

---

## 📋 ÍNDICE

1. [Arquitectura Actual](#arquitectura-actual)
2. [Flujo de Sincronización](#flujo-de-sincronización)
3. [Escenarios Reales](#escenarios-reales)
4. [Problemas Detectados](#problemas-detectados)
5. [Soluciones Propuestas](#soluciones-propuestas)

---

## ARQUITECTURA ACTUAL

### Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         TERMINAL                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   UI/React  │───>│ POSActions  │───>│  IndexedDB  │         │
│  └─────────────┘    └─────────────┘    │   (Dexie)   │         │
│                                         └──────┬──────┘         │
│                                                │                │
│                                         ┌──────▼──────┐         │
│                                         │ SyncClient  │         │
│                                         └──────┬──────┘         │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                    ┌────────────┼────────────┐
                                    │   INTERNET │            │
                                    └────────────┼────────────┘
                                                 │
┌────────────────────────────────────────────────▼────────────────┐
│                         SERVIDOR                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ /api/ingest │───>│  Prisma TX  │───>│ PostgreSQL  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                      │                │
│         │           ┌─────────────┐            │                │
│         └──────────>│  EventBus   │<───────────┘                │
│                     └──────┬──────┘                             │
│                            │                                    │
│                     ┌──────▼──────┐                             │
│                     │  SSE Stream │                             │
│                     └─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
1. ESCRITURA LOCAL
   Usuario acción → POSActions → appendEvent() → IndexedDB (synced=0)

2. SINCRONIZACIÓN
   SyncClient.syncNow() → fetch(/api/ingest) → PostgreSQL
   
3. CONFIRMACIÓN
   Servidor responde acked_through_terminal_sequence
   → IndexedDB marca synced=1

4. PROPAGACIÓN (SSE)
   Servidor → EventBus.publish() → SSE → Otros terminales
   → IndexedDB de otros terminales
```

### Tablas IndexedDB (Dexie)

```typescript
// schema.ts
events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], 
         &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at'

sync_state: 'id'  // singleton con estado de sync

projections: 'key'  // cache de proyecciones

catalog_items: 'id, product_id, name'
```

### SyncClient - Configuración

```typescript
{
  endpoint: "/api/events/ingest",
  batchSize: 200,           // Eventos por request
  tickMs: 5000,             // Intervalo de sync (5 seg)
  maxBackoffMs: 60000,      // Máximo backoff (1 min)
  minBackoffMs: 1000,       // Mínimo backoff (1 seg)
  jitterRatio: 0.2          // 20% variación
}
```

---

## FLUJO DE SINCRONIZACIÓN

### Flujo Normal (Online)

```
TERMINAL                           SERVIDOR
   │                                  │
   │  1. Usuario agrega item          │
   │  ────────────────────────>       │
   │  (IndexedDB: synced=0)           │
   │                                  │
   │  2. SyncClient detecta pending   │
   │  ────────────────────────>       │
   │  POST /api/ingest                │
   │  {events: [...], to_seq: 5}      │
   │                                  │
   │                                  │  3. Servidor guarda en PostgreSQL
   │                                  │  4. Servidor proyecta
   │                                  │  5. Servidor publica a EventBus
   │                                  │
   │  <────────────────────────       │
   │  {accepted: true, acked: 5}      │
   │                                  │
   │  6. IndexedDB: synced=1          │
   │                                  │
   │  <════════════════════════       │
   │  SSE: evento para otros          │
   │                                  │
```

### Flujo Offline

```
TERMINAL                           SERVIDOR
   │                                  │
   │  1. Usuario agrega item          │
   │  (IndexedDB: synced=0)           │
   │                                  │
   │  2. SyncClient intenta sync      │
   │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ X        │  (Sin conexión)
   │                                  │
   │  3. Backoff exponencial          │
   │  (1s, 2s, 4s, 8s... max 60s)     │
   │                                  │
   │  ... Usuario sigue trabajando    │
   │  (IndexedDB acumula eventos)     │
   │                                  │
   │  4. Conexión restaurada          │
   │  ────────────────────────>       │
   │  POST /api/ingest                │
   │  {events: [10 eventos], to: 15}  │
   │                                  │
   │  <────────────────────────       │
   │  {accepted: true, acked: 15}     │
   │                                  │
```

### Flujo de Recepción SSE

```
TERMINAL A                         SERVIDOR                      TERMINAL B
   │                                  │                              │
   │  POST evento                     │                              │
   │  ────────────────────────>       │                              │
   │                                  │                              │
   │                                  │  EventBus.publish()          │
   │                                  │  ════════════════════>       │
   │                                  │  SSE: nuevo evento           │
   │                                  │                              │
   │                                  │                              │  handleIncomingEvent()
   │                                  │                              │  → IndexedDB.add()
   │                                  │                              │  → useLiveQuery detecta
   │                                  │                              │  → UI se actualiza
```

---

## ESCENARIOS REALES

### ESCENARIO O1: Corte de Luz Durante Venta

```
SITUACIÓN:
- Cajero tiene orden #045 con 3 items (S/ 58)
- Cliente entrega S/ 60 en efectivo
- Cajero presiona "Cobrar"
- SE VA LA LUZ

ESTADO EN ESE MOMENTO:
- IndexedDB tiene:
  - ORDER_CREATED (synced=1, ya subió)
  - ORDER_ITEM_ADDED x3 (synced=1)
  - CHECK_PAYMENT_ADDED (synced=0, NO subió)
  
CUANDO REGRESA LA LUZ:
1. Sistema se reinicia
2. SyncClient.start() se ejecuta
3. Detecta 1 evento con synced=0
4. Envía CHECK_PAYMENT_ADDED al servidor
5. Servidor lo procesa
6. Orden queda pagada

ESTADO ACTUAL: ✅ FUNCIONA
- Evento pendiente se sincroniza al reconectar
- No se pierde el pago

PROBLEMA:
- UI no muestra "Pago pendiente de sincronizar"
- Cajero no sabe si el pago se registró
- orderNumberCounter se reinicia (colisión)
```

### ESCENARIO O2: Trabajo Offline Prolongado (2 horas)

```
SITUACIÓN:
- Internet se cae a las 12:00
- Pollería sigue operando
- 50 órdenes en 2 horas
- Internet regresa a las 14:00

EVENTOS ACUMULADOS:
- 50 ORDER_CREATED
- 150 ORDER_ITEM_ADDED
- 50 CHECK_PAYMENT_ADDED
- 50 CHECK_MARKED_PAID
- 50 INVOICE_ISSUED
- 2 CASH_ADJUSTED
TOTAL: ~350 eventos

CUANDO REGRESA INTERNET:
1. SyncClient detecta 350 eventos pendientes
2. Envía en batches de 200
3. Batch 1: eventos 1-200 → OK
4. Batch 2: eventos 201-350 → OK
5. Todo sincronizado en ~10 segundos

ESTADO ACTUAL: ✅ FUNCIONA (en teoría)

PROBLEMAS POTENCIALES:
1. Order numbers: 50 órdenes con números que pueden colisionar
2. Timestamps: occurred_at del cliente vs servidor
3. Memoria: 350 eventos en IndexedDB
4. UI: No hay indicador de "350 pendientes"
```

### ESCENARIO O3: Dos Terminales Modifican Misma Orden

```
SITUACIÓN:
- Mesa 5 tiene orden #067 abierta
- Terminal Mesero 1: Agrega "Ensalada" (offline)
- Terminal Mesero 2: Agrega "Gaseosa" (offline)
- Ambos sincronizan al mismo tiempo

SECUENCIA DE EVENTOS:
Terminal 1:                    Terminal 2:
seq=100: ITEM_ADDED(Ensalada)  seq=100: ITEM_ADDED(Gaseosa)

CUANDO SINCRONIZAN:
- Ambos envían seq=100
- Servidor recibe dos eventos con mismo terminal_sequence
- ¿Cuál gana?

ESTADO ACTUAL: ❌ CONFLICTO NO MANEJADO

PROBLEMA:
- terminal_sequence es por terminal, no global
- Dos terminales pueden tener seq=100
- Servidor no tiene forma de ordenar
- Resultado impredecible
```

### ESCENARIO O4: Terminal Offline Recibe Evento de Otro

```
SITUACIÓN:
- Terminal Caja está online
- Terminal Mesero está offline
- Caja cierra orden #067
- Mesero intenta agregar item a #067

SECUENCIA:
1. Caja: INVOICE_ISSUED(#067) → Servidor → SSE
2. Mesero (offline): No recibe SSE
3. Mesero: ITEM_ADDED(#067) → IndexedDB local
4. Mesero reconecta
5. Mesero envía ITEM_ADDED(#067)
6. Servidor: ¿Orden ya cerrada, qué hacer?

ESTADO ACTUAL: ❌ NO MANEJADO

PROBLEMA:
- Servidor acepta el evento (no valida estado)
- Orden cerrada tiene item agregado después
- Inconsistencia de datos
```

### ESCENARIO O5: Sincronización Parcial (Falla a Mitad)

```
SITUACIÓN:
- Terminal tiene 300 eventos pendientes
- Envía batch 1 (200 eventos) → OK
- Conexión se pierde
- Batch 2 (100 eventos) no se envía

ESTADO:
- Servidor: tiene eventos 1-200
- Terminal: tiene eventos 1-300, pero 1-200 marcados synced=1

CUANDO RECONECTA:
1. SyncClient busca synced=0
2. Encuentra eventos 201-300
3. Envía batch con from_seq=201, to_seq=300
4. Servidor recibe y procesa

ESTADO ACTUAL: ✅ FUNCIONA
- El sistema maneja esto correctamente
- Eventos se envían en orden por terminal_sequence
```

### ESCENARIO O6: IndexedDB Lleno

```
SITUACIÓN:
- Terminal operando 6 meses
- 50,000 eventos en IndexedDB
- Navegador empieza a fallar

SÍNTOMAS:
- UI lenta
- Queries de proyección tardan segundos
- useLiveQuery causa re-renders constantes

ESTADO ACTUAL: ❌ NO HAY CLEANUP

PROBLEMA:
- No hay límite de eventos en IndexedDB
- No hay cleanup automático
- No hay compactación/snapshots
```

### ESCENARIO O7: Evento Duplicado por Retry

```
SITUACIÓN:
- Terminal envía batch de eventos
- Servidor procesa y guarda
- Respuesta se pierde (timeout de red)
- Terminal no recibe ACK
- Terminal reenvía el mismo batch

SECUENCIA:
1. POST {events: [A, B, C]} → Servidor guarda
2. Timeout, terminal no recibe respuesta
3. Terminal reintenta
4. POST {events: [A, B, C]} → Servidor recibe duplicados

ESTADO ACTUAL: ⚠️ PARCIALMENTE MANEJADO

MANEJO ACTUAL:
- Servidor usa event_id como PK
- INSERT falla con P2002 (unique constraint)
- Servidor marca como "deduped"
- Responde OK

PROBLEMA:
- Proyección puede haberse ejecutado antes del error
- Si proyección no es idempotente, datos duplicados
```

---

## PROBLEMAS DETECTADOS

### Críticos 🔴

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 1 | Sin conflict resolution | Datos inconsistentes | - |
| 2 | Sin validación de estado en servidor | Eventos inválidos aceptados | ingest/route.ts |
| 3 | Proyecciones no idempotentes | Totales duplicados | ingest/route.ts |
| 4 | Sin cleanup de IndexedDB | Performance degrada | schema.ts |

### Importantes 🟡

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 5 | Sin indicador de pendientes en UI | UX confusa | page.tsx |
| 6 | tenant_id hardcodeado en SSE | Multi-tenant roto | client.ts:67 |
| 7 | Sin retry en SSE | Eventos perdidos | client.ts |
| 8 | Sin orden global de eventos | Replay inconsistente | - |

### Menores 🟢

| # | Problema | Impacto | Código |
|---|----------|---------|--------|
| 9 | Backoff no persiste | Retry agresivo post-refresh | client.ts |
| 10 | Sin métricas de sync | Debugging difícil | - |

---

## ANÁLISIS DE CÓDIGO

### SyncClient - Puntos Fuertes

```typescript
// ✅ Backoff exponencial con jitter
function nextBackoff(attempt: number, minMs: number, maxMs: number) {
  const raw = minMs * Math.pow(2, Math.min(attempt, 10));
  return Math.min(raw, maxMs);
}

// ✅ Batches contiguos (evita huecos)
const contiguous: ParkEvent[] = [pending[0]!];
for (let i = 1; i < pending.length; i++) {
  const prev = Number(contiguous[contiguous.length - 1]!.terminal_sequence);
  const cur = Number(pending[i]!.terminal_sequence);
  if (cur !== prev + 1) break;  // Para si hay hueco
  contiguous.push(pending[i]!);
}

// ✅ Listener de online/offline
window.addEventListener("online", this.onOnlineBound);
```

### SyncClient - Problemas

```typescript
// ❌ tenant_id hardcodeado
const tenantId = "00000000-0000-0000-0000-000000000001";
this.eventSource = new EventSource(`/api/events/stream?tenant_id=${tenantId}`);

// ❌ Sin manejo de SSE reconexión manual
this.eventSource.onerror = (e) => {
  console.warn("[Sync] SSE Connection lost, browser will retry...", e);
  // Browser auto-reconnects, pero no hay lógica de fallback
};

// ❌ handleIncomingEvent no valida schema
private async handleIncomingEvent(event: ParkEvent) {
  // Asume que event es válido, no valida con Zod
  await db.events.add({...event, synced: 1});
}
```

### Ingest API - Problemas

```typescript
// ❌ Proyección dentro de transacción pero no idempotente
await prisma.$transaction(async (tx) => {
  for (const ev of events) {
    await tx.event.create({...});  // Puede fallar con P2002
    await projectEvent(tx, ev);     // Se ejecuta aunque sea duplicado
  }
});

// ❌ projectEvent no verifica si ya se proyectó
async function projectEvent(tx, event) {
  switch (event_type) {
    case "ORDER_ITEM_ADDED": {
      // Suma al total sin verificar si ya se sumó
      await tx.order.update({
        data: {
          subtotal_cents: order.subtotal_cents + lineCents,  // ¡Puede duplicar!
        }
      });
    }
  }
}
```

---

## SOLUCIONES PROPUESTAS

### Solución 1: Idempotencia en Proyecciones

Ver `IMPLEMENTACION_PASO_A_PASO.md` Fase 1.

```typescript
// Antes de proyectar, verificar si ya se procesó
const alreadyProcessed = await tx.processedEvent.findUnique({
  where: { event_id: event.event_id }
});
if (alreadyProcessed) return; // Skip
```

### Solución 2: Validación de Estado en Servidor

```typescript
// Antes de aceptar ORDER_ITEM_ADDED
case "ORDER_ITEM_ADDED": {
  const order = await tx.order.findUnique({where: {id: payload.order_id}});
  
  if (!order) {
    return reject("ORDER_NOT_FOUND");
  }
  
  if (order.order_status === "CLOSED" || order.order_status === "CANCELLED") {
    return reject("ORDER_ALREADY_CLOSED");
  }
  
  // Ahora sí procesar
}
```

### Solución 3: Conflict Resolution con Vector Clocks

```typescript
// Cada terminal mantiene su propio contador
// Evento incluye vector clock
{
  event_id: "...",
  vector_clock: {
    "term_1": 100,
    "term_2": 50,
    "term_3": 75
  }
}

// Servidor puede ordenar eventos globalmente
// y detectar conflictos (eventos concurrentes)
```

### Solución 4: Cleanup de IndexedDB

```typescript
// Ejecutar diariamente o al iniciar
async function cleanupOldEvents() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30 días
  
  await db.events
    .where('occurred_at')
    .below(cutoff.toISOString())
    .and(e => e.synced === 1) // Solo los ya sincronizados
    .delete();
}
```

### Solución 5: Indicador de Sync en UI

```typescript
// Componente de estado de sync
function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await db.events.where('synced').equals(0).count();
      setPending(count);
      
      const state = await db.sync_state.get('singleton');
      setLastSync(state?.last_sync_ok_at ? new Date(state.last_sync_ok_at) : null);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={pending > 0 ? 'text-yellow-500' : 'text-green-500'}>
      {pending > 0 ? `${pending} pendientes` : 'Sincronizado'}
      {lastSync && <span>Último: {formatRelative(lastSync)}</span>}
    </div>
  );
}
```

---

## MATRIZ DE RIESGOS OFFLINE

| Escenario | Probabilidad | Impacto | Mitigación |
|-----------|--------------|---------|------------|
| Corte de luz | Alta | Medio | ✅ Eventos persisten |
| Offline 2+ horas | Media | Alto | ⚠️ Order numbers |
| Conflicto entre terminales | Media | Alto | ❌ Sin resolver |
| IndexedDB lleno | Baja | Alto | ❌ Sin cleanup |
| Evento duplicado | Media | Alto | ⚠️ Parcial |
| SSE desconectado | Alta | Medio | ⚠️ Auto-reconnect |

---

## PRIORIDADES DE IMPLEMENTACIÓN

| # | Tarea | Impacto | Esfuerzo | Prioridad |
|---|-------|---------|----------|-----------|
| 1 | Idempotencia proyecciones | Alto | 4h | 🔴 P0 |
| 2 | Validación estado servidor | Alto | 4h | 🔴 P0 |
| 3 | Cleanup IndexedDB | Medio | 2h | 🟡 P1 |
| 4 | UI indicador sync | Medio | 2h | 🟡 P1 |
| 5 | Conflict resolution | Alto | 16h | 🟡 P1 |
| 6 | Vector clocks | Alto | 24h | 🟢 P2 |

---

**Documento creado:** Enero 2026
