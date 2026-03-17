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

## Database
- PrismaClient singleton: `import prisma from '@/src/core/db/prisma'` — NEVER `new PrismaClient()`
- Test cleanup: `deleteMany({ where: { tenant_id } })` — NEVER `deleteMany({})`
- Schema drift: `ALTER TABLE ADD COLUMN IF NOT EXISTS` via `prisma db execute`

## TypeScript
- No `any` types unless wrapping external libs with known schema drift (document with comment)
- Prefer `interface` for object shapes, `type` for unions/intersections
- Use branded types from `src/core/types/shared.ts` for domain IDs
- Exhaustive switch with `never` default for discriminated unions

## Event Sourcing
- Events use discriminated union by `event_type` (73 types)
- Ingest: dedup via `processed_events` + idempotent upsert
- Reducer: return `{ state, warnings }` — NEVER throw
- Dexie SSR-safe: always check `typeof window !== 'undefined'`

## React/Next.js
- No `useMemo`/`useCallback` (React 19 compiler handles this)
- Server Actions for mutations, SWR for data fetching
- State: Context (auth) + SWR (data) + useState (UI) + 1 Zustand store (useCart)

## Roles (Single Source of Truth)
- File: `src/core/constants/roles.ts`
- EMPLOYEE_ROLES (11): OWNER | ADMIN | MANAGER | SUPERVISOR | CASHIER | WAITER | KITCHEN | COOK | PACKER | BAR | DRIVER
- ADMIN_ROLES (4): OWNER | ADMIN | MANAGER | SUPERVISOR
- KITCHEN_ROLES (3): KITCHEN | COOK | PACKER
