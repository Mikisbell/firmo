/**
 * Custom Assertions - Helpers for property test validation
 * 
 * These assertions provide domain-specific validation for property tests.
 */

import { expect } from 'vitest';
import { Centavos, Order, OrderId } from '@/src/core/types/shared';

/**
 * Asserts that a value is a valid Centavos (non-negative integer)
 */
export function expectCentavos(value: unknown): asserts value is Centavos {
  expect(typeof value).toBe('number');
  expect(Number.isInteger(value)).toBe(true);
  expect(value as number).toBeGreaterThanOrEqual(0);
}

/**
 * Asserts that a value is a positive Centavos (> 0)
 */
export function expectPositiveCentavos(value: unknown): asserts value is Centavos {
  expectCentavos(value);
  expect(value as number).toBeGreaterThan(0);
}

/**
 * Asserts that a value is a valid UUID string
 */
export function expectUUID(value: unknown): asserts value is string {
  expect(typeof value).toBe('string');
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
}

/**
 * Asserts that a value is a valid ISO date string
 */
export function expectISODate(value: unknown): asserts value is string {
  expect(typeof value).toBe('string');
  expect(() => new Date(value as string)).not.toThrow();
  expect(new Date(value as string).toISOString()).toBe(value);
}

/**
 * Asserts that a value is a valid business date (YYYY-MM-DD format)
 */
export function expectBusinessDate(value: unknown): asserts value is string {
  expect(typeof value).toBe('string');
  expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const [year, month, day] = (value as string).split('-').map(Number);
  expect(year).toBeGreaterThanOrEqual(2000);
  expect(month).toBeGreaterThanOrEqual(1);
  expect(month).toBeLessThanOrEqual(12);
  expect(day).toBeGreaterThanOrEqual(1);
  expect(day).toBeLessThanOrEqual(31);
}

/**
 * Asserts that a value is a valid terminal ID (e.g., "CAJA-01")
 */
export function expectTerminalId(value: unknown): asserts value is string {
  expect(typeof value).toBe('string');
  expect(value).toMatch(/^(CAJA|MOZO|KDS)-\d{2}$/);
}

/**
 * Asserts that a value is a valid event envelope
 */
export function expectValidEvent(event: unknown): void {
  expect(event).toBeDefined();
  expect(event).toHaveProperty('event_id');
  expect(event).toHaveProperty('tenant_id');
  expect(event).toHaveProperty('occurred_at');
  expect(event).toHaveProperty('aggregate_type');
  expect(event).toHaveProperty('aggregate_id');
  expect(event).toHaveProperty('payload');

  const e = event as any;
  expectUUID(e.event_id);
  expectUUID(e.tenant_id);
  expectISODate(e.occurred_at);
  expectUUID(e.aggregate_id);
}

/**
 * Asserts that an order line is valid
 */
export function expectValidOrderLine(line: unknown): void {
  expect(line).toBeDefined();
  expect(line).toHaveProperty('line_id');
  expect(line).toHaveProperty('product_id');
  expect(line).toHaveProperty('sku');
  expect(line).toHaveProperty('name');
  expect(line).toHaveProperty('qty');
  expect(line).toHaveProperty('unit_price_cents');
  expect(line).toHaveProperty('station');
  expect(line).toHaveProperty('status');

  const l = line as any;
  expectUUID(l.line_id);
  expectUUID(l.product_id);
  expect(typeof l.sku).toBe('string');
  expect(typeof l.name).toBe('string');
  expect(typeof l.qty).toBe('number');
  expect(l.qty).toBeGreaterThan(0);
  expectCentavos(l.unit_price_cents);
  expect(typeof l.station).toBe('string');
  expect(['PENDING', 'COOKING', 'READY', 'DONE', 'VOIDED']).toContain(l.status);
}

/**
 * Asserts that a check is valid
 */
export function expectValidCheck(check: unknown): void {
  expect(check).toBeDefined();
  expect(check).toHaveProperty('check_id');
  expect(check).toHaveProperty('mode');
  expect(check).toHaveProperty('lines');
  expect(check).toHaveProperty('subtotal_cents');
  expect(check).toHaveProperty('discount_cents');
  expect(check).toHaveProperty('total_cents');
  expect(check).toHaveProperty('payment');

  const c = check as any;
  expectUUID(c.check_id);
  expect(['ITEMS', 'PERCENT']).toContain(c.mode);
  expect(Array.isArray(c.lines)).toBe(true);
  expectCentavos(c.subtotal_cents);
  expectCentavos(c.discount_cents);
  expectCentavos(c.total_cents);
  expect(c.payment).toHaveProperty('status');
  expect(['UNPAID', 'PARTIAL', 'PAID']).toContain(c.payment.status);
}

/**
 * Asserts that an order is valid
 */
export function expectValidOrder(order: unknown): void {
  expect(order).toBeDefined();
  expect(order).toHaveProperty('order_id');
  expect(order).toHaveProperty('order_number');
  expect(order).toHaveProperty('order_type');
  expect(order).toHaveProperty('items');
  expect(order).toHaveProperty('checks');
  expect(order).toHaveProperty('subtotal_cents');
  expect(order).toHaveProperty('total_cents');

  const o = order as any;
  expectUUID(o.order_id);
  expect(typeof o.order_number).toBe('number');
  expect(o.order_number).toBeGreaterThan(0);
  expect(['DINE_IN', 'TAKEOUT', 'DELIVERY']).toContain(o.order_type);
  expect(Array.isArray(o.items)).toBe(true);
  expect(Array.isArray(o.checks)).toBe(true);
  expectCentavos(o.subtotal_cents);
  expectCentavos(o.total_cents);

  // Validate items
  o.items.forEach((item: any) => expectValidOrderLine(item));

  // Validate checks
  o.checks.forEach((check: any) => expectValidCheck(check));
}

/**
 * Asserts that projection consistency holds
 * (rebuilt state matches incremental state)
 */
export function expectProjectionConsistency(
  incrementalState: any,
  rebuiltState: any,
  fields: string[] = []
): void {
  if (fields.length === 0) {
    // Default fields to check
    fields = ['id', 'order_number', 'subtotal_cents', 'total_cents', 'items', 'checks'];
  }

  fields.forEach(field => {
    expect(rebuiltState).toHaveProperty(field);
    expect(rebuiltState[field]).toEqual(incrementalState[field]);
  });
}

/**
 * Asserts that money arithmetic result is valid
 */
export function expectValidMoneyResult(result: unknown): asserts result is Centavos {
  expectCentavos(result);
}

/**
 * Asserts that a discount is valid (not exceeding subtotal)
 */
export function expectValidDiscount(
  discount: Centavos,
  subtotal: Centavos
): void {
  expectCentavos(discount);
  expectCentavos(subtotal);
  expect(discount as number).toBeLessThanOrEqual(subtotal as number);
}

/**
 * Asserts that a payment is valid (not less than total)
 */
export function expectValidPayment(
  payment: Centavos,
  total: Centavos
): void {
  expectCentavos(payment);
  expectCentavos(total);
  expect(payment as number).toBeGreaterThanOrEqual(total as number);
}

/**
 * Asserts that change calculation is correct
 */
export function expectCorrectChange(
  payment: Centavos,
  total: Centavos,
  change: Centavos
): void {
  expectCentavos(payment);
  expectCentavos(total);
  expectCentavos(change);
  expect(change as number).toBe((payment as number) - (total as number));
}

/**
 * Asserts that split bill sums correctly
 */
export function expectSplitBillSums(
  checks: Array<{ total_cents: Centavos }>,
  orderTotal: Centavos
): void {
  const sum = checks.reduce((acc, check) => (acc as number) + (check.total_cents as number), 0);
  expect(sum).toBe(orderTotal as number);
}

/**
 * Asserts that inventory quantity is valid (non-negative)
 */
export function expectValidInventoryQty(qty: unknown): void {
  expect(typeof qty).toBe('number');
  expect(Number.isInteger(qty)).toBe(true);
  expect(qty as number).toBeGreaterThanOrEqual(0);
}

/**
 * Asserts that weighted average cost is valid
 */
export function expectValidWAC(wac: unknown): asserts wac is Centavos {
  expectCentavos(wac);
}

/**
 * Asserts that tenant_id is present and valid
 */
export function expectValidTenantId(tenantId: unknown): void {
  expectUUID(tenantId);
}

/**
 * Asserts that all entities in a collection have tenant_id
 */
export function expectAllHaveTenantId(entities: Array<any>): void {
  entities.forEach((entity, index) => {
    expect(entity).toHaveProperty('tenant_id');
    expectValidTenantId(entity.tenant_id);
  });
}

/**
 * Asserts that order numbers are unique within a collection
 */
export function expectUniqueOrderNumbers(orders: Array<any>): void {
  const orderNumbers = orders.map(o => o.order_number);
  const uniqueNumbers = new Set(orderNumbers);
  expect(uniqueNumbers.size).toBe(orderNumbers.length);
}

/**
 * Asserts that JSONB field conforms to expected structure
 */
export function expectValidJSONB(
  field: unknown,
  expectedKeys: string[]
): void {
  expect(field).toBeDefined();
  expect(typeof field).toBe('object');
  expectedKeys.forEach(key => {
    expect(field).toHaveProperty(key);
  });
}
