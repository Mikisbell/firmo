# PARK POS — Code Review Rules (GGA)

## Language
- Code, variables, and comments in English
- User-facing strings in Spanish

## Money (Critical)
- Money ALWAYS in integer cents (centavos): `2500` = S/. 25.00
- NEVER use float/decimal for money
- Use branded type `Centavos` from `@/src/core/types/shared`
- Database money columns must be `Int`

## Security (Critical)
- `tenant_id` ALWAYS from JWT (`authResult.user.tenantId`) — NEVER from client/request body
- All API routes MUST use auth: `requirePosAuth` / `requireAdminAuth` / `requireAdminPermission`
- Use `ADMIN_ROLES.includes(role)` — NEVER `role === 'ADMIN'` alone (excludes OWNER/MANAGER/SUPERVISOR)
- NEVER log PIN or mac_address in console.log
- Use structured logger (Pino): `import { createLogger } from '@/src/core/observability/logger'`
- CRON auth MUST use fail-safe pattern: `if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`)` — NEVER `if (cronSecret && authHeader !== ...)` which allows access when env var is unset

## Database
- PrismaClient singleton: `import prisma from '@/src/core/db/prisma'` — NEVER `new PrismaClient()`
- Test cleanup: `deleteMany({ where: { tenant_id } })` — NEVER `deleteMany({})`
- Schema drift: `ALTER TABLE ADD COLUMN IF NOT EXISTS` via `prisma db execute`
- All Prisma calls in API routes MUST be wrapped in try/catch returning appropriate HTTP status

## Edge Computing / Cloudflare Workers (Critical)
- **NO C++ Native Bindings:** `bcrypt` and `sharp` are STRICTLY FORBIDDEN. Use `bcryptjs` or WebCrypto API instead.
- **NO TCP Sockets:** `pg` and `ioredis` cannot connect via standard TCP. 
- Use `@neondatabase/serverless` and `@prisma/adapter-neon` for WebSockets database connections.
- Use `@upstash/redis` (REST HTTP) instead of `ioredis`.
- Queries must be optimized to run within the 10ms CPU time limit. Cache heavy queries using Cloudflare KV.

## TypeScript
- No `any` types unless wrapping external libs with known schema drift (document with comment)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use branded types from `src/core/types/shared.ts` for domain IDs
- Exhaustive switch with `never` default for discriminated unions

## No Stubs / No Placeholders (Critical)
- NEVER merge code with `toast.info('próximamente')` or `toast.info('coming soon')` — implement or remove
- NEVER use hardcoded fake IDs in production pages: `loc-default`, `shift-default`, `tenant-123`, `emp-1`, etc.
- NEVER leave `// TODO:` comments in production code without a linked issue or implementation
- Buttons and form submissions MUST have real handlers — empty `onClick={() => {}}` or `onClick={() => toast.info(...)}` are stubs
- API calls from UI pages MUST use real data from SWR hooks, not hardcoded placeholder strings

## API Routes (Critical)
- Every `route.ts` MUST handle errors: wrap DB/service calls in try/catch and return 500 on failure
- Use `requireAdminAuth` result pattern: check `authResult.authorized` (not `.success`), return `authResult.response` on failure
- All responses MUST be JSON: `NextResponse.json({ ... })`
- Validate query params with Zod before using them

## Event Sourcing
- Events use discriminated union by `event_type` (73 types)
- Ingest: dedup via `processed_events` + idempotent upsert
- Reducer: return `{ state, warnings }` — NEVER throw
- Dexie SSR-safe: always check `typeof window !== 'undefined'`

## React/Next.js
- No `useMemo`/`useCallback` (React 19 compiler handles this)
- Server Actions for mutations, SWR for data fetching
- State: Context (auth) + SWR (data) + useState (UI) + 1 Zustand store (useCart)
- Pages that depend on tenant data MUST use SWR hooks (useLocations, useEmployees, etc.) — never hardcode IDs

## Tests
- Dates in tests MUST be dynamic: `new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` — NEVER hardcode past or near-future dates
- `vi.mock()` factories that reference outer `vi.fn()` variables MUST use `vi.hoisted()` to avoid "Cannot access before initialization"
- Mocks for modules that connect to external services (Supabase, Redis, EventBus) MUST be defined at module level so CI doesn't try to connect

## Roles (Single Source of Truth)
- File: `src/core/constants/roles.ts`
- EMPLOYEE_ROLES (11): OWNER | ADMIN | MANAGER | SUPERVISOR | CASHIER | WAITER | KITCHEN | COOK | PACKER | BAR | DRIVER
- ADMIN_ROLES (4): OWNER | ADMIN | MANAGER | SUPERVISOR
- KITCHEN_ROLES (3): KITCHEN | COOK | PACKER
