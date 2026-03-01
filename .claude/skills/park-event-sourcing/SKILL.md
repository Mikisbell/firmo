---
name: park-event-sourcing
description: >
  PARK POS event-sourcing patterns: ParkEvent types, ingest pipeline, reducers, projections.
  Trigger: When working with events, projections, ingest, reducers, or event_type.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## ParkEvent Discriminated Union

Source of truth: `src/core/domain/events.ts`

```typescript
// Zod discriminated union — 65+ event types
export const EventSchema = z.discriminatedUnion("event_type", [
  BaseEnvelopeSchema.extend({
    event_type: z.literal("ORDER_CREATED"),
    aggregate_type: z.literal("ORDER"),
    payload: OrderCreatedPayload,
  }),
  // ... 65+ more
]);
export type ParkEvent = z.infer<typeof EventSchema>;
```

**BaseEnvelope fields** (every event carries these):
- `event_id` (UUID) — dedup key
- `tenant_id` (UUID) — ALWAYS from JWT
- `terminal_id`, `terminal_sequence`
- `occurred_at` (ISO 8601)
- `aggregate_type`: ORDER | SHIFT | INVOICE | CATALOG | SAGA | INVENTORY | HR
- `aggregate_id`, `correlation_id`, `causation_id`
- `actor_id`, `actor_role_snapshot`
- `schema_version: 1`, `payload_version: 1`
- `shift_id`, `business_date`

## Money — ALWAYS Cents (Integer)

```typescript
export const centsSchema = z.number().int();
export const positiveCentsSchema = z.number().int().nonnegative();
// NEVER use float for money
```

## Ingest Pipeline (route.ts)

File: `src/app/api/events/ingest/route.ts`

Processing order inside `$transaction(RepeatableRead)`:
1. **Dedup** — `processed_events.create({ event_id })` → P2002 = duplicate → 200 OK
2. **Validate** — `validateEvent(event)` business rules
3. **Dependency check** — out-of-order queue for missing ORDER_CREATED
4. **Conflict detect** — ORDER aggregates only
5. **Insert** — `events.create()`
6. **Project** — `projectEvent(tx, event)` → upsert into read model
7. **Revision** — increment on ORDER aggregate
8. **Outbox** — `event_outbox.create()` for guaranteed publish
9. **Publish** — after transaction commit

```typescript
await prisma.$transaction(async (tx) => {
  // Step 1: Dedup lock
  await tx.processed_events.create({
    data: { event_id: event.event_id, tenant_id, event_type, processor: 'ingest-api' }
  });
  // Steps 2-8...
}, { timeout: 30000, maxWait: 10000, isolationLevel: 'RepeatableRead' });
```

## Reducer Pattern

File: `src/core/projections/sale.reducer.ts`

```typescript
export function applySaleEvent(
  sale: SaleProjection | null,
  e: ParkEvent
): ApplyResult<SaleProjection | null>
// ApplyResult<T> = { state: T; warnings: string[] }
```

Rules:
- Takes `null` for first event (ORDER_CREATED creates projection)
- Returns warnings array — **never throws**
- Unknown events → `{ state: sale, warnings }` (ignore, don't crash)
- Idempotency: CHECK_PAYMENT_ADDED checks `idempotency_key`
- Uses `eventMigrator.migrate(e)` before processing

## Projection Pattern (Idempotent Upsert)

```typescript
// CORRECT: upsert with empty update = idempotent insert
await tx.orders.upsert({
  where: { id: p.order_id },
  create: { id: p.order_id, tenant_id, status: 'OPEN', ... },
  update: {},  // no-op if already exists
});
```

## Ingest Response Shape

```typescript
// Success
{ accepted: true, deduped_event_ids: [], rejected: [], merged: [] }
// Failure
{ accepted: false, error: { error_code, severity, message, user_action, retryable } }
```

## Anti-Patterns

- `event.payload.type` → use `event.event_type` (discriminated union key)
- `new PrismaClient()` in ingest → use `import prisma from '@/src/core/db/prisma'`
- Throwing in reducer → return `{ state, warnings: [...] }`
- Float for money → `z.number().int()` always
- Missing `processed_events` dedup → creates duplicate projections
