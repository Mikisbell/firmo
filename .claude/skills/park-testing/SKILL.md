---
name: park-testing
description: >
  PARK POS testing patterns: Vitest, fast-check, arbitraries, cleanup.
  Trigger: When writing tests, property tests, or test utilities.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## Stack

- **Vitest** — unit + integration tests (4123+ tests, 263 files)
- **fast-check** — property-based tests (50-200 numRuns)
- **Playwright** — E2E tests (31 spec files, POM pattern)

## Property Test Template

```typescript
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('MyFeature property tests', () => {
  it('invariant: price always >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        (priceCents) => {
          expect(priceCents).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Reusable Arbitraries

File: `src/core/__tests__/arbitraries.ts`

```typescript
export const productPriceCents = fc.integer({ min: 0, max: 1000000 });
export const productCategory = fc.constantFrom(
  'POLLOS','PARRILLAS','BEBIDAS','EXTRAS','POSTRES','COMBOS','GUARNICIONES'
);
export const productStation = fc.constantFrom(
  'PARRILLA','COCINA','BAR','HORNO','POSTRES','EMPAQUE','FRIOS'
);
export const tenantId = fc.uuid();
export const userId = fc.uuid();
export const productId = fc.uuid();
export const employeeRole = fc.constantFrom(
  'OWNER','ADMIN','MANAGER','SUPERVISOR','CASHIER',
  'WAITER','KITCHEN','COOK','PACKER','BAR','DRIVER'
);
```

## Reusable Property Helpers

File: `src/test-utils/helpers/property-patterns.ts`

```typescript
// Idempotence: f(f(x)) === f(x)
testIdempotence(arb, operation, equals?, { numRuns: 100 })

// Invariant: predicate(x) always true
testInvariant(arb, predicate, message, { numRuns: 100 })

// Round-trip: decode(encode(x)) === x
testRoundTrip(arb, encode, decode, equals?, { numRuns: 100 })

// No-throw: operation(x) never throws
testNoThrow(arb, operation, { numRuns: 100 })

// Also: testCommutativity, testAssociativity, testEquivalence, testForAll
```

## Cleanup Pattern (CRITICAL)

```typescript
// CORRECT: scoped by tenant_id
beforeEach(async () => {
  await prisma.events.deleteMany({ where: { tenant_id: TEST_TENANT } });
});

// WRONG: global delete causes cross-test pollution
await prisma.events.deleteMany({});  // NEVER in parallel workers
```

## Mocking Dexie (IndexedDB)

```typescript
const mockStore = new Map<string, any>();

vi.mock('@/src/core/db/schema', () => ({
  db: {
    events: {
      add: vi.fn(async (e) => { mockStore.set(e.event_id, e); }),
      where: vi.fn((field) => ({
        equals: vi.fn((value) => ({
          toArray: vi.fn(async () => {
            return [...mockStore.values()].filter(e => e[field] === value);
          }),
        })),
      })),
    },
  },
}));
```

## Async Property Tests

```typescript
it('async property: events queue correctly', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10 }),
      async (count) => {
        // async setup and assertions
      }
    ),
    { numRuns: 50 }
  );
});
```

## Anti-Patterns

- `fc.date()` without bounds → generates dates outside valid range
- `fc.string()` generating `__proto__`, `constructor`, `prototype` keys:
  ```typescript
  fc.string().filter(s => !['__proto__','constructor','prototype'].includes(s))
  ```
- `deleteMany({})` → causes flaky tests in parallel workers
- Global service singletons in tests → use `beforeEach` with fresh instances
- `Promise.allSettled()` missing at end → lazy imports leak between tests
- `testThrows` takes 2 args (arb, operation) — not 3
