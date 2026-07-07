# PARK POS — Sistema Cognitivo

## Idioma
Todo en espanol. Codigo y variables en ingles; comentarios en espanol (como el frontend).

## Memoria (Engram) — protocolo lean
Memoria persistente cross-session via MCP. Detalle operativo en el skill `engram-recall`.
- **Recall** antes de tocar un area: `mem_search` del modulo. Al iniciar sesion: `mem_context(project="park-pos")`.
- **Save** despues de decision/bug/descubrimiento: `mem_save` (formato What/Why/Where/Learned). `mem_session_summary` antes de cerrar.
- Topicos: `architecture/* config/* bugs/* decisions/* patterns/*`. Proyecto siempre: `park-pos`.

## SDD (Spec-Driven Development)
Para features/refactors substanciales o comandos `/sdd-*`, cargar el skill **`sdd-orchestrator`**
(protocolo completo: delegate-only, command-skill mapping, dependency graph, sub-agent patterns).
Comandos: `/sdd-init /sdd-explore /sdd-new /sdd-continue /sdd-ff /sdd-apply /sdd-verify /sdd-archive`.
Regla base: el lead orquesta y delega; NUNCA ejecuta phase work inline.

## Skills disponibles (`.claude/skills/`, auto-cargan por contexto)
- **Stack**: `typescript nextjs-15 react-19 zod-4 zustand-5 tailwind-4 playwright github-pr skill-creator`
- **PARK domain**: `park-event-sourcing park-rbac park-testing park-pos-flow park-offline park-api park-prisma`
- **Memoria/SDD**: `engram-recall`, `sdd-orchestrator` (+ 9 skills `sdd-*`)

## Project Rules (Non-Negotiable)

### Dinero
- SIEMPRE en centavos (integer): `2500` = S/. 25.00
- NUNCA float/decimal para dinero
- Tipo branded: `Centavos` de `@/src/core/types/shared`

### Seguridad
- `tenant_id` SIEMPRE desde JWT (`authResult.user.tenantId`) — NUNCA del cliente
- Auth obligatoria en TODAS las rutas: `requirePosAuth` / `requireAdminAuth` / `requireAdminPermission`
- `ADMIN_ROLES.includes(role)` — NUNCA `role === 'ADMIN'` solo
- Logs sanitizados: PIN y mac_address nunca en console.log

### Edge Computing / Cloudflare Workers
- **PROHIBIDO C++ Native Bindings:** `bcrypt` y `sharp` rompen el entorno V8 Isolates. Usar `bcryptjs` o WebCrypto API.
- **PROHIBIDO TCP Sockets:** `pg` y `ioredis` fallan en Edge.
- Usar `@neondatabase/serverless` + `@prisma/adapter-neon` para Base de Datos vía WebSockets.
- Usar `@upstash/redis` (HTTP REST) en lugar de conexiones redis:// puras.
- Queries ultra-optimizadas (< 10ms CPU time limit). Caché agresivo con Cloudflare KV.

### Database
- PrismaClient singleton: `import prisma from '@/src/core/db/prisma'` — PROHIBIDO `new PrismaClient()`
- Cleanup en tests: `deleteMany({ where: { tenant_id } })` — NUNCA `deleteMany({})`
- Money en DB: columnas `Int` (centavos)
- Schema drift: `ALTER TABLE ADD COLUMN IF NOT EXISTS` via `prisma db execute`

### Roles (Single Source of Truth)
- Archivo: `src/core/constants/roles.ts`
- EMPLOYEE_ROLES (11): OWNER | ADMIN | MANAGER | SUPERVISOR | CASHIER | WAITER | KITCHEN | COOK | PACKER | BAR | DRIVER
- ADMIN_ROLES (4): OWNER | ADMIN | MANAGER | SUPERVISOR
- KITCHEN_ROLES (3): KITCHEN | COOK | PACKER

### Tests
- Vitest + fast-check property tests (50-200 numRuns)
- Filtrar `__proto__`, `constructor`, `prototype` de claves fast-check
- `fc.date()` siempre con bounds
- Instancias frescas en `beforeEach` (no singletons globales en tests)

### Event Sourcing
- Discriminated union por `event_type` (67 tipos)
- Ingest: dedup por `processed_events` + upsert idempotente
- Reducer: retorna `{ state, warnings }` — NUNCA throws
- Dexie SSR-safe: siempre verificar `typeof window !== 'undefined'`
- El status VIVO de un item de orden vive SOLO en `order_item_projections` (única fuente). Leelo vía `order-items.read.ts` (`getItemStatuses`). Ver ADR-010.
- PROHIBIDO leer `orders.items[].status` del JSON: queda congelado en la creación (el snapshot del agregado NO lleva status mutable). Un test de arquitectura bloqueante (`no-json-status-read`) lo impide en CI.
- El payload del evento (`OrderLineSchema.status`) SÍ conserva status — el reducer cliente offline lo foldea de `db.events`.
