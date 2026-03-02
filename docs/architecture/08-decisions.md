# 8. Decisiones Arquitectónicas (ADRs)

> Cada decisión documenta el contexto, alternativas consideradas, y consecuencias aceptadas (positivas Y negativas).

---

## ADR-001: Event Sourcing como modelo de persistencia

**Estado**: Aceptada | **Fecha**: 2024-Q4

### Contexto
Un POS de pollería necesita: auditoría completa (quién hizo qué y cuándo), operación offline (internet inestable en Perú), y la capacidad de reconstruir estado tras errores.

### Alternativas Consideradas
1. **CRUD directo**: Simple, familiar. Sin historial, sin offline natural.
2. **CRUD + audit log**: Historial parcial. Audit log se desincroniza del estado real.
3. **Event Sourcing**: Historial completo, offline natural (append-only), replay.

### Decisión
Event Sourcing con 73 tipos de evento, discriminated union Zod, ingest transaccional.

### Consecuencias
- **Positivas**: Auditoría perfecta, offline-first natural, replay para debug, projections rebuildeables
- **Negativas**: Complejidad en queries (necesitas projections), event store crece sin límite, schema evolution es difícil, debugging de flujo asíncrono es más complejo
- **Riesgos aceptados**: Event store sin retention/archival (crece infinito). Snapshots server-side existen (`snapshot.service.ts`) pero no eliminan eventos viejos. EventMigrator conectado al ingest con write-time migration (R2 resuelto Mar 1, 2026)

---

## ADR-002: Single Database Multi-Tenant

**Estado**: Aceptada | **Fecha**: 2024-Q4

### Contexto
SaaS multi-tenant para pollerías. Escala esperada: 10-50 tenants, cada uno con ~500 transacciones/día.

### Alternativas Consideradas
1. **DB por tenant**: Aislamiento perfecto, backup/restore individual. Complejidad operacional alta.
2. **Schema por tenant**: Aislamiento a nivel de schema. Migraciones complejas.
3. **Shared DB + tenant_id column**: Simple, una sola DB, aislamiento por código.

### Decisión
Shared DB con `tenant_id` en todas las tablas relevantes.

### Consecuencias
- **Positivas**: Una sola DB para operar, migraciones simples, queries cross-tenant para analytics
- **Negativas**: Sin Row-Level Security (RLS) — aislamiento depende de `WHERE tenant_id`. Noisy neighbor posible. Backup/restore por tenant individual es imposible.
- **Riesgos aceptados**: Un query sin `WHERE tenant_id` = data leak. Mitigado por middleware obligatorio.

---

## ADR-003: SSE en vez de WebSocket para notificaciones

**Estado**: Aceptada | **Fecha**: 2025-Q1

### Contexto
KDS necesita recibir tickets nuevos en tiempo real. Mozo necesita notificaciones de "plato listo".

### Alternativas Consideradas
1. **Polling**: Simple, sin estado. Latencia alta (mínimo intervalo de polling).
2. **WebSocket**: Bidireccional, baja latencia. Complejidad en reconexión, estado del socket, serverless unfriendly.
3. **SSE (Server-Sent Events)**: Unidireccional (server→client), auto-reconnect nativo, HTTP estándar.

### Decisión
SSE via PostgreSQL LISTEN/NOTIFY (canales nativos vía `pg` library, NO Supabase Realtime managed).

### Consecuencias
- **Positivas**: Reconexión automática del browser, sin library adicional, funciona sobre HTTP/2, serverless-compatible
- **Negativas**: Unidireccional — el cliente no puede enviar ACKs por el mismo canal. Limitado a ~6 conexiones SSE por dominio en HTTP/1.1.
- **Pregunta abierta**: Si KDS necesita confirmar recepción de ticket, se necesitaría una API call separada (POST) — aún no requerido.

---

## ADR-004: Dexie/IndexedDB como store offline

**Estado**: Aceptada | **Fecha**: 2024-Q4

### Contexto
El POS debe funcionar sin internet. Los eventos generados offline deben persistir hasta que se puedan sincronizar.

### Alternativas Consideradas
1. **localStorage**: Simple, 5-10MB límite, síncrono (bloquea UI).
2. **SQLite (WASM)**: SQL completo, ~2MB de overhead WASM.
3. **IndexedDB via Dexie**: Async, >250MB capacidad, transacciones, buen soporte.

### Decisión
Dexie 4.x con schema versionado (v7): `events`, `projections`, `metadata`, `sagaQueue`.

### Consecuencias
- **Positivas**: Capacidad masiva, API async, versionable, hooks para reactividad
- **Negativas**: API más compleja que localStorage, debugging difícil, SSR-unsafe (`typeof window` check obligatorio)

---

## ADR-005: Next.js App Router Monolith

**Estado**: Aceptada (bajo observación) | **Fecha**: 2024-Q3

### Contexto
Equipo pequeño, producto SaaS con frontend + backend + API. Necesita deployment simple.

### Alternativas Consideradas
1. **Frontend SPA + Backend API separados**: Clara separación, deploy independiente. Dos repos, dos pipelines.
2. **Next.js Pages Router**: Maduro, bien documentado. Sin Server Components, routing legacy.
3. **Next.js App Router monolith**: Frontend + API co-located, Server Components, Server Actions.

### Decisión
Next.js App Router con 261 route handlers y 83 páginas en un solo repo.

### Consecuencias
- **Positivas**: Un solo deploy, código compartido (tipos, validación), DX integrado
- **Negativas**: Build time crece con el número de rutas, cold start en serverless para cada ruta, tight coupling frontend-backend
- **Señal de alarma**: 261 routes en un monolito es mucho. Si build time o cold starts se vuelven problema, considerar modular monolith con route groups o split en 2 deploys (admin vs POS).

---

## ADR-006: Transactional Outbox para Event Bus

**Estado**: Aceptada | **Fecha**: 2025-Q1

### Contexto
Tras ingestar un evento, se necesita notificar a otros terminales (KDS, Mozo). Si la notificación falla, el evento ya fue committeado — inconsistencia.

### Alternativas Consideradas
1. **Publish después del commit**: Simple. Si publish falla, los demás terminales no se enteran.
2. **Publish dentro de la transacción**: Imposible — NOTIFY de PostgreSQL es after-commit.
3. **Transactional Outbox**: Escribir en tabla `event_outbox` dentro de la misma transacción. Worker lee y publica.

### Decisión
Outbox dentro de la transacción `RepeatableRead`. Post-commit: `eventBus.publish()`.

### Consecuencias
- **Positivas**: Garantía at-least-once delivery, event store + projection + outbox atómicos
- **Negativas**: Post-commit publish si falla, el outbox queda sin procesar (necesitaría un poller/worker, que no existe actualmente como proceso dedicado)

---

## ADR-007: RBAC con Roles Fijos (no ABAC)

**Estado**: Aceptada | **Fecha**: 2024-Q4

### Contexto
Pollerías peruanas. Roles bien definidos: cajero, mesero, cocinero, admin. No necesitan permisos custom.

### Alternativas Consideradas
1. **ABAC (Attribute-Based)**: Flexible, granular. Complejo de implementar y mantener.
2. **RBAC dinámico**: Roles editables por admin. Más flexible, más riesgo de misconfiguration.
3. **RBAC fijo**: 11 roles hardcodeados. Simple, predecible, auditable.

### Decisión
11 roles fijos en `src/core/constants/roles.ts`. 4 admin roles con jerarquía numérica.

### Consecuencias
- **Positivas**: Zero-config para el admin, no se puede romper, fácil de auditar
- **Negativas**: Un tenant no puede crear roles custom (e.g., "Supervisor de Delivery"). Si la pollería crece, los 11 roles pueden no ser suficientes.

---

## ADR-008: Conflicto en Pagos = Reject (no Merge)

**Estado**: Aceptada | **Fecha**: 2025-Q2

### Contexto
Dos terminales offline registran un pago para el mismo check. Al sincronizar, hay conflicto de revisión.

### Alternativas Consideradas
1. **Merge**: Aceptar ambos pagos. Riesgo: cobro doble al cliente.
2. **Last-Write-Wins**: Aceptar el último. Riesgo: pago legítimo perdido.
3. **Reject + Manual Retry**: Rechazar el segundo, notificar al cajero.

### Decisión
Eventos con "PAYMENT" en el nombre → estrategia REJECT. El cajero ve error y reintenta con estado actualizado.

### Consecuencias
- **Positivas**: Nunca se cobra doble al cliente, el cajero tiene control
- **Negativas**: Fricción para el cajero en reconexión. Requiere UI de "conflicto de pago" (parcialmente implementado)

---

## ADR-009: RLS Selectivo para Tablas Sensibles

**Estado**: Parcialmente implementado (Guardrail) | **Fecha**: 2024-Q4 (revisada Mar 1, 2026; implementada Mar 2, 2026)

### Contexto
Supabase ofrece RLS nativo en PostgreSQL. El sistema es multi-tenant con aislamiento por `tenant_id` en todas las tablas. La pregunta es si agregar RLS como segunda capa de protección.

### Alternativas Consideradas
1. **Sin RLS**: Aislamiento por `WHERE tenant_id` en código. Simple, sin overhead de policies.
2. **RLS completo**: `CREATE POLICY` en todas las tablas (~121 modelos).
3. **RLS selectivo**: Solo en tablas sensibles (events, orders, employees, payments, sessions).

### Decisión
RLS selectivo en 7 tablas sensibles como defensa en profundidad. Script SQL en `prisma/rls/enable-selective-rls.sql`.

### Tablas Protegidas
`events`, `orders`, `employees`, `payments`, `active_sessions`, `archived_events`, `pending_events`

### Consecuencias
- **Positivas**: Segunda capa de protección para datos financieros y PII. Un query sin `WHERE tenant_id` en estas tablas retorna vacío en vez de data leak.
- **Negativas**: Requiere `SET LOCAL app.current_tenant_id` por conexión si se usa un rol non-superuser. Prisma conecta como superuser (`postgres`) que bypasea RLS por defecto — el RLS protege contra queries directos desde Supabase Dashboard o client libraries.
- **Nota**: El aislamiento primario sigue siendo por código (middleware + WHERE). RLS es la red de seguridad.

### Implementación (Mar 2, 2026)
RLS habilitado en 7 tablas como guardrail de base de datos. Prisma conecta como `postgres` (superuser, bypasea RLS). La protección es efectiva contra acceso directo via Supabase Dashboard o client libraries con roles non-superuser. Scripts idempotentes: `prisma/rls/enable-selective-rls.sql` (aplicar) y `prisma/rls/rollback-rls.sql` (revertir). Verificación: `npx tsx scripts/check-rls-status.ts`. Upgrade path a `app_user` con dual-client Prisma documentado en proposal (`openspec/changes/rls-postgresql/proposal.md`).
