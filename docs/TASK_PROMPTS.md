# PARK — Task Prompts para IDE + IA

> **Instrucción base:** Cada tarea empieza recordando:  
> *"Lee docs/CONTEXT.md como fuente de verdad. No implementes features fuera del MVP (P0)."*

---

## ⚠️ Antes de Implementar

1. **Lee `docs/CONTEXT.md`** para entender las fases P0/P1/P2
2. **Solo implementa tablas P0** a menos que se indique lo contrario
3. **Sigue las reglas duras** (offline-first, cents, idempotencia)

---

## P0 — MVP Tasks

### Tarea 1 — Dexie Local Schema (Event Log)

```
Lee docs/CONTEXT.md. Revisa src/core/db/schema.ts (Dexie).
Verifica que tenga:
- Tabla events con índices [synced, terminal_sequence]
- Tabla projections para cache de estado
- Tabla sync_state para tracking de sincronización
- Tabla catalog_versions y catalog_items

El schema ya existe. Solo verifica y ajusta si es necesario.
```

---

### Tarea 2 — Event Schemas (Zod)

```
Lee docs/EVENTS.md. Implementa en src/core/domain/events.ts:
- Schemas Zod para eventos P0:
  - SHIFT_OPENED, SHIFT_CLOSED
  - ORDER_CREATED, ORDER_ITEM_ADDED
  - CHECK_PAYMENT_ADDED, CHECK_MARKED_PAID
  - INVOICE_ISSUED
- Type guards y validadores
- Dinero siempre en centavos (int), nunca float.
```

---

### Tarea 3 — Reducers (Proyecciones)

```
Implementa reducers en src/core/projections/*.reducer.ts:
- sale.reducer.ts: proyección de venta activa
- shift.reducer.ts: proyección de turno actual
- rebuild.ts: reconstruye desde events ordenados por terminal_sequence

Invariantes:
- Venta confirmada requiere pago >= total
- Shift solo puede cerrarse si está abierto
```

---

### Tarea 4 — Sync Client

```
Verifica src/core/sync/client.ts:
- Envía batches a /api/events/ingest con header x-api-secret
- Reintentos con backoff exponencial
- Marca eventos synced=1 hasta acked_through_terminal_sequence
- No duplica eventos (idempotencia)
```

---

### Tarea 5 — API Ingest (Vercel + Postgres)

```
Verifica src/app/api/events/ingest/route.ts:
- Valida x-api-secret header
- Inserta en Postgres con UNIQUE(tenant_id, event_id)
- Responde acked_through_terminal_sequence
- Maneja reintentos sin duplicar
```

---

### Tarea 6 — Catálogo Versionado

```
Implementa src/core/catalog/*:
- Cache local en Dexie (catalog_items)
- Validar checksum al cargar
- Pinning: order_created guarda catalog_version
- Endpoint GET /api/catalog/latest (productos activos)
```

---

### Tarea 7 — Backup/Restore Cifrado

```
Ya implementado en src/core/security/encryption.ts y 
src/app/(pos)/diagnostics/BackupSection.tsx.

Verifica:
- Export: AES-GCM a Blob descargable
- Import: descifrar, dedupe por event_id, reconstruir proyecciones
```

---

### Tarea 8 — UI Diagnósticos

```
Ya implementado en src/app/(pos)/diagnostics/.

Verifica:
- Muestra: storage status, backlog sync, ultimo sync OK
- Banners: INTERNET_OFFLINE, SYNC_BACKLOG_HIGH, STORAGE_NOT_PERSISTENT
- Backup/Restore funcional
```

---

### Tarea 9 — Shifts (Turnos)

```
Implementa flujo de turnos:
- UI para abrir turno (cash_opening_cents)
- UI para cerrar turno (cash_counted_cents, diff)
- Eventos: SHIFT_OPENED, SHIFT_CLOSED
- Tabla: shifts (Prisma ya existe)
```

---

### Tarea 10 — Facturación por Check (P0 - Completado)

```
✅ Implementado:
- Flujo de facturación por check (CheckDetail, Modals)
- Evento: INVOICE_ISSUED
- Validar: check debe estar PAID para facturar
```

### Tarea 10b — Backend Projections (P0 - Completado)

```
✅ Implementado:
- Proyección Síncrona en ingest:
  - ORDER_CREATED -> orders (Upsert)
  - INVOICE_ISSUED -> invoices (Insert)
  - SHIFT_OPENED/CLOSED -> shifts (Upsert)
- Visibilidad inmediata en Supabase/BI
```

### Tarea 10c — Impresión de Tickets (P0 - Completado)

```
✅ Implementado:
- Templates 80mm en `src/core/printing/templates.tsx`
- Browser Print (`window.print`) para MVP sin drivers
- Auto-print al emitir facturas
```

---

## P1 — Multi-Terminal Tasks

### Tarea 11 — KDS (Kitchen Display)

```
Implementa pantalla KDS:
- Filtra por: station = ANY(orders.stations_active)
- Muestra items de su estación
- Permite: marcar COOKING → READY → DONE
- Audio opcional según tenant_settings.kds_audio_enabled
```

---

### Tarea 12 — Split Bill

```
Implementa división de cuenta:
- orders.checks JSONB con múltiples checks
- Modos: ITEMS (por línea) o PERCENT
- Cada check tiene su payment y puede facturarse individualmente
```

---

### Tarea 13 — Promotions

```
Implementa promociones usando docs/PROMOTIONS_DSL.md:
- Tabla: promotions con rules JSONB
- Validación server-side en caja
- Guardar promotion_snapshot en order
```

---

## P2 — Growth Tasks

Ver `docs/GROWTH.md` y `docs/SECURITY.md` cuando llegues a esta fase.

---

## Referencia Rápida

| Documento | Para qué |
|-----------|----------|
| `CONTEXT.md` | Scope, fases, reglas duras |
| `ARCHITECTURE.md` | Tablas Prisma (27) |
| `EVENTS.md` | 30+ eventos + triggers |
| `SPECS.md` | Enums, pagos, impresión |
| `GROWTH.md` | WhatsApp, IA (P2) |
| `PROMOTIONS_DSL.md` | Reglas promos (P1) |
| `SECURITY.md` | Cupones, anti-fraude (P1-P2) |
