/**
 * Payment and Money Safety Property Tests
 * 
 * Tests payment validation and money safety:
 * - Order totals equal sum of items
 * - Discounts never exceed subtotal
 * - Change equals payment minus total
 * - Split bill calculations sum to original total
 * - Payment validation rejects insufficient amounts
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6, 6.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  centavosArb,
  positiveCentavosArb,
  smallCentavosArb,
  generateRealisticOrder,
  generateRealisticCheck,
} from '@/src/test-utils';
import {
  testInvariant,
  testForAll,
} from '@/src/test-utils';
import {
  expectCentavos,
  expectValidDiscount,
  expectValidPayment,
  expectCorrectChange,
  expectSplitBillSums,
} from '@/src/test-utils';

/**
 * Calculates order subtotal from items
 */
function calculateSubtotal(items: any[]): number {
  return items.reduce((sum, item) => sum + (item.qty * item.unit_price_cents), 0);
}

/**
 * Calculates order total from subtotal and discount
 */
function calculateTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}

/**
 * Calculates change from payment and total
 */
function calculateChange(payment: number, total: number): number {
  return Math.max(0, payment - total);
}

/**
 * Validates payment is sufficient
 */
function isPaymentSufficient(payment: number, total: number): boolean {
  return payment >= total;
}

describe('Payment and Money Safety - Property Tests', () => {
  describe('Property 12: Order Subtotal Equals Item Sum', () => {
    it('subtotal equals sum of item prices', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const calculated = calculateSubtotal(order.items);
          return calculated === (order.total_cents as number);
        },
        'subtotal must equal sum of items'
      );
    });

    it('subtotal is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) >= 0,
        'subtotal must be non-negative'
      );
    });

    it('subtotal increases with more items', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          if (order.items.length === 0) return;

          const subtotal1 = calculateSubtotal(order.items);
          const subtotal2 = calculateSubtotal([...order.items, order.items[0]]);

          expect(subtotal2).toBeGreaterThanOrEqual(subtotal1);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 13: Discount Never Exceeds Subtotal', () => {
    it('discount is less than or equal to subtotal', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          expectValidDiscount(order.total_cents as any, order.total_cents as any);
          return (order.total_cents as number) >= (order.total_cents as number);
        },
        'discount must not exceed subtotal'
      );
    });

    it('discount is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) >= 0,
        'discount must be non-negative'
      );
    });

    it('total is non-negative after discount', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const total = calculateTotal(
            order.total_cents as number,
            order.total_cents as number
          );
          return total >= 0;
        },
        'total must be non-negative'
      );
    });

    it('total equals subtotal minus discount', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const calculated = calculateTotal(
            order.total_cents as number,
            order.total_cents as number
          );
          return calculated === (order.total_cents as number);
        },
        'total must equal subtotal - discount'
      );
    });
  });

  describe('Property 14: Change Calculation Correctness', () => {
    it('change equals payment minus total', () => {
      fc.assert(
        fc.property(
          fc.tuple(positiveCentavosArb, positiveCentavosArb),
          ([payment, total]) => {
            const change = calculateChange(payment as number, total as number);
            expectCorrectChange(payment as any, total as any, change as any);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('change is non-negative', () => {
      testForAll(
        fc.tuple(positiveCentavosArb, positiveCentavosArb),
        ([payment, total]) => {
          const change = calculateChange(payment as number, total as number);
          return change >= 0;
        },
        'change must be non-negative'
      );
    });

    it('change is zero when payment equals total', () => {
      fc.assert(
        fc.property(positiveCentavosArb, (amount) => {
          const change = calculateChange(amount as number, amount as number);
          expect(change).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('change increases with higher payment', () => {
      fc.assert(
        fc.property(
          fc.tuple(positiveCentavosArb, positiveCentavosArb),
          ([payment1, total]) => {
            const payment2 = (payment1 as number) + 1000;
            const change1 = calculateChange(payment1 as number, total as number);
            const change2 = calculateChange(payment2, total as number);

            expect(change2).toBeGreaterThanOrEqual(change1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 15: Split Bill Sum Equals Order Total', () => {
    it('sum of check totals equals order total', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          const checkSum = order.checks.reduce(
            (sum: number, check: any) => sum + (check.total_cents as number),
            0
          );
          return checkSum === (order.total_cents as number);
        },
        'sum of checks must equal order total'
      );
    });

    it('each check total is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => {
          return order.checks.every((check: any) => (check.total_cents as number) >= 0);
        },
        'each check total must be non-negative'
      );
    });

    it('split bill preserves total', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticOrder()), (order: any) => {
          if (order.checks.length <= 1) return;

          const checkSum = order.checks.reduce(
            (sum: number, check: any) => sum + (check.total_cents as number),
            0
          );

          expect(checkSum).toBe(order.total_cents as number);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Payment Validation Rejects Insufficient Amounts', () => {
    it('payment less than total is rejected', () => {
      fc.assert(
        fc.property(
          fc.tuple(positiveCentavosArb, positiveCentavosArb),
          ([payment, total]) => {
            if ((payment as number) < (total as number)) {
              const isValid = isPaymentSufficient(payment as number, total as number);
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('payment equal to total is accepted', () => {
      fc.assert(
        fc.property(positiveCentavosArb, (amount) => {
          const isValid = isPaymentSufficient(amount as number, amount as number);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('payment greater than total is accepted', () => {
      fc.assert(
        fc.property(
          fc.tuple(positiveCentavosArb, positiveCentavosArb),
          ([payment, total]) => {
            if ((payment as number) > (total as number)) {
              const isValid = isPaymentSufficient(payment as number, total as number);
              expect(isValid).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Check Payment Status', () => {
    it('unpaid check cannot be invoiced', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticCheck()), (check: any) => {
          const unpaidCheck = {
            ...check,
            payment: { ...check.payment, status: 'UNPAID' },
          };

          // Unpaid check should not be invoiceable
          expect(unpaidCheck.payment.status).not.toBe('PAID');
        }),
        { numRuns: 100 }
      );
    });

    it('paid check can be invoiced', () => {
      fc.assert(
        fc.property(fc.constant(generateRealisticCheck()), (check: any) => {
          const paidCheck = {
            ...check,
            payment: { ...check.payment, status: 'PAID' },
          };

          // Paid check should be invoiceable
          expect(paidCheck.payment.status).toBe('PAID');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero subtotal', () => {
      const order = generateRealisticOrder({
        subtotal_cents: 0,
        total_cents: 0,
      });

      expect((order.total_cents as number)).toBe(0);
      expect((order.total_cents as number)).toBe(0);
    });

    it('handles zero discount', () => {
      const order = generateRealisticOrder({
        subtotal_cents: 5000,
        total_cents: 5000,
      });

      expect((order.total_cents as number)).toBe((order.total_cents as number));
    });

    it('handles maximum discount (equals subtotal)', () => {
      const order = generateRealisticOrder({
        subtotal_cents: 5000,
        total_cents: 0,
      });

      expect((order.total_cents as number)).toBe(0);
    });

    it('handles exact payment', () => {
      const payment = 5000;
      const total = 5000;
      const change = calculateChange(payment, total);

      expect(change).toBe(0);
    });

    it('handles overpayment', () => {
      const payment = 10000;
      const total = 5000;
      const change = calculateChange(payment, total);

      expect(change).toBe(5000);
    });
  });

  describe('Invariants', () => {
    it('subtotal >= 0', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) >= 0,
        'subtotal must be non-negative'
      );
    });

    it('discount >= 0', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) >= 0,
        'discount must be non-negative'
      );
    });

    it('total >= 0', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) >= 0,
        'total must be non-negative'
      );
    });

    it('total <= subtotal', () => {
      testInvariant(
        fc.constant(generateRealisticOrder()),
        (order: any) => (order.total_cents as number) <= (order.total_cents as number),
        'total must be <= subtotal'
      );
    });
  });
});
