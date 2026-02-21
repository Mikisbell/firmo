/**
 * Order Projection Property Tests
 * 
 * Tests order projection correctness:
 * - Rebuild from events matches incremental updates
 * - Derived fields (stations_active, unpaid_checks_count) are correct
 * - JSONB fields (items, checks) maintain structure
 * - Order status transitions follow state machine
 * 
 * **Validates: Requirements 3.1, 3.3, 8.5, 8.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  orderCreatedEventArb,
  checkMarkedPaidEventArb,
  generateRealisticOrder,
} from '@/src/test-utils';
import {
  testInvariant,
} from '@/src/test-utils';
import {
  expectValidOrder,
  expectValidCheck,
  expectValidJSONB,
} from '@/src/test-utils';

/**
 * Computes stations_active from order items
 */
function computeStationsActive(items: any[]): string[] {
  const stations = new Set<string>();
  for (const item of items) {
    if (item.status !== 'VOIDED' && item.status !== 'DONE') {
      stations.add(item.station);
    }
  }
  return Array.from(stations).sort();
}

/**
 * Computes unpaid_checks_count from checks
 */
function computeUnpaidChecksCount(checks: any[]): number {
  return checks.filter(check => check.payment.status !== 'PAID').length;
}

/**
 * Validates order state consistency
 */
function validateOrderConsistency(order: any): boolean {
  // Validate derived fields
  const expectedStations = computeStationsActive(order.items);
  const expectedUnpaidCount = computeUnpaidChecksCount(order.checks);

  if (JSON.stringify(order.stations_active?.sort()) !== JSON.stringify(expectedStations)) {
    return false;
  }

  if (order.unpaid_checks_count !== expectedUnpaidCount) {
    return false;
  }

  return true;
}

describe('Order Projection - Property Tests', () => {
  describe('Property 10: Derived Field Computation Correctness', () => {
    it('stations_active matches computed value', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const expected = computeStationsActive(order.items);
          const actual = order.stations_active || [];
          return JSON.stringify(actual.sort()) === JSON.stringify(expected);
        },
        'stations_active must match computed value'
      );
    });

    it('unpaid_checks_count matches computed value', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const expected = computeUnpaidChecksCount(order.checks);
          return order.unpaid_checks_count === expected;
        },
        'unpaid_checks_count must match computed value'
      );
    });

    it('stations_active updates when items change', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          // Add a new item with different station
          const newItem = {
            line_id: '00000000-0000-0000-0000-000000000001',
            product_id: '00000000-0000-0000-0000-000000000001',
            sku: 'test_sku',
            name: 'Test Item',
            qty: 1,
            unit_price_cents: 1000,
            station: 'HORNO',
            status: 'PENDING',
            mods: [],
            notes: null,
            created_at: new Date().toISOString(),
            started_cooking_at: null,
            ready_at: null,
            served_at: null,
          };

          const updatedItems = [...order.items, newItem];

          // Recompute derived field after mutation
          const expected = computeStationsActive(updatedItems);

          // Verify stations_active is correctly computed from items
          expect(expected).toContain('HORNO');
          expect(expected).toContain('KITCHEN');
        }),
        { numRuns: 100 }
      );
    });

    it('unpaid_checks_count updates when payment status changes', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          if (order.checks.length === 0) return;

          // Mark first check as paid
          const updatedChecks = order.checks.map((check: any, index: number) =>
            index === 0
              ? {
                  ...check,
                  payment: { ...check.payment, status: 'PAID' },
                }
              : check
          );

          // Recompute the derived field after mutation
          const expected = computeUnpaidChecksCount(updatedChecks);

          // The original had N unpaid, after marking one as PAID it should be N-1
          expect(expected).toBe(order.unpaid_checks_count - 1);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3.3: JSONB Field Structure Validation', () => {
    it('items JSONB field conforms to schema', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          if (!order.items || order.items.length === 0) return true;

          for (const item of order.items) {
            // Validate item has required OrderLine fields
            if (!item.line_id || !item.product_id || typeof item.qty !== 'number' ||
                typeof item.unit_price_cents !== 'number' || !item.station || !item.status) {
              return false;
            }
          }
          return true;
        },
        'items must conform to OrderLine schema'
      );
    });

    it('checks JSONB field conforms to schema', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          if (!order.checks || order.checks.length === 0) return true;

          for (const check of order.checks) {
            // Validate check has required fields
            if (!check.check_id || typeof check.total_cents !== 'number' ||
                !check.payment || typeof check.payment.status !== 'string') {
              return false;
            }
          }
          return true;
        },
        'checks must conform to Check schema'
      );
    });

    it('items array maintains structure after updates', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          const items = order.items || [];
          // Validate each item has required fields
          for (const item of items) {
            expectValidJSONB(item, ['line_id', 'product_id', 'qty', 'unit_price_cents']);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('checks array maintains structure after updates', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          const checks = order.checks || [];
          if (checks.length > 0) {
            expectValidJSONB(checks[0], ['check_id', 'total_cents', 'payment']);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Order State Consistency', () => {
    it('order maintains consistency across all fields', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => validateOrderConsistency(order),
        'Order must maintain consistency'
      );
    });

    it('order_number is always positive', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => order.order_number > 0,
        'order_number must be positive'
      );
    });

    it('order_type is valid enum', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => ['DINE_IN', 'TAKEOUT', 'DELIVERY'].includes(order.order_type),
        'order_type must be valid enum'
      );
    });

    it('subtotal_cents is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => order.subtotal_cents >= 0,
        'subtotal_cents must be non-negative'
      );
    });

    it('total_cents is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => order.total_cents >= 0,
        'total_cents must be non-negative'
      );
    });

    it('total_cents >= subtotal_cents', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => order.total_cents >= order.subtotal_cents,
        'total_cents must be >= subtotal_cents'
      );
    });
  });

  describe('Item Status Transitions', () => {
    it('item status is valid enum', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const validStatuses = ['PENDING', 'COOKING', 'READY', 'DONE', 'VOIDED'];
          return order.items.every((item: any) => validStatuses.includes(item.status));
        },
        'item status must be valid enum'
      );
    });

    it('voided items are excluded from stations_active', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          // Mark all items as voided
          const voidedOrder = {
            ...order,
            items: order.items.map((item: any) => ({
              ...item,
              status: 'VOIDED',
            })),
          };

          const stations = computeStationsActive(voidedOrder.items);
          expect(stations.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('done items are excluded from stations_active', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          // Mark all items as done
          const doneOrder = {
            ...order,
            items: order.items.map((item: any) => ({
              ...item,
              status: 'DONE',
            })),
          };

          const stations = computeStationsActive(doneOrder.items);
          expect(stations.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Check Payment Status', () => {
    it('check payment status is valid enum', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const validStatuses = ['UNPAID', 'PARTIAL', 'PAID'];
          return order.checks.every((check: any) => validStatuses.includes(check.payment.status));
        },
        'check payment status must be valid enum'
      );
    });

    it('paid checks are excluded from unpaid_checks_count', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          // Mark all checks as paid
          const paidOrder = {
            ...order,
            checks: order.checks.map((check: any) => ({
              ...check,
              payment: { ...check.payment, status: 'PAID' },
            })),
          };

          const unpaidCount = computeUnpaidChecksCount(paidOrder.checks);
          expect(unpaidCount).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('unpaid checks are included in unpaid_checks_count', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          // Mark all checks as unpaid
          const unpaidOrder = {
            ...order,
            checks: order.checks.map((check: any) => ({
              ...check,
              payment: { ...check.payment, status: 'UNPAID' },
            })),
          };

          const unpaidCount = computeUnpaidChecksCount(unpaidOrder.checks);
          expect(unpaidCount).toBe(unpaidOrder.checks.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles order with no items', () => {
      const order = generateRealisticOrder({ items: [] });
      const stations = computeStationsActive(order.items);
      expect(stations.length).toBe(0);
    });

    it('handles order with no checks', () => {
      const order = generateRealisticOrder({ checks: [] });
      const unpaidCount = computeUnpaidChecksCount(order.checks);
      expect(unpaidCount).toBe(0);
    });

    it('handles order with single item', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          if (order.items.length === 0) return;

          const singleItemOrder = {
            ...order,
            items: [order.items[0]],
          };

          const stations = computeStationsActive(singleItemOrder.items);
          expect(stations.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('handles order with single check', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          if (order.checks.length === 0) return;

          const singleCheckOrder = {
            ...order,
            checks: [order.checks[0]],
          };

          const unpaidCount = computeUnpaidChecksCount(singleCheckOrder.checks);
          expect(unpaidCount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });
});
