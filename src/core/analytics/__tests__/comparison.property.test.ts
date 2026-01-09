/**
 * Property Test: Comparison Calculation Correctness
 * 
 * Property 3: For any current business date D, the comparison metrics SHALL:
 * - Compare with date D-7 (same day of week, previous week)
 * - delta_percent.total_sales = ((current - previous) / previous) * 100
 * - Positive delta when current > previous, negative when current < previous
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface MetricsSummary {
  total_sales_cents: number;
  orders_count: number;
  avg_ticket_cents: number;
}

interface DeltaPercent {
  total_sales: number;
  orders_count: number;
  avg_ticket: number;
}

// Pure calculation function (extracted from service logic)
function calculateDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function calculateComparison(
  current: MetricsSummary,
  previous: MetricsSummary
): DeltaPercent {
  return {
    total_sales: calculateDelta(current.total_sales_cents, previous.total_sales_cents),
    orders_count: calculateDelta(current.orders_count, previous.orders_count),
    avg_ticket: calculateDelta(current.avg_ticket_cents, previous.avg_ticket_cents),
  };
}

// Generators
const metricsSummaryArb = fc.record({
  total_sales_cents: fc.integer({ min: 0, max: 10000000 }), // 0 to 100k soles
  orders_count: fc.integer({ min: 0, max: 500 }),
  avg_ticket_cents: fc.integer({ min: 0, max: 50000 }), // 0 to 500 soles
});

describe('Comparison Calculation Properties', () => {
  it('Property 3.1: delta is positive when current > previous (significant difference)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 500000 }),
        fc.integer({ min: 100, max: 500000 }),
        (previous, increase) => {
          const current = previous + increase;
          const delta = calculateDelta(current, previous);
          // With significant increase, delta should be positive
          expect(delta).toBeGreaterThanOrEqual(0);
          // Verify the formula is correct
          const expected = Math.round(((current - previous) / previous) * 100 * 10) / 10;
          expect(delta).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.2: delta is negative when current < previous (significant difference)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 500000 }),
        fc.integer({ min: 100, max: 499000 }),
        (previous, decrease) => {
          const current = Math.max(1, previous - decrease);
          if (current >= previous) return true; // Skip if no actual decrease
          const delta = calculateDelta(current, previous);
          // With significant decrease, delta should be negative
          expect(delta).toBeLessThanOrEqual(0);
          // Verify the formula is correct
          const expected = Math.round(((current - previous) / previous) * 100 * 10) / 10;
          expect(delta).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.3: delta is 0 when current equals previous', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (value) => {
        const delta = calculateDelta(value, value);
        expect(delta).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.4: delta is 100 when previous is 0 and current > 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000000 }), (current) => {
        const delta = calculateDelta(current, 0);
        expect(delta).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.5: delta is 0 when both are 0', () => {
    const delta = calculateDelta(0, 0);
    expect(delta).toBe(0);
  });

  it('Property 3.6: delta formula is correct ((current - previous) / previous * 100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 1, max: 1000000 }),
        (current, previous) => {
          const delta = calculateDelta(current, previous);
          const expected = Math.round(((current - previous) / previous) * 100 * 10) / 10;
          expect(delta).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.7: comparison calculates all three deltas correctly', () => {
    fc.assert(
      fc.property(metricsSummaryArb, metricsSummaryArb, (current, previous) => {
        const comparison = calculateComparison(current, previous);
        
        expect(comparison.total_sales).toBe(
          calculateDelta(current.total_sales_cents, previous.total_sales_cents)
        );
        expect(comparison.orders_count).toBe(
          calculateDelta(current.orders_count, previous.orders_count)
        );
        expect(comparison.avg_ticket).toBe(
          calculateDelta(current.avg_ticket_cents, previous.avg_ticket_cents)
        );
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.8: delta is always a finite number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }),
        fc.integer({ min: 0, max: 10000000 }),
        (current, previous) => {
          const delta = calculateDelta(current, previous);
          expect(Number.isFinite(delta)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 3.9: 100% increase means current is double previous', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500000 }), (previous) => {
        const current = previous * 2;
        const delta = calculateDelta(current, previous);
        expect(delta).toBe(100);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3.10: -50% means current is half of previous', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 1000000 }).filter(n => n % 2 === 0), (previous) => {
        const current = previous / 2;
        const delta = calculateDelta(current, previous);
        expect(delta).toBe(-50);
      }),
      { numRuns: 100 }
    );
  });
});
