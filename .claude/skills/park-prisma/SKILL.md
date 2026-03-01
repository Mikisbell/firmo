---
name: park-prisma
description: >
  PARK POS Prisma/DB patterns: singleton, transactions, upserts, schema.
  Trigger: When working with database, Prisma, schema, migrations, or queries.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## PrismaClient Singleton (MANDATORY)

File: `src/core/db/prisma.ts`

```typescript
import prisma from '@/src/core/db/prisma';
// This is the ONLY valid way to access Prisma
```

Implementation uses `$extends` for slow-query logging:
```typescript
const prismaClientSingleton = () => {
  const base = new PrismaClient();
  return base.$extends({
    name: 'slow-query-logger',
    query: {
      async $allOperations({ operation, model, args, query }) {
        const start = Date.now();
        const result = await query(args);
        const duration = Date.now() - start;
        if (duration > 1000) logger.warn('Slow query', { model, operation, duration });
        return result;
      }
    }
  }) as unknown as PrismaClient;
};

declare global { var prisma: undefined | ReturnType<typeof prismaClientSingleton> }
const prisma = globalThis.prisma ?? prismaClientSingleton();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
export default prisma;
```

## Schema Conventions

File: `prisma/schema.prisma`

```prisma
model events {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  event_type  String
  payload     Json
  occurred_at DateTime @db.Timestamptz(6)
  created_at  DateTime @default(now()) @db.Timestamptz(6)
  // ... always tenant_id + FK to tenants
  @@index([tenant_id, event_type, occurred_at(sort: Desc)])
}
```

**Conventions**:
- PKs: `@id @db.Uuid`
- Tenant FK: `tenant_id String @db.Uuid` with relation to `tenants`
- Timestamps: `@db.Timestamptz(6)`, `@default(now())`
- Money: plain `Int` columns (centavos) — **NEVER** `Float` or `Decimal`
- JSON: `Json` type for flexible payloads (items, checks, etc.)
- Composite unique: `@@unique([tenant_id, employee_id, date])`
- Composite index: `@@index([tenant_id, action, created_at(sort: Desc)])`

## Transaction Pattern (Event-Sourced Writes)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Dedup lock
  await tx.processed_events.create({ data: { event_id, tenant_id, event_type, processor: 'ingest-api' } });
  // 2. Insert event
  await tx.events.create({ data: { id: event.event_id, ... } });
  // 3. Idempotent projection
  await tx.orders.upsert({
    where: { id: order_id },
    create: { id: order_id, tenant_id, ... },
    update: {},  // no-op = idempotent
  });
  // 4. Outbox for reliable publish
  await tx.event_outbox.create({ data: { event_id, ... } });
}, {
  timeout: 30000,
  maxWait: 10000,
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
});
```

## Idempotent Upsert Pattern

```typescript
// Insert-or-ignore: create with update: {}
await tx.table.upsert({
  where: { id: entityId },
  create: { id: entityId, tenant_id, field1, field2 },
  update: {},  // no-op if already exists
});

// Insert-or-update: create with meaningful update
await tx.table.upsert({
  where: { id: entityId },
  create: { ... },
  update: { updated_at: new Date(occurred_at), status: newStatus },
});
```

## Schema Drift Fix

```bash
# NEVER use prisma migrate on drift — use direct SQL:
npx prisma db execute --stdin <<< "ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar TEXT;"
```

## Branded Types

File: `src/core/types/shared.ts`

```typescript
export type Centavos = number & { readonly __brand: 'Centavos' };
export type EmployeeId = string & { readonly __brand: 'EmployeeId' };
export function unsafeCentavos(n: number): Centavos { return n as Centavos; }
```

## Test Cleanup (CRITICAL)

```typescript
// CORRECT: scoped cleanup
await prisma.events.deleteMany({ where: { tenant_id: TEST_TENANT_ID } });

// WRONG: global cleanup — causes flaky parallel tests
await prisma.events.deleteMany({});
```

## Anti-Patterns

- `new PrismaClient()` anywhere → **FORBIDDEN** — use singleton import
- `import { PrismaClient } from '@prisma/client'` and instantiating → same problem
- `deleteMany({})` without WHERE → causes cross-test pollution
- Float/Decimal for money columns → use `Int` (centavos)
- `prisma migrate` on schema drift → use `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- Inline `DATABASE_URL` in PrismaClient config → never expose connection string
- Missing `tenant_id` in WHERE clause → data leak between tenants
