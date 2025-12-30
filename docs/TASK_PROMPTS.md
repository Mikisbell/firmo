# PARK — Task Prompts para IDE + IA

> **Instrucción base:** Cada tarea empieza recordando:  
> *"Lee docs/CONTEXT.md como fuente de verdad. No inventes features fuera del MVP."*

---

## Tarea 1 — DB Local (Dexie)

```
Lee docs/CONTEXT.md. Implementa src/core/db/schema.ts con Dexie: 
tablas events, sync_state, catalog_versions, y una tabla catalog_items 
(products/variants minimal). Agrega índices para consultas por synced 
y terminal_sequence. Incluye una función initDb() y tests básicos 
(si usas vitest) para insert/orden/consulta.
```

---

## Tarea 2 — Event Schemas + Money Helpers

```
Usa docs/CONTEXT.md como fuente de verdad. Implementa:
- src/core/domain/money.ts (int cents)
- src/core/domain/events.ts con Zod: envelope + eventos MVP 
  (shift_opened, cash_movement, sale_item_added, payment_captured_local, 
  sale_confirmed, etc.)
Prohibe floats.
```

---

## Tarea 3 — Reducers (SaleProjection + ShiftProjection)

```
Implementa reducers determinísticos en src/core/projections/*.reducer.ts 
que consuman eventos ordenados por terminal_sequence y produzcan proyecciones. 
Agrega rebuild.ts que reconstruya proyecciones desde events. 
Incluye invariantes (venta confirmada requiere pago suficiente).
```

---

## Tarea 4 — Sync Client + Backoff

```
Implementa src/core/sync/client.ts que envíe batches a /api/events/ingest 
con reintentos y backoff. Debe marcar eventos synced=1 hasta 
acked_through_terminal_sequence. No puede duplicar eventos.
```

---

## Tarea 5 — API Ingest en Vercel + Postgres Dedupe

```
Implementa src/app/api/events/ingest/route.ts. Debe insertar en Postgres 
un event store con UNIQUE(store_id, event_id). Debe responder 
acked_through_terminal_sequence para los eventos aceptados, incluso 
con reintentos. Devuelve errores estructurados si schema inválido.
```

---

## Tarea 6 — Catálogo Versionado (Snapshot + Checksum + Pinning)

```
Implementa src/core/catalog/*: cache local, aplicar snapshot/diff, 
validar checksum, pinning por venta (sale_created guarda catalog_version). 
Implementa endpoints /api/catalog/latest y /api/catalog/diff.
```

---

## Tarea 7 — Backup/Restore Cifrado

```
Implementa src/core/backup/* con WebCrypto (AES-GCM + PBKDF2). 
Export: rango de terminal_sequence a un Blob descargable. 
Import: descifrar, dedupe por event_id, insertar en DB y 
reconstruir proyecciones.
```

---

## Tarea 8 — Diagnósticos y UX de Estados

```
Implementa diagnostics/page.tsx: muestra persistent storage status, 
backlog de sync, último sync OK, errores. Agrega banners de:
- INTERNET_OFFLINE
- SYNC_BACKLOG_HIGH  
- STORAGE_NOT_PERSISTENT
- BACKUP_RECOMMENDED
```
