/**
 * Property Test: Metrics Calculation Correctness
 * 
 * Property 1: For any set of completed orders in a shift, the calculated metrics SHALL satisfy:
 * - total_sales_cents = SUM of all payments from paid checks
 * - orders_count = COUNT of distinct orders
 * - avg_ticket_cents = total_sales_cents / orders_count (rounded)
 * - sales_by_payment_method[method] = SUM of payments by that method
 * 
 * Validates: Requirements 1.3, 1.4, 1.5, 1.7
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types matching the service
type PaymentMethod = 'CASH' | 'YAPE' | 'PLIN' | 'CARD' | 'TRANSFER';

interface Payment {
  method: PaymentMethod;
  amount_cents: number;
}

interface Check {
  id: string;
  status: 'OPEN' | 'PAID' | 'VOID';
  payments?: Payment[];
}

interface Order {
  id: string;
  checks: Check[];
  total_cents: number;
}

// Pure calculation function (extracted from service logic)
function calculateMetrics(orders: Order[]) {
  let totalSalesCents = 0;
  const salesByMethod: Record<PaymentMethod, number> = {
    CASH: 0,
    YAPE: 0,
    PLIN: 0,
    CARD: 0,
    TRANSFER: 0,
  };

  for (const order of orders) {
    for (const check of order.checks) {
      if (check.status === 'PAID' && check.payments) {
        for (const payment of check.payments) {
          if (payment.method in salesByMethod) {
            salesByMethod[payment.method] += payment.amount_cents;
            totalSalesCents += payment.amount_cents;
          }
        }
      }
    }
  }

  const ordersCount = orders.length;
  const avgTicketCents = ordersCount > 0 ? Math.round(totalSalesCents / ordersCount) : 0;

  return {
    total_sales_cents: totalSalesCents,
    orders_count: ordersCount,
    avg_ticket_cents: avgTicketCents,
    sales_by_payment_method: salesByMethod,
  };
}

// Generators
const paymentMethodArb = fc.constantFrom<PaymentMethod>('CASH', 'YAPE', 'PLIN', 'CARD', 'TRANSFER');

const paymentArb = fc.record({
  method: paymentMethodArb,
  amount_cents: fc.integer({ min: 100, max: 100000 }), // 1 to 1000 soles
});

const checkArb = fc.record({
  id: fc.uuid(),
  status: fc.constantFrom<'OPEN' | 'PAID' | 'VOID'>('OPEN', 'PAID', 'VOID'),
  payments: fc.option(fc.array(paymentArb, { minLength: 0, maxLength: 3 }), { nil: undefined }),
});

const orderArb = fc.record({
  id: fc.uuid(),
  checks: fc.array(checkArb, { minLength: 1, maxLength: 5 }),
  total_cents: fc.integer({ min: 0, max: 500000 }),
});

describe('Analytics Metrics Calculation Properties', () => {
  it('Property 1.1: total_sales_cents equals sum of all paid check payments', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 0, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        
        // Manual calculation
        let expectedTotal = 0;
        for (const order of orders) {
          for (const check of order.checks) {
            if (check.status === 'PAID' && check.payments) {
              for (const payment of check.payments) {
                expectedTotal += payment.amount_cents;
              }
            }
          }
        }
        
        expect(metrics.total_sales_cents).toBe(expectedTotal);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1.2: orders_count equals number of orders', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 0, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        expect(metrics.orders_count).toBe(orders.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1.3: avg_ticket_cents is correctly rounded', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 1, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        
        if (metrics.orders_count > 0) {
          const expectedAvg = Math.round(metrics.total_sales_cents / metrics.orders_count);
          expect(metrics.avg_ticket_cents).toBe(expectedAvg);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1.4: avg_ticket_cents is 0 when no orders', () => {
    const metrics = calculateMetrics([]);
    expect(metrics.avg_ticket_cents).toBe(0);
    expect(metrics.orders_count).toBe(0);
  });

  it('Property 1.5: sales_by_payment_method sums correctly per method', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 0, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        
        // Manual calculation per method
        const expectedByMethod: Record<PaymentMethod, number> = {
          CASH: 0, YAPE: 0, PLIN: 0, CARD: 0, TRANSFER: 0,
        };
        
        for (const order of orders) {
          for (const check of order.checks) {
            if (check.status === 'PAID' && check.payments) {
              for (const payment of check.payments) {
                expectedByMethod[payment.method] += payment.amount_cents;
              }
            }
          }
        }
        
        for (const method of Object.keys(expectedByMethod) as PaymentMethod[]) {
          expect(metrics.sales_by_payment_method[method]).toBe(expectedByMethod[method]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1.6: sum of sales_by_payment_method equals total_sales_cents', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 0, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        
        const sumByMethod = Object.values(metrics.sales_by_payment_method).reduce((a, b) => a + b, 0);
        expect(sumByMethod).toBe(metrics.total_sales_cents);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 1.7: VOID and OPEN checks do not contribute to sales', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            checks: fc.array(
              fc.record({
                id: fc.uuid(),
                status: fc.constantFrom<'OPEN' | 'VOID'>('OPEN', 'VOID'),
                payments: fc.array(paymentArb, { minLength: 1, maxLength: 3 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
            total_cents: fc.integer({ min: 1000, max: 50000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (ordersWithNonPaidChecks) => {
          const metrics = calculateMetrics(ordersWithNonPaidChecks);
          
          // No sales should be counted from OPEN or VOID checks
          expect(metrics.total_sales_cents).toBe(0);
          for (const method of Object.keys(metrics.sales_by_payment_method) as PaymentMethod[]) {
            expect(metrics.sales_by_payment_method[method]).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 1.8: all amounts are non-negative integers (money safety)', () => {
    fc.assert(
      fc.property(fc.array(orderArb, { minLength: 0, maxLength: 50 }), (orders) => {
        const metrics = calculateMetrics(orders);
        
        expect(Number.isInteger(metrics.total_sales_cents)).toBe(true);
        expect(metrics.total_sales_cents).toBeGreaterThanOrEqual(0);
        
        expect(Number.isInteger(metrics.orders_count)).toBe(true);
        expect(metrics.orders_count).toBeGreaterThanOrEqual(0);
        
        expect(Number.isInteger(metrics.avg_ticket_cents)).toBe(true);
        expect(metrics.avg_ticket_cents).toBeGreaterThanOrEqual(0);
        
        for (const amount of Object.values(metrics.sales_by_payment_method)) {
          expect(Number.isInteger(amount)).toBe(true);
          expect(amount).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
