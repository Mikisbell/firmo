# Plan Fase 3 — Retirar PG LISTEN/NOTIFY + SSE, dejar Supabase Realtime

> Estado: **PROPUESTA, pendiente de aprobación de Belico.** No ejecutado.
> Fecha: 2026-06-22

## 1. Contexto y evidencia (verificado, no supuesto)

El realtime de PARK está **a medio migrar**. Hoy conviven DOS transportes:

| Transporte | Implementación | Dónde vive | Estado |
|---|---|---|---|
| **PG LISTEN/NOTIFY → SSE** | `SupabaseEventBus` (`src/core/infra/supabase-event-bus.ts`) | Conexión TCP directa al 5432 | Funciona SOLO en dev local (Node) |
| **Supabase Realtime broadcast** | `SupabaseRealtimeEventBus` (`src/core/realtime/supabase-realtime-event-bus.ts`) | WebSocket de Supabase | Funciona (verificado), reconecta solo |

El `CompositeEventBus` (`src/core/infra/event-bus.ts`) publica a AMBOS a la vez, y el cliente
(`src/core/sync/client.ts`) se suscribe a AMBOS (`connectSSE` + `connectRealtime`). Esa es la mezcla.

### Por qué hay que retirar el pg/SSE
**Target de deploy = Cloudflare Workers** (evidencia: `wrangler.toml`, `@cloudflare/workers-types`
en deps, y `next.config` dice *"Cloudflare necesita todo empaquetado, no puede hacer require() en
runtime"*). Los Workers son **request-scoped: NO sobreviven conexiones TCP persistentes**. Por lo
tanto:
- El SSE (`/api/data-sync/stream`) depende de `eventBus.subscribe()` → PG LISTEN/NOTIFY → **MUERTO en
  producción Cloudflare**. Solo "anda" en el `bun run dev` local porque ahí es Node con socket vivo.
- Supabase Realtime es WebSocket gestionado → **sí sobrevive** en Workers.

Esto alinea con el plan ya registrado en memoria: *"Migrar el realtime de PG LISTEN/NOTIFY (puerto
5432, muere en Cloudflare) a Supabase Realtime. Fase 2 LOGRADO."* Falta la Fase 3.

### Estado de Supabase Realtime (verificado contra la DB)
- RLS habilitado en `realtime.messages`: **SÍ**
- Policies `poc_tenant_receive` (SELECT) y `poc_tenant_send` (INSERT): **aplicadas y correctas**
  (`realtime.topic() = 'tenant:' || auth.jwt()->>'tenant_id'`).
- `SUPABASE_JWT_SECRET`: presente. Token HS256 con `role:authenticated` + `tenant_id` (correcto).
- El `CHANNEL_ERROR` de los logs es **reconexión transitoria de WebSocket** (conectó 21:49, drop
  21:51, reconectó 21:51:44), NO un fallo de auth. Ruido benigno.

> Nota: las policies se llaman `poc_*` y el SQL vive en `prisma/cleanup/setup-realtime-auth-poc.sql`.
> Aunque están aplicadas, hay que **promoverlas a una migración formal** (ver paso 4) para que el
> entorno de prod/CI las tenga garantizadas y no dependan de un script de cleanup.

## 2. Objetivo

Dejar **un solo transporte de realtime**: Supabase Realtime (push) + el **polling del SyncClient**
como red de seguridad (ya existe: el tick pull-based trae eventos aunque el push falle). Eliminar la
mezcla y el código que solo sirve en dev.

## 3. Qué se mantiene y qué se retira

**Se mantiene:**
- `SupabaseRealtimeEventBus` (el push de prod).
- El polling/tick del `SyncClient` (red de seguridad ante gaps de WebSocket).
- El ingest y su transacción (ya saneados: 25P02 + 40001).

**Se retira (o se gate a dev):**
- `CompositeEventBus` doble-publish → en prod el ingest emite SOLO por Realtime.
- `connectSSE()` del cliente y el endpoint SSE → gate a `NODE_ENV !== 'production'` (sigue útil en
  dev local para no depender de Supabase), o se elimina si Belico prefiere repo 100% limpio.
- `SupabaseEventBus` (LISTEN/NOTIFY) → idem: dev-only o fuera.

## 4. Cambios concretos (file-by-file)

1. **Promover las policies RLS a migración formal**
   - Mover el contenido de `prisma/cleanup/setup-realtime-auth-poc.sql` a una migración versionada
     (renombrar policies `poc_*` → `realtime_tenant_*`). Endurecer: en prod el INSERT (emitir) debe
     ser solo `service_role`, los clientes solo SELECT (recibir) — como ya nota el comentario del POC.

2. **`src/core/infra/event-bus.ts`**
   - `createEventBus()`: en producción devolver `SupabaseRealtimeEventBus` directo (sin Composite).
     En dev, mantener Composite (pg + realtime) para conveniencia local. Gate por `NODE_ENV`.
   - Marcar `SupabaseEventBus` y `CompositeEventBus` como dev-only (o borrarlos en la variante limpia).

3. **`src/core/sync/client.ts`**
   - `connectSSE()`/`disconnectSSE()`: gate a `NODE_ENV !== 'production'`. En prod, `connectRealtime`
     es el único push. El polling tick queda intacto como fallback.
   - Bajar el log de `CHANNEL_ERROR` de `warn` a `debug`, o contar fallos y avisar solo tras N
     consecutivos (evita alarmar por reconexiones normales).

4. **Endpoint SSE `/api/data-sync/stream`**
   - Gate a dev, o eliminar. (En prod Cloudflare ya no servía.)

5. **Limpieza**
   - Borrar los SQL de `prisma/cleanup/` relativos al POC una vez migrados.
   - Actualizar el comentario `@deprecated FASE 3` en `event-bus.ts` y `client.ts`.

## 5. Validación en Cloudflare (gate de aceptación)

La Fase 3 NO se da por cerrada hasta probar en un deploy real de Cloudflare (preview):
- [ ] Dos terminales del mismo tenant reciben eventos del otro vía Realtime (sin SSE).
- [ ] Al cortar el WebSocket, el polling tick sigue trayendo eventos (latencia ≤ tick).
- [ ] El RLS aísla: un token de tenant A NO recibe broadcasts de tenant B.
- [ ] Emisión solo desde `service_role` (cliente no puede inyectar broadcasts).

## 6. Rollback

- Cambio gobernado por `NODE_ENV` / flag: revertir = volver a `CompositeEventBus` (un commit).
- Las policies RLS son aditivas y reversibles (`DROP POLICY`).
- El polling tick nunca se toca → aunque Realtime falle, el sync degrada a pull, no se cae.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Gap de eventos durante reconexión de WebSocket | El polling tick cubre el gap (ya existe). |
| Latencia mayor sin push instantáneo | Polling tick configurable; Realtime cubre el caso normal. |
| Policy RLS mal migrada → CHANNEL_ERROR en prod | Validación explícita en preview (paso 5) antes de prod. |
| Dev local sin Supabase pierde realtime | Mantener pg/SSE dev-only (no romper el `bun run dev`). |

## 8. Plan de tests

- Unit: `createEventBus()` devuelve Realtime-only en prod, Composite en dev (mock `NODE_ENV`).
- Integración: el `SupabaseRealtimeEventBus.publish` emite al topic correcto del tenant.
- Manual/preview: el checklist del paso 5 en un deploy Cloudflare.

## 9. Decisión tomada: Variante B (limpia)

**Belico eligió la Variante B (2026-06-22): eliminar pg/SSE por completo.** Repo 100%
Node-puro-sobre-Cloudflare, sin código muerto. Dev local usa Supabase Realtime (requiere
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_JWT_SECRET` en `.env.local`).

### Implicancias de B sobre el paso 4 (cambios concretos)
- `SupabaseEventBus` (LISTEN/NOTIFY) → **BORRAR** el archivo y sus referencias.
- `CompositeEventBus` → **BORRAR**; `createEventBus()` devuelve `SupabaseRealtimeEventBus` directo
  (con `InMemoryEventBus` como único fallback si faltan credenciales).
- `connectSSE()`/`disconnectSSE()` en `client.ts` y el endpoint `/api/data-sync/stream` → **BORRAR**.
- Quitar el `EventSource`/SSE del `SyncClient`; el push es solo `connectRealtime`, el pull es el tick.
- Requisito dev: documentar en README/`.env.example` que el realtime local necesita credenciales
  Supabase (ya no hay fallback SSE local).

### Gate de salida (no cerrar sin esto)
- Validación en preview Cloudflare (checklist del paso 5) **obligatoria** antes de prod, porque al
  borrar el SSE ya no hay red de seguridad de push local: todo recae en Realtime + polling.
