/**
 * Test Utilities for Property-Based Testing
 * 
 * Provides:
 * - Fast-check arbitraries for domain types
 * - Property test helpers (testInvariant, testIdempotence, etc.)
 * - Expectation helpers for assertions
 */

import * as fc from 'fast-check';
import { randomUUID } from 'crypto';

// ============================================================================
// ARBITRARIES - Domain Types
// ============================================================================

/**
 * Arbitrary for valid UUIDs
 */
export const uuidArb = fc.uuid();

/**
 * Arbitrary for positive integers (Centavos)
 */
export const positiveCentavosArb = fc.integer({ min: 1, max: 999999999 });

/**
 * Arbitrary for non-negative integers (Centavos)
 */
export const centavosArb = fc.integer({ min: 0, max: 999999999 });

/**
 * Arbitrary for small centavos amounts (for testing)
 */
export const smallCentavosArb = fc.integer({ min: 0, max: 100000 });

/**
 * Arbitrary for positive quantities
 */
export const quantityArb = fc.integer({ min: 1, max: 1000 });

/**
 * Arbitrary for user roles
 */
export const roleArb = fc.constantFrom('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KDS');

/**
 * Arbitrary for order numbers
 */
export const orderNumberArb = fc.integer({ min: 1, max: 999999 });

/**
 * Arbitrary for business dates (YYYY-MM-DD format)
 */
export const businessDateArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 })
).map(([year, month, day]) => 
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
);

/**
 * Arbitrary for ISO date strings
 */
export const isoDateArb = fc.date().map(d => d.toISOString());

/**
 * Arbitrary for order IDs (branded type)
 */
export const orderIdArb = uuidArb;

/**
 * Arbitrary for tenant IDs (branded type)
 */
export const tenantIdArb = uuidArb;

/**
 * Arbitrary for shift IDs (branded type)
 */
export const shiftIdArb = uuidArb;

/**
 * Arbitrary for terminal IDs
 */
export const terminalIdArb = fc.string({ minLength: 1, maxLength: 20 });

/**
 * Arbitrary for event envelope
 */
export const eventEnvelopeArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  aggregate_id: uuidArb,
  aggregate_type: fc.constantFrom('ORDER', 'SHIFT', 'INVOICE', 'CATALOG'),
  event_type: fc.string({ minLength: 5, maxLength: 50 }),
  occurred_at: isoDateArb,
  schema_version: fc.integer({ min: 1, max: 10 }),
  terminal_sequence: fc.integer({ min: 0, max: 1000000 }),
  causation_id: fc.option(uuidArb, { nil: null }),
  actor_id: fc.option(uuidArb, { nil: null }),
  actor_role_snapshot: fc.option(fc.constantFrom('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KDS'), { nil: null }),
  business_date: fc.option(businessDateArb, { nil: null }),
  payload: fc.record({
    order_id: fc.option(uuidArb),
    order_number: fc.option(orderNumberArb),
    total_cents: fc.option(centavosArb),
  }),
});

/**
 * Arbitrary for ORDER_CREATED events
 */
export const orderCreatedEventArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  aggregate_id: uuidArb,
  aggregate_type: fc.constant('ORDER'),
  event_type: fc.constant('ORDER_CREATED'),
  occurred_at: isoDateArb,
  schema_version: fc.constant(1),
  terminal_sequence: fc.integer({ min: 0, max: 1000000 }),
  payload: fc.record({
    order_id: uuidArb,
    order_number: orderNumberArb,
    order_type: fc.constantFrom('DINE_IN', 'TAKEOUT', 'DELIVERY'),
    total_cents: positiveCentavosArb,
    items: fc.array(fc.record({
      item_id: uuidArb,
      product_id: uuidArb,
      quantity: quantityArb,
      unit_price_cents: positiveCentavosArb,
    }), { minLength: 1, maxLength: 50 }),
    checks: fc.array(fc.record({
      check_id: uuidArb,
      check_number: fc.integer({ min: 1, max: 999 }),
      items: fc.array(uuidArb, { minLength: 0, maxLength: 50 }),
      total_cents: positiveCentavosArb,
    }), { minLength: 0, maxLength: 10 }),
  }),
});

/**
 * Arbitrary for SHIFT_OPENED events
 */
export const shiftOpenedEventArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  aggregate_id: uuidArb,
  aggregate_type: fc.constant('SHIFT'),
  event_type: fc.constant('SHIFT_OPENED'),
  occurred_at: isoDateArb,
  schema_version: fc.constant(1),
  terminal_sequence: fc.integer({ min: 0, max: 1000000 }),
  payload: fc.record({
    shift_id: uuidArb,
    terminal_id: terminalIdArb,
    opened_by: uuidArb,
    cash_opening_cents: centavosArb,
  }),
});

/**
 * Arbitrary for CHECK_MARKED_PAID events
 */
export const checkMarkedPaidEventArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  aggregate_id: uuidArb,
  aggregate_type: fc.constant('ORDER'),
  event_type: fc.constant('CHECK_MARKED_PAID'),
  occurred_at: isoDateArb,
  schema_version: fc.constant(1),
  terminal_sequence: fc.integer({ min: 0, max: 1000000 }),
  payload: fc.record({
    check_id: uuidArb,
    order_id: uuidArb,
    paid_at: isoDateArb,
    payment_method: fc.constantFrom('CASH', 'CARD', 'YAPE', 'PLIN'),
    amount_cents: positiveCentavosArb,
    change_cents: centavosArb,
  }),
});

/**
 * Generate a realistic order object
 */
export function generateRealisticOrder(overrides?: Partial<any>) {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    order_number: Math.floor(Math.random() * 999999),
    order_type: 'DINE_IN',
    order_status: 'OPEN',
    total_cents: Math.floor(Math.random() * 100000) + 1000,
    items: [],
    checks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Generate a realistic ORDER_CREATED event
 */
export function generateRealisticOrderCreatedEvent() {
  const orderId = randomUUID();
  return {
    event_id: randomUUID(),
    tenant_id: randomUUID(),
    aggregate_id: orderId,
    aggregate_type: 'ORDER',
    event_type: 'ORDER_CREATED',
    occurred_at: new Date().toISOString(),
    schema_version: 1,
    terminal_sequence: Math.floor(Math.random() * 1000000),
    payload: {
      order_id: orderId,
      order_number: Math.floor(Math.random() * 999999),
      order_type: 'DINE_IN',
      total_cents: Math.floor(Math.random() * 100000) + 1000,
      items: [
        {
          item_id: randomUUID(),
          product_id: randomUUID(),
          quantity: Math.floor(Math.random() * 10) + 1,
          unit_price_cents: Math.floor(Math.random() * 50000) + 100,
        },
      ],
    },
  };
}

/**
 * Generate a realistic check object
 */
export function generateRealisticCheck() {
  return {
    id: randomUUID(),
    order_id: randomUUID(),
    check_number: Math.floor(Math.random() * 999),
    items: [],
    subtotal_cents: Math.floor(Math.random() * 100000) + 1000,
    tax_cents: Math.floor(Math.random() * 10000),
    total_cents: Math.floor(Math.random() * 100000) + 1000,
    status: 'OPEN',
  };
}

/**
 * Generate a realistic shift object
 */
export function generateRealisticShift() {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    terminal_id: `CAJA-${String(Math.floor(Math.random() * 99) + 1).padStart(2, '0')}`,
    opened_by: randomUUID(),
    opened_at: new Date(),
    closed_at: null,
    closed_by: null,
    status: 'OPEN',
    cash_opening_cents: Math.floor(Math.random() * 100000),
    cash_closing_cents: null,
    business_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate a realistic event sequence
 */
export function generateRealisticEventSequence(count: number = 10): any[] {
  const events: any[] = [];
  for (let i = 0; i < count; i++) {
    events.push(generateRealisticOrderCreatedEvent());
  }
  return events;
}

/**
 * Generate a realistic inventory item object
 */
export function generateRealisticInventoryItem() {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    product_id: randomUUID(),
    quantity: Math.floor(Math.random() * 1000),
    unit: 'kg',
    cost_cents: Math.floor(Math.random() * 50000) + 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================================
// PROPERTY TEST HELPERS
// ============================================================================

/**
 * Test that a property holds for all generated values
 */
export function testInvariant<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => boolean,
  message: string
) {
  fc.assert(
    fc.property(arb, (value) => {
      if (!predicate(value)) {
        throw new Error(`${message}: ${JSON.stringify(value)}`);
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a property holds for all generated values (alias)
 */
export function testForAll<T>(
  arb: fc.Arbitrary<T>,
  predicate: (value: T) => boolean,
  message: string
) {
  testInvariant(arb, predicate, message);
}

/**
 * Test that a function is idempotent (f(f(x)) = f(x))
 */
export function testIdempotence<T>(
  arb: fc.Arbitrary<T>,
  fn: (value: T) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
) {
  fc.assert(
    fc.property(arb, (value) => {
      const once = fn(value);
      const twice = fn(once);
      if (!equals(once, twice)) {
        throw new Error(`Idempotence failed: f(f(x)) !== f(x)`);
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a function is commutative (f(a, b) = f(b, a))
 */
export function testCommutativity<T>(
  arb: fc.Arbitrary<T>,
  fn: (a: T, b: T) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
) {
  fc.assert(
    fc.property(arb, arb, (a, b) => {
      const ab = fn(a, b);
      const ba = fn(b, a);
      if (!equals(ab, ba)) {
        throw new Error(`Commutativity failed: f(a, b) !== f(b, a)`);
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a function is associative (f(f(a, b), c) = f(a, f(b, c)))
 */
export function testAssociativity<T>(
  arb: fc.Arbitrary<T>,
  fn: (a: T, b: T) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
) {
  fc.assert(
    fc.property(arb, arb, arb, (a, b, c) => {
      const ab_c = fn(fn(a, b), c);
      const a_bc = fn(a, fn(b, c));
      if (!equals(ab_c, a_bc)) {
        throw new Error(`Associativity failed: f(f(a, b), c) !== f(a, f(b, c))`);
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a function is a round-trip (f(g(x)) = x)
 */
export function testRoundTrip<T, U>(
  arb: fc.Arbitrary<T>,
  encode: (value: T) => U,
  decode: (value: U) => T,
  equals: (a: T, b: T) => boolean = (a, b) => a === b
) {
  fc.assert(
    fc.property(arb, (value) => {
      const encoded = encode(value);
      const decoded = decode(encoded);
      if (!equals(value, decoded)) {
        throw new Error(`Round-trip failed: decode(encode(x)) !== x`);
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a function throws for invalid input
 */
export function testThrows<T>(
  arb: fc.Arbitrary<T>,
  fn: (value: T) => void
) {
  fc.assert(
    fc.property(arb, (value) => {
      try {
        fn(value);
        throw new Error('Expected function to throw');
      } catch (err) {
        if (err instanceof Error && err.message === 'Expected function to throw') {
          throw err;
        }
        // Expected to throw
      }
    }),
    { numRuns: 100 }
  );
}

/**
 * Test that a function does not throw for valid input
 */
export function testNoThrow<T>(
  arb: fc.Arbitrary<T>,
  fn: (value: T) => void
) {
  fc.assert(
    fc.property(arb, (value) => {
      try {
        fn(value);
      } catch (err) {
        throw new Error(`Expected function not to throw: ${err}`);
      }
    }),
    { numRuns: 100 }
  );
}

// ============================================================================
// EXPECTATION HELPERS
// ============================================================================

/**
 * Expect a value to be valid centavos (non-negative integer)
 */
export function expectCentavos(value: any) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected valid centavos, got: ${value}`);
  }
}

/**
 * Expect a value to be positive centavos (positive integer)
 */
export function expectPositiveCentavos(value: any) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected positive centavos, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid UUID
 */
export function expectUUID(value: any) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new Error(`Expected valid UUID, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid ISO date string
 */
export function expectISODate(value: any) {
  if (typeof value !== 'string' || isNaN(Date.parse(value))) {
    throw new Error(`Expected valid ISO date, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid business date (YYYY-MM-DD)
 */
export function expectBusinessDate(value: any) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new Error(`Expected valid business date (YYYY-MM-DD), got: ${value}`);
  }
}

/**
 * Expect a value to be a valid terminal ID
 */
export function expectTerminalId(value: any) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 20) {
    throw new Error(`Expected valid terminal ID, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid tenant ID
 */
export function expectValidTenantId(value: any) {
  expectUUID(value);
}

/**
 * Expect a value to be a valid order
 */
export function expectValidOrder(value: any) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected valid order object, got: ${value}`);
  }
  expectUUID(value.id);
  expectUUID(value.tenant_id);
  if (!Number.isInteger(value.order_number) || value.order_number <= 0) {
    throw new Error(`Expected valid order_number, got: ${value.order_number}`);
  }
  expectCentavos(value.total_cents);
}

/**
 * Expect a value to be a valid check
 */
export function expectValidCheck(value: any) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected valid check object, got: ${value}`);
  }
  expectUUID(value.id);
  expectUUID(value.order_id);
  expectCentavos(value.total_cents);
}

/**
 * Expect a value to be valid JSONB (serializable)
 */
export function expectValidJSONB(value: any, requiredFields?: string[]) {
  try {
    JSON.stringify(value);
    
    // Verificar campos requeridos si se especifican
    if (requiredFields) {
      for (const field of requiredFields) {
        if (!(field in value)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
  } catch (err) {
    throw new Error(`Expected valid JSONB, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid event
 */
export function expectValidEvent(value: any) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected valid event object, got: ${value}`);
  }
  expectUUID(value.event_id);
  expectUUID(value.tenant_id);
  expectUUID(value.aggregate_id);
  if (!['ORDER', 'SHIFT', 'INVOICE', 'CATALOG'].includes(value.aggregate_type)) {
    throw new Error(`Expected valid aggregate_type, got: ${value.aggregate_type}`);
  }
  if (typeof value.event_type !== 'string' || value.event_type.length === 0) {
    throw new Error(`Expected valid event_type, got: ${value.event_type}`);
  }
  expectISODate(value.occurred_at);
  if (!Number.isInteger(value.schema_version) || value.schema_version <= 0) {
    throw new Error(`Expected valid schema_version, got: ${value.schema_version}`);
  }
  if (!Number.isInteger(value.terminal_sequence) || value.terminal_sequence < 0) {
    throw new Error(`Expected valid terminal_sequence, got: ${value.terminal_sequence}`);
  }
}

/**
 * Expect a value to be a valid inventory quantity
 */
export function expectValidInventoryQty(value: any) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Expected valid inventory quantity, got: ${value}`);
  }
}

/**
 * Expect a value to be a valid WAC (Weighted Average Cost)
 */
export function expectValidWAC(value: any) {
  expectCentavos(value);
}

/**
 * Expect correct change calculation
 */
export function expectCorrectChange(paid: number, total: number, change: number) {
  const expectedChange = paid - total;
  if (change !== expectedChange) {
    throw new Error(`Expected change ${expectedChange}, got: ${change}`);
  }
}

/**
 * Expect split bill sums to equal total
 */
export function expectSplitBillSums(splits: number[], total: number) {
  const sum = splits.reduce((a, b) => a + b, 0);
  if (sum !== total) {
    throw new Error(`Expected split sum ${total}, got: ${sum}`);
  }
}

/**
 * Expect all entities in collection have tenant_id
 */
export function expectAllHaveTenantId(entities: any[]) {
  for (const entity of entities) {
    if (!entity.tenant_id) {
      throw new Error(`Entity missing tenant_id: ${JSON.stringify(entity)}`);
    }
  }
}

/**
 * Expect unique order numbers
 */
export function expectUniqueOrderNumbers(orders: any[]) {
  const numbers = orders.map(o => o.order_number);
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    throw new Error(`Expected unique order numbers, got duplicates`);
  }
}

/**
 * Expect valid business date
 */
export function expectValidBusinessDate(value: any) {
  expectBusinessDate(value);
}

/**
 * Expect projection consistency
 */
export function expectProjectionConsistency(projection1: any, projection2: any) {
  if (JSON.stringify(projection1) !== JSON.stringify(projection2)) {
    throw new Error(`Expected consistent projections`);
  }
}

/**
 * Expect valid discount (discount <= subtotal)
 */
export function expectValidDiscount(subtotal: number, discount: number) {
  if (!Number.isInteger(discount) || discount < 0) {
    throw new Error(`Expected valid discount (non-negative integer), got: ${discount}`);
  }
  if (discount > subtotal) {
    throw new Error(`Expected discount <= subtotal, got discount: ${discount}, subtotal: ${subtotal}`);
  }
}

/**
 * Expect valid payment
 */
export function expectValidPayment(value: any) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Expected valid payment object, got: ${value}`);
  }
  expectUUID(value.id);
  expectCentavos(value.amount_cents);
  if (!['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER'].includes(value.method)) {
    throw new Error(`Expected valid payment method, got: ${value.method}`);
  }
  if (!['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].includes(value.status)) {
    throw new Error(`Expected valid payment status, got: ${value.status}`);
  }
}


/**
 * Generate a realistic recipe object
 */
export function generateRealisticRecipe() {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    product_id: randomUUID(),
    ingredients: [
      {
        inventory_item_id: randomUUID(),
        quantity: Math.floor(Math.random() * 10) + 1,
        unit: 'kg',
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate a realistic waste log object
 */
export function generateRealisticWasteLog() {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    inventory_item_id: randomUUID(),
    quantity: Math.floor(Math.random() * 10) + 1,
    reason: 'Expired',
    logged_by: randomUUID(),
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate a realistic purchase order object
 */
export function generateRealisticPurchaseOrder() {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    supplier_id: randomUUID(),
    items: [
      {
        inventory_item_id: randomUUID(),
        quantity: Math.floor(Math.random() * 100) + 10,
        unit_cost_cents: Math.floor(Math.random() * 50000) + 100,
      },
    ],
    total_cents: Math.floor(Math.random() * 500000) + 1000,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate a realistic inventory transaction sequence
 */
export function generateRealisticInventoryTransactionSequence(count: number = 10): any[] {
  const transactions: any[] = [];
  for (let i = 0; i < count; i++) {
    transactions.push({
      id: randomUUID(),
      tenant_id: randomUUID(),
      inventory_item_id: randomUUID(),
      type: ['PURCHASE', 'SALE', 'WASTE', 'ADJUSTMENT'][Math.floor(Math.random() * 4)],
      quantity: Math.floor(Math.random() * 100) + 1,
      cost_cents: Math.floor(Math.random() * 50000) + 100,
      created_at: new Date().toISOString(),
    });
  }
  return transactions;
}
