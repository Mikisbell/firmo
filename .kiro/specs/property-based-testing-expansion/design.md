# Design Document: Property-Based Testing Expansion

## Overview

This design expands property-based testing coverage across PARK POS to validate universal invariants in core domain logic, Event Sourcing patterns, money calculations, offline sync, and business rules. The system currently has 79 property tests in admin/inventory modules using fast-check. This expansion will add comprehensive property tests to critical business logic, achieving 80%+ coverage of core domain with property-based validation.

**Key Goals:**
- Validate money safety invariants (no precision loss, always non-negative integers)
- Validate Event Sourcing invariants (idempotence, ordering, causality)
- Validate projection consistency (rebuild equals incremental updates)
- Validate offline sync correctness (deduplication, conflict resolution)
- Validate business rule enforcement (payments, invoices, permissions)
- Create reusable test utilities and arbitraries
- Integrate property tests into CI/CD pipeline

**Technology Stack:**
- fast-check (already installed) for property-based testing
- Vitest for test runner
- TypeScript for type-safe test code
- Existing branded types (Centavos, OrderId, etc.) for domain modeling

## Architecture

### Testing Layers

```
┌─────────────────────────────────────────────────────────┐
│                   Property Test Suite                    │
├─────────────────────────────────────────────────────────┤
│  Core Domain Tests  │  Event Sourcing Tests             │
│  - Money calc       │  - Idempotence                    │
│  - Branded types    │  - Ordering                       │
│  - Validation       │  - Deduplication                  │
├─────────────────────────────────────────────────────────┤
│  Projection Tests   │  Business Rule Tests              │
│  - Order rebuild    │  - Payment validation             │
│  - Shift rebuild    │  - Invoice validation             │
│  - Derived fields   │  - Role permissions               │
├─────────────────────────────────────────────────────────┤
│  Sync Tests         │  Inventory Tests                  │
│  - Conflict res     │  - Stock deduction                │
│  - Outbox pattern   │  - Waste calculation              │
│  - Event ordering   │  - WAC precision                  │
├─────────────────────────────────────────────────────────┤
│              Reusable Test Utilities                     │
│  - Arbitraries      │  - Helpers                        │
│  - Fixtures         │  - Assertions                     │
└─────────────────────────────────────────────────────────┘
```

### Test Organization

```
src/
├── core/
│   ├── domain/
│   │   └── __tests__/
│   │       ├── money.property.test.ts          # Money calculations
│   │       ├── branded-types.property.test.ts  # Type safety
│   │       └── events.property.test.ts         # Event validation
│   ├── projection/
│   │   └── __tests__/
│   │       ├── order.property.test.ts          # Order projections
│   │       ├── shift.property.test.ts          # Shift projections
│   │       └── rebuild.property.test.ts        # Rebuild consistency
│   ├── sync/
│   │   └── __tests__/
│   │       ├── deduplication.property.test.ts  # Event dedup
│   │       ├── conflict.property.test.ts       # Conflict resolution
│   │       └── outbox.property.test.ts         # Outbox pattern
│   ├── validation/
│   │   └── __tests__/
│   │       ├── payment.property.test.ts        # Payment rules
│   │       ├── invoice.property.test.ts        # Invoice rules
│   │       └── permissions.property.test.ts    # Role-based access
│   └── inventory/
│       └── __tests__/
│           ├── deduction.property.test.ts      # Stock deduction
│           └── wac.property.test.ts            # Weighted avg cost
└── test-utils/
    ├── arbitraries/
    │   ├── domain.ts                           # Core domain arbitraries
    │   ├── events.ts                           # Event arbitraries
    │   └── inventory.ts                        # Inventory arbitraries
    ├── helpers/
    │   ├── property-patterns.ts                # Common patterns
    │   └── assertions.ts                       # Custom assertions
    └── fixtures/
        └── realistic-data.ts                   # Realistic test data
```

## Components and Interfaces

### 1. Core Domain Property Tests

**Money Calculation Tests** (`src/core/domain/__tests__/money.property.test.ts`)

Tests money arithmetic operations maintain invariants:
- Addition/subtraction preserve integer type
- Multiplication/division round correctly
- Conversion to/from display format is lossless
- Formatting produces consistent output

**Branded Type Tests** (`src/core/domain/__tests__/branded-types.property.test.ts`)

Tests branded type constructors and operations:
- Constructors validate input (asCentavos rejects negatives/floats)
- Unsafe constructors skip validation (for trusted sources)
- Type guards correctly identify branded types
- Operations preserve type safety

**Event Validation Tests** (`src/core/domain/__tests__/events.property.test.ts`)

Tests event structure and validation:
- All events have required envelope fields
- Payload schemas match Zod definitions
- Event IDs are unique UUIDs
- Timestamps are valid ISO strings

### 2. Event Sourcing Property Tests

**Idempotence Tests** (`src/core/projection/__tests__/rebuild.property.test.ts`)

Tests projection idempotence:
- Applying same event twice produces same result
- Event deduplication prevents double-processing
- Processed events table tracks event_id correctly

**Ordering Tests** (`src/core/sync/__tests__/deduplication.property.test.ts`)

Tests event ordering and causality:
- Events with dependencies maintain causal order
- Out-of-order events are reordered by occurred_at
- Concurrent events from different terminals are handled

**Versioning Tests** (`src/core/domain/__tests__/events.property.test.ts`)

Tests event schema evolution:
- V1 events can be read by V2 code
- V2 events include version field
- Migration functions preserve semantics

### 3. Projection Consistency Tests

**Order Projection Tests** (`src/core/projection/__tests__/order.property.test.ts`)

Tests order projection correctness:
- Rebuild from events matches incremental updates
- Derived fields (stations_active, unpaid_checks_count) are correct
- JSONB fields (items, checks) maintain structure
- Order status transitions follow state machine

**Shift Projection Tests** (`src/core/projection/__tests__/shift.property.test.ts`)

Tests shift projection correctness:
- Cash calculations sum correctly
- Shift status transitions are valid
- Business date calculation respects 6AM cutoff
- Timezone handling is correct

**Snapshot Tests** (`src/core/projection/__tests__/rebuild.property.test.ts`)

Tests snapshot-based rebuild:
- Snapshot + incremental events = full rebuild
- Snapshot creation is deterministic
- Snapshot restoration is lossless

### 4. Money Safety Property Tests

**Order Total Tests** (`src/core/domain/__tests__/money.property.test.ts`)

Tests order total calculations:
- Sum of item prices equals subtotal
- Subtotal minus discount equals total
- Total is always non-negative
- Precision is maintained (no float errors)

**Split Bill Tests** (`src/core/validation/__tests__/payment.property.test.ts`)

Tests split bill calculations:
- Sum of check totals equals order total
- Percentage splits sum to 100%
- Item splits account for all items
- Rounding errors are handled correctly

**Payment Validation Tests** (`src/core/validation/__tests__/payment.property.test.ts`)

Tests payment validation:
- Payment amount >= check total
- Change = payment - total
- Multiple payments sum correctly
- Insufficient payment is rejected

### 5. Offline Sync Property Tests

**Deduplication Tests** (`src/core/sync/__tests__/deduplication.property.test.ts`)

Tests event deduplication:
- Duplicate event_id is detected
- Processed events table prevents reprocessing
- Cleanup removes old processed events
- Deduplication is tenant-scoped

**Conflict Resolution Tests** (`src/core/sync/__tests__/conflict.property.test.ts`)

Tests conflict resolution strategies:
- Last-write-wins for simple fields
- Merge for array fields (items, checks)
- Causal ordering for dependent events
- Conflict detection is accurate

**Outbox Pattern Tests** (`src/core/sync/__tests__/outbox.property.test.ts`)

Tests outbox pattern guarantees:
- Events in outbox are eventually published
- Failed publishes are retried
- Published events are marked
- Outbox cleanup removes published events

### 6. Business Rule Validation Tests

**Payment Validation Tests** (`src/core/validation/__tests__/payment.property.test.ts`)

Tests payment business rules:
- Payment < total is rejected
- Change > (payment - total) is rejected
- Unpaid check cannot be invoiced
- Payment methods are valid

**Invoice Validation Tests** (`src/core/validation/__tests__/invoice.property.test.ts`)

Tests invoice business rules:
- Invoice requires paid check
- Duplicate invoice is rejected
- Invoice number is unique
- Voided invoice cannot be re-voided

**Permission Tests** (`src/core/validation/__tests__/permissions.property.test.ts`)

Tests role-based permissions:
- Only MANAGER/ADMIN can void items
- Only CASHIER can process payments
- Only ADMIN can edit catalog
- Terminal registration requires ADMIN

### 7. Inventory Deduction Property Tests

**Stock Deduction Tests** (`src/core/inventory/__tests__/deduction.property.test.ts`)

Tests inventory deduction logic:
- Recipe quantities are deducted correctly
- Stock never goes negative (without override)
- Deduction is atomic (all or nothing)
- Deduction events are recorded

**Waste Calculation Tests** (`src/components/inventory/__tests__/waste-cost.property.test.ts`)

Tests waste cost calculation:
- Cost = quantity × unit_cost_cents
- Result is always non-negative integer
- Calculation is commutative
- Scales linearly with quantity

**WAC Tests** (`src/core/inventory/__tests__/wac.property.test.ts`)

Tests weighted average cost:
- WAC = (old_qty × old_cost + new_qty × new_cost) / (old_qty + new_qty)
- Precision is maintained
- WAC never goes negative
- WAC updates on goods receipt

### 8. Data Integrity Constraint Tests

**Multi-Tenant Tests** (`src/core/domain/__tests__/branded-types.property.test.ts`)

Tests multi-tenant isolation:
- All entities have tenant_id
- Queries filter by tenant_id
- Cross-tenant access is prevented
- Tenant_id is immutable

**Uniqueness Tests** (`src/core/validation/__tests__/payment.property.test.ts`)

Tests uniqueness constraints:
- Order number unique within tenant
- Invoice number unique within tenant
- Employee PIN unique within tenant
- Terminal ID unique within tenant

**Referential Integrity Tests** (`src/core/projection/__tests__/order.property.test.ts`)

Tests foreign key relationships:
- Order references valid product
- Payment references valid order
- Invoice references valid check
- Soft deletes preserve references

## Data Models

### Property Test Data Structures

**Arbitraries** (fast-check generators)

```typescript
// Core domain arbitraries
export const centavosArb = fc.integer({ min: 0, max: 10_000_000 })
  .map(unsafeCentavos);

export const orderIdArb = fc.uuid().map(asOrderId);

export const shiftIdArb = fc.uuid().map(asShiftId);

export const tenantIdArb = fc.uuid().map(asTenantId);

export const terminalIdArb = fc.stringMatching(/^(CAJA|MOZO|KDS)-\d{2}$/)
  .map(asTerminalId);

export const businessDateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
  .map(d => dateToBusinessDate(d));

// Event arbitraries
export const paymentMethodArb = fc.constantFrom<PaymentMethod>(
  'CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER'
);

export const orderTypeArb = fc.constantFrom<OrderType>(
  'DINE_IN', 'TAKEOUT', 'DELIVERY'
);

export const itemStatusArb = fc.constantFrom<ItemStatus>(
  'PENDING', 'COOKING', 'READY', 'DONE', 'VOIDED'
);

// Complex arbitraries
export const orderLineArb = fc.record({
  line_id: fc.uuid(),
  product_id: fc.uuid(),
  sku: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  short_name: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  qty: fc.integer({ min: 1, max: 10 }),
  unit_price_cents: centavosArb,
  station: fc.constantFrom('PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES'),
  status: itemStatusArb,
  mods: fc.array(fc.string({ maxLength: 30 }), { maxLength: 5 }),
  notes: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  added_at: fc.date().map(d => d.toISOString()),
  void: fc.option(fc.record({
    reason: fc.string({ minLength: 3, maxLength: 100 }),
    voided_by: fc.uuid(),
    voided_at: fc.date().map(d => d.toISOString()),
  }), { nil: null }),
});

export const checkArb = fc.record({
  check_id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  mode: fc.constantFrom<'ITEMS' | 'PERCENT'>('ITEMS', 'PERCENT'),
  lines: fc.array(fc.record({
    line_id: fc.uuid(),
    qty: fc.integer({ min: 1, max: 10 }),
  }), { minLength: 1, maxLength: 10 }),
  subtotal_cents: centavosArb,
  discount_cents: centavosArb,
  tip_cents: centavosArb,
  total_cents: centavosArb,
  payment: fc.record({
    status: fc.constantFrom<'UNPAID' | 'PARTIAL' | 'PAID'>('UNPAID', 'PARTIAL', 'PAID'),
    payments: fc.array(fc.record({
      method: paymentMethodArb,
      amount_cents: centavosArb,
      ref: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    }), { maxLength: 5 }),
  }),
});

export const eventArb = fc.record({
  event_id: fc.uuid(),
  tenant_id: tenantIdArb,
  occurred_at: fc.date().map(d => d.toISOString()),
  type: fc.constantFrom<EventType>(
    'ORDER_CREATED', 'ORDER_ITEM_ADDED', 'CHECK_MARKED_PAID', 
    'INVOICE_ISSUED', 'SHIFT_OPENED', 'SHIFT_CLOSED'
  ),
  entity_type: fc.constantFrom('order', 'shift', 'invoice'),
  entity_id: fc.uuid(),
  actor_id: fc.uuid(),
  actor_role_snapshot: fc.constantFrom('ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
  terminal_id: terminalIdArb,
  payload: fc.anything(), // Specific payload based on event type
});
```

**Test Helpers**

```typescript
// Property pattern helpers
export function testRoundTrip<T>(
  arb: fc.Arbitrary<T>,
  encode: (value: T) => string,
  decode: (encoded: string) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
): void {
  fc.assert(
    fc.property(arb, (value) => {
      const encoded = encode(value);
      const decoded = decode(encoded);
      expect(equals(value, decoded)).toBe(true);
    }),
    { numRuns: 100 }
  );
}

export function testIdempotence<T>(
  arb: fc.Arbitrary<T>,
  operation: (value: T) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
): void {
  fc.assert(
    fc.property(arb, (value) => {
      const once = operation(value);
      const twice = operation(once);
      expect(equals(once, twice)).toBe(true);
    }),
    { numRuns: 100 }
  );
}

export function testInvariant<T>(
  arb: fc.Arbitrary<T>,
  invariant: (value: T) => boolean,
  message: string
): void {
  fc.assert(
    fc.property(arb, (value) => {
      expect(invariant(value)).toBe(true);
    }),
    { numRuns: 100 }
  );
}

// Assertion helpers
export function expectCentavos(value: unknown): void {
  expect(typeof value).toBe('number');
  expect(Number.isInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
}

export function expectValidEvent(event: unknown): void {
  expect(event).toHaveProperty('event_id');
  expect(event).toHaveProperty('tenant_id');
  expect(event).toHaveProperty('occurred_at');
  expect(event).toHaveProperty('type');
  expect(event).toHaveProperty('payload');
}

export function expectProjectionConsistency(
  events: ParkEvent[],
  incrementalState: Order,
  rebuiltState: Order
): void {
  expect(rebuiltState.id).toBe(incrementalState.id);
  expect(rebuiltState.order_number).toBe(incrementalState.order_number);
  expect(rebuiltState.subtotal_cents).toBe(incrementalState.subtotal_cents);
  expect(rebuiltState.total_cents).toBe(incrementalState.total_cents);
  expect(rebuiltState.items).toEqual(incrementalState.items);
  expect(rebuiltState.checks).toEqual(incrementalState.checks);
}
```

**Realistic Fixtures**

```typescript
// Realistic test data generators
export function generateRealisticOrder(overrides?: Partial<Order>): Order {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TENANT_ID,
    order_number: Math.floor(Math.random() * 10000),
    order_type: 'DINE_IN',
    order_status: 'OPEN',
    fulfillment_status: 'COOKING',
    handoff_status: 'WAITING',
    stations_active: ['PARRILLA', 'BAR'],
    unpaid_checks_count: 1,
    subtotal_cents: 5000,
    discount_cents: 0,
    total_cents: 5000,
    terminal_id: 'MOZO-01',
    created_at: new Date(),
    updated_at: new Date(),
    items: [
      {
        line_id: randomUUID(),
        product_id: randomUUID(),
        sku: 'pollo_1_4',
        name: '1/4 Pollo',
        short_name: '1/4 P',
        qty: 2,
        unit_price_cents: 2500,
        station: 'PARRILLA',
        status: 'COOKING',
        mods: [],
        notes: null,
        added_at: new Date().toISOString(),
        void: null,
      },
    ],
    checks: [
      {
        check_id: randomUUID(),
        name: 'Mesa 1',
        mode: 'ITEMS',
        lines: [{ line_id: randomUUID(), qty: 2 }],
        subtotal_cents: 5000,
        discount_cents: 0,
        tip_cents: 0,
        total_cents: 5000,
        payment: {
          status: 'UNPAID',
          payments: [],
        },
      },
    ],
    ...overrides,
  };
}

export function generateRealisticShift(overrides?: Partial<Shift>): Shift {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TENANT_ID,
    terminal_id: 'CAJA-01',
    status: 'OPEN',
    opened_at: new Date(),
    closed_at: null,
    opened_by: randomUUID(),
    closed_by: null,
    cash_opening_cents: 10000, // S/100
    cash_expected_cents: null,
    cash_counted_cents: null,
    diff_cents: null,
    ...overrides,
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Core Domain Properties

**Property 1: Money Arithmetic Preserves Integer Invariant**
*For any* two centavos values and any arithmetic operation (add, subtract, multiply), the result should be a non-negative integer
**Validates: Requirements 1.1, 1.5**

**Property 2: Centavos Round-Trip Consistency**
*For any* centavos value, converting to display format (divide by 100) and back (multiply by 100) should produce the original value
**Validates: Requirements 1.2, 4.5**

**Property 3: Branded Type Constructor Validation**
*For any* invalid input (negative number or float), asCentavos() should reject it with an error
**Validates: Requirements 1.3**

**Property 4: Money Formatting Determinism**
*For any* centavos value, calling formatCents() multiple times should produce identical output
**Validates: Requirements 1.6**

### Event Sourcing Properties

**Property 5: Commutative Operations Order Independence**
*For any* sequence of commutative events (like adding items to an order), applying them in any order should produce the same final state
**Validates: Requirements 2.1**

**Property 6: Event Processing Idempotence**
*For any* event, applying it once should have the same effect as applying it twice (via deduplication)
**Validates: Requirements 2.2, 2.3, 5.1**

**Property 7: Projection Rebuild Consistency**
*For any* sequence of events, rebuilding state from scratch should produce identical state to incremental updates
**Validates: Requirements 2.4, 3.1, 3.2, 3.4**

**Property 8: Event Schema Versioning Compatibility**
*For any* V1 event, it should be readable by V2 code, and V2 events should include version field
**Validates: Requirements 2.5**

**Property 9: Causal Event Ordering**
*For any* sequence of events with causal dependencies, the system should maintain correct ordering constraints
**Validates: Requirements 2.6**

### Projection Consistency Properties

**Property 10: Derived Field Computation Correctness**
*For any* order, derived fields (stations_active, unpaid_checks_count) should match their computation rules
**Validates: Requirements 3.3, 8.6**

**Property 11: Snapshot Reconstruction Completeness**
*For any* snapshot and subsequent events, reconstruction should equal full rebuild from all events
**Validates: Requirements 3.5**

### Money Safety Properties

**Property 12: Order Subtotal Equals Item Sum**
*For any* order, the sum of (item.qty × item.unit_price_cents) for all items should equal subtotal_cents
**Validates: Requirements 4.1**

**Property 13: Discount Never Exceeds Subtotal**
*For any* order with discount, discount_cents should be less than or equal to subtotal_cents
**Validates: Requirements 4.2**

**Property 14: Change Calculation Correctness**
*For any* payment, change_cents should equal payment_cents minus total_cents
**Validates: Requirements 4.3**

**Property 15: Split Bill Sum Equals Order Total**
*For any* order with multiple checks, the sum of all check.total_cents should equal order.total_cents
**Validates: Requirements 4.4**

**Property 16: Payment Validation Rejects Insufficient Amounts**
*For any* payment where payment_cents < check.total_cents, validation should reject it
**Validates: Requirements 4.6, 6.1**

### Offline Sync Properties

**Property 17: Non-Conflicting Changes Preservation**
*For any* two concurrent non-conflicting changes, merging should preserve both operations
**Validates: Requirements 5.2**

**Property 18: Conflict Resolution Maintains Invariants**
*For any* conflict resolution, the resulting state should maintain all data integrity invariants
**Validates: Requirements 5.3**

**Property 19: Event Reordering by Timestamp**
*For any* sequence of out-of-order events, reordering by occurred_at should produce correct causal order
**Validates: Requirements 5.4**

### Business Rule Properties

**Property 20: Invoice Requires Paid Check**
*For any* invoice creation attempt, if check.status ≠ 'PAID', validation should reject it
**Validates: Requirements 6.2**

**Property 21: Item Quantity Within Limits**
*For any* item, quantity should be between 1 and 100 (MAX_ITEMS_PER_ORDER limit)
**Validates: Requirements 6.3**

**Property 22: Void Requires Manager Approval**
*For any* void event, if actor_role ∉ {'MANAGER', 'ADMIN'}, validation should reject it
**Validates: Requirements 6.4**

**Property 23: Role-Based Permission Enforcement**
*For any* operation, the system should enforce role-based access control according to permission matrix
**Validates: Requirements 6.5**

**Property 24: Order Number Uniqueness Within Tenant**
*For any* two orders in the same tenant, order_number should be unique
**Validates: Requirements 6.6, 8.2**

### Inventory Properties

**Property 25: Recipe Deduction Correctness**
*For any* order item, stock should decrease by recipe.quantity for each ingredient
**Validates: Requirements 7.1**

**Property 26: Stock Never Negative Without Override**
*For any* stock deduction, if result would be negative and override=false, operation should be rejected
**Validates: Requirements 7.3**

**Property 27: Purchase Order Increases Stock**
*For any* goods receipt, stock should increase by received_quantity for each item
**Validates: Requirements 7.4**

**Property 28: Inventory Count Reconciliation**
*For any* inventory count, the counted quantity should reconcile with sum of transactions since last count
**Validates: Requirements 7.5**

**Property 29: Weighted Average Cost Precision**
*For any* goods receipt, WAC should equal (old_qty × old_cost + new_qty × new_cost) / (old_qty + new_qty) without precision loss
**Validates: Requirements 7.6**

### Data Integrity Properties

**Property 30: Tenant ID Presence**
*For any* entity in multi-tenant tables, tenant_id should be present and non-null
**Validates: Requirements 8.1**

**Property 31: Foreign Key Validity**
*For any* entity with foreign key references, the referenced entity should exist
**Validates: Requirements 8.3**

**Property 32: Soft Delete Preserves References**
*For any* soft-deleted entity (is_active=false), all foreign key references should remain valid
**Validates: Requirements 8.4**

**Property 33: JSONB Schema Conformance**
*For any* JSONB field (items, checks, fulfillment), the data should conform to its Zod schema
**Validates: Requirements 8.5**

## Error Handling

### Property Test Failures

**Failure Reporting:**
- When a property test fails, fast-check provides the failing example
- The failing example should be logged with full context (inputs, expected, actual)
- The test should be marked as failed in CI/CD
- Developers should be able to reproduce the failure locally

**Shrinking:**
- fast-check automatically shrinks failing examples to minimal cases
- Shrinking helps identify the root cause of failures
- Shrunk examples should be included in failure reports

**Timeout Handling:**
- Each property test has a 5-second timeout
- If a test exceeds timeout, it should fail with timeout error
- Timeout errors should include partial results if available

### Invalid Input Handling

**Branded Type Validation:**
- asCentavos() throws Error for negative numbers
- asCentavos() throws Error for non-integers
- asBusinessDate() throws Error for invalid date format
- All validation errors should have descriptive messages

**Event Validation:**
- Invalid events should be rejected by Zod schema validation
- Validation errors should include field path and error message
- Rejected events should not be processed or stored

**Business Rule Violations:**
- Payment < total should return validation error
- Invoice for unpaid check should return validation error
- Void without manager approval should return validation error
- All business rule violations should be logged

## Testing Strategy

### Dual Testing Approach

**Unit Tests:**
- Test specific examples and edge cases
- Test error conditions and boundary values
- Test integration points between components
- Focus on concrete scenarios

**Property Tests:**
- Test universal properties across all inputs
- Generate 100+ random inputs per property
- Validate invariants hold for all cases
- Focus on general correctness

**Complementary Coverage:**
- Unit tests catch concrete bugs (e.g., "payment of 99 for total 100 fails")
- Property tests catch general bugs (e.g., "any payment < total fails")
- Together they provide comprehensive coverage

### Property Test Configuration

**Test Runner:**
- Use Vitest as test runner
- Use fast-check for property generation
- Minimum 100 iterations per property test
- 5-second timeout per test

**Test Tagging:**
```typescript
it('Property 1: Money Arithmetic Preserves Integer Invariant', () => {
  // Feature: property-based-testing-expansion, Property 1
  fc.assert(
    fc.property(centavosArb, centavosArb, (a, b) => {
      const sum = asCentavos(a + b);
      expectCentavos(sum);
    }),
    { numRuns: 100 }
  );
});
```

**Coverage Metrics:**
- Track number of property tests per module
- Track number of properties validated
- Track property test execution time
- Target: 80%+ of core domain covered by property tests

### CI/CD Integration

**Pipeline Configuration:**
```yaml
# .github/workflows/test.yml
test-property:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
    - run: npm ci
    - run: npm run test:property
    - name: Report failures
      if: failure()
      run: |
        echo "Property tests failed"
        cat test-results/property-failures.log
```

**Test Commands:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --run src/**/*.test.ts",
    "test:property": "vitest --run src/**/*.property.test.ts",
    "test:all": "vitest --run"
  }
}
```

**Failure Handling:**
- Property test failures should fail the build
- Failing examples should be logged to artifacts
- Developers should be notified of failures
- Flaky tests should be investigated and fixed

### Test Organization

**File Naming:**
- Unit tests: `*.test.ts`
- Property tests: `*.property.test.ts`
- Integration tests: `*.integration.test.ts`

**Test Location:**
- Co-locate tests with source code in `__tests__` directories
- Shared test utilities in `src/test-utils/`
- Arbitraries in `src/test-utils/arbitraries/`
- Helpers in `src/test-utils/helpers/`

**Test Structure:**
```typescript
describe('Module Name - Property Tests', () => {
  describe('Property N: Property Name', () => {
    it('validates property for all inputs', () => {
      fc.assert(
        fc.property(arbitrary, (input) => {
          // Test logic
          expect(result).toBe(expected);
        }),
        { numRuns: 100 }
      );
    });
    
    it('handles edge cases', () => {
      // Edge case tests
    });
  });
});
```

### Performance Considerations

**Test Execution Time:**
- Each property test should complete in < 5 seconds
- 100 iterations × 50ms per iteration = 5 seconds max
- Slow tests should be optimized or split

**Arbitrary Generation:**
- Use efficient arbitraries (avoid complex nested structures)
- Cache expensive computations
- Use `fc.sample()` for debugging

**Parallel Execution:**
- Run property tests in parallel with unit tests
- Use Vitest's built-in parallelization
- Avoid shared mutable state between tests

## Implementation Notes

### Phase 1: Core Domain (Week 1)
- Implement money calculation property tests
- Implement branded type property tests
- Create core domain arbitraries
- Set up test utilities structure

### Phase 2: Event Sourcing (Week 2)
- Implement event processing property tests
- Implement projection consistency tests
- Create event arbitraries
- Add idempotence and ordering tests

### Phase 3: Business Rules (Week 3)
- Implement payment validation tests
- Implement invoice validation tests
- Implement role permission tests
- Add business rule arbitraries

### Phase 4: Sync & Inventory (Week 4)
- Implement sync property tests
- Implement inventory deduction tests
- Implement WAC calculation tests
- Add sync and inventory arbitraries

### Phase 5: Integration & CI/CD (Week 5)
- Integrate all property tests into CI/CD
- Add coverage reporting
- Document property testing patterns
- Train team on property-based testing

### Dependencies
- fast-check (already installed)
- Vitest (already installed)
- Existing branded types in `src/core/types/shared.ts`
- Existing domain events in `src/core/domain/events.ts`

### Risks
- Property tests may be slower than unit tests (mitigate with parallelization)
- Developers may be unfamiliar with property-based testing (mitigate with documentation and training)
- Shrinking may not always find minimal failing examples (mitigate with manual investigation)
- Flaky tests due to randomness (mitigate with seed control and deterministic arbitraries)
