# PARK — Contexto Global (Fuente de Verdad)

> **Fecha:** 2025-12-30  
> **Perfil:** 1 caja (Device-SoT) + Vercel-only (Next.js) + Offline-First

---

## 0) Objetivo

Construir **PARK**: un sistema de caja ultra rápido y offline-first para 1 sola caja.  
La venta se confirma localmente (sin depender de internet) y se sincroniza después a la nube.

---

## 1) Alcance MVP (P0)

- PWA (Next.js) instalable para operación de caja.
- Event Log local append-only en IndexedDB (Dexie).
- Proyecciones locales (read models):
  - **SaleProjection:** venta actual / historial básico
  - **ShiftProjection:** apertura, movimientos, cierre explicable
- Efectivo offline siempre.
- Sync batch a Vercel con idempotencia y ACK por secuencia.
- Catálogo offline versionado:
  - snapshot + checksum
  - diff opcional
  - rollback a versión anterior
  - pinning: cada venta fija `catalog_version`
- Backup/Restore cifrado del event log (export/import) con dedupe.
- Observabilidad mínima:
  - backlog de sync
  - latencias locales
  - errores por código

---

## 2) Fuera de Alcance MVP (P1)

- Multi-caja / Soft-Hub
- Pagos offline electrónicos (store-and-forward)
- Impresión/cajón automático
- Inventario avanzado FEFO/lotes
- Facturación electrónica en tiempo real

---

## 3) Reglas Duras (NO negociar)

1. **Confirmar venta = persistir local primero.** Nunca depender de red.
2. **UI optimista:**
   - tap → feedback p95 ≤ 50ms
   - tap → commit local p95 ≤ 150ms
   - cobro efectivo → `sale_confirmed` local p95 ≤ 300ms
3. **Sync "at least once" + idempotencia:**
   - dedupe por `(store_id, event_id)`
   - ack por `terminal_sequence`
4. **Dinero en centavos (int).** Nunca float.
5. **Sin modales "¿estás seguro?"** en acciones reversibles: usar UNDO.
6. **Totales determinísticos** por `catalog_version` pinneada.

---

## 4) Arquitectura

| Capa           | Tecnología                                          |
|----------------|-----------------------------------------------------|
| Front          | Next.js (App Router) + PWA                          |
| Local          | IndexedDB via Dexie                                 |
| Cloud          | Vercel API routes + Postgres (event store + reportes) |
| Service Worker | Cachea app shell (recursos), NO transacciones       |

---

## 5) Modelo de Eventos (Mínimo)

### Envelope

```typescript
interface EventEnvelope {
  store_id: string;
  terminal_id: string;
  terminal_sequence: number;    // monótono por terminal
  event_id: string;             // UUID
  event_type: string;
  schema_version: number;
  occurred_at: string;          // ISO 8601
  aggregate_type: string;
  aggregate_id: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  synced: 0 | 1;
}
```

### Eventos MVP

| Evento                   | Payload                                              |
|--------------------------|------------------------------------------------------|
| `shift_opened`           | `{ opening_cash_cents }`                             |
| `cash_movement`          | `{ type: 'IN' \| 'OUT', amount_cents, reason }`      |
| `shift_closed`           | `{ declared_cash_cents, over_short_cents }`          |
| `sale_created`           | `{ sale_id, catalog_version }`                       |
| `sale_item_added`        | `{ line_id, product_id, qty, unit_price_cents }`     |
| `sale_item_removed`      | `{ line_id, qty }`                                   |
| `payment_captured_local` | `{ method: 'CASH', amount_cents, change_given_cents }` |
| `sale_confirmed`         | `{ total_cents }`                                    |

---

## 6) Sync Protocol (Cloud Ingest)

| Aspecto      | Especificación                                    |
|--------------|---------------------------------------------------|
| Endpoint     | `POST /api/events/ingest`                         |
| Request      | Batch ordenado por `terminal_sequence`            |
| Response     | `{ accepted: boolean, acked_through_terminal_sequence: number }` |
| Reintentos   | Backoff exponencial                               |
| Idempotencia | Procesar mismo batch no duplica eventos           |

---

## 7) Entregables a Implementar (Orden Sugerido)

1. DB schema Dexie + migraciones
2. Reducers/proyecciones (sale + shift) + tests
3. Sync client + API ingest + dedupe SQL + ack
4. Catálogo versionado + cache offline + pinning
5. Backup/restore cifrado + dedupe
6. Métricas + pantalla diagnóstico + plan pruebas offline/crash

---

## 8) Definition of Done (Piloto)

| Criterio | Descripción                                        |
|----------|----------------------------------------------------|
| AC-01    | Operar 2 horas sin internet vendiendo en efectivo  |
| AC-02    | Al volver internet, sincroniza sin duplicar        |
| AC-03    | Crash/reinicio no pierde ventas confirmadas        |
| AC-04    | Catálogo versionado con rollback                   |
| AC-05    | Backup cifrado export/import funciona y dedupea    |

---

## Librerías Mínimas (Sugeridas)

| Librería           | Propósito                          |
|--------------------|------------------------------------|
| `dexie`            | IndexedDB                          |
| `zod`              | Validación schemas eventos/catálogo |
| `uuid` / `crypto.randomUUID()` | Generación de IDs       |
| `date-fns`         | Manejo de fechas (opcional)        |
| WebCrypto nativo   | Cifrado backup (sin libs pesadas)  |
