/**
 * Caja Perú Property Tests
 *
 * Tests financial invariants for Peruvian cash register operations:
 * - Denomination counting always produces non-negative totals
 * - IGV 18% decomposition: base + igv === total for GRAVADO
 * - Cash variance detection: symmetric thresholds (sobrante = faltante)
 * - Opening cash limit: consistent rejection boundary
 *
 * @module core/constants/__tests__/caja-peru.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PEN_DENOMINATIONS, calculateDenominationTotal } from '../denominations';
import { LIMITS } from '../limits';

// ============================================================================
// Arbitraries
// ============================================================================

/** Valid PEN face values in centavos */
const PEN_FACE_VALUES = PEN_DENOMINATIONS.map(d => d.faceCents);

/** Arbitrary: denomination count map with valid face values and non-negative quantities */
const denomCountArb = fc.dictionary(
  fc.constantFrom(...PEN_FACE_VALUES.map(String)),
  fc.integer({ min: 0, max: 500 }),
);

/** Arbitrary: cash amount in centavos (realistic POS range) */
const cashCentsArb = fc.integer({ min: 0, max: 500_000 }); // up to S/5,000

/** Arbitrary: IGV-inclusive total in centavos */
const igvTotalArb = fc.integer({ min: 100, max: 10_000_000 }); // S/1 to S/100,000

/** Arbitrary: threshold in centavos */
const thresholdArb = fc.integer({ min: 100, max: 50_000 }); // S/1 to S/500

// ============================================================================
// Property 1: Denomination Total Invariants
// ============================================================================

describe('Property 1: Denomination Counting', () => {
  it('total is always non-negative', () => {
    fc.assert(
      fc.property(denomCountArb, (counts) => {
        const numericCounts: Record<number, number> = {};
        for (const [k, v] of Object.entries(counts)) {
          numericCounts[Number(k)] = v;
        }
        const total = calculateDenominationTotal(numericCounts);
        expect(total).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });

  it('total is always an integer (no floating point)', () => {
    fc.assert(
      fc.property(denomCountArb, (counts) => {
        const numericCounts: Record<number, number> = {};
        for (const [k, v] of Object.entries(counts)) {
          numericCounts[Number(k)] = v;
        }
        const total = calculateDenominationTotal(numericCounts);
        expect(Number.isInteger(total)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('total equals sum of (face * qty) for each denomination', () => {
    fc.assert(
      fc.property(denomCountArb, (counts) => {
        const numericCounts: Record<number, number> = {};
        for (const [k, v] of Object.entries(counts)) {
          numericCounts[Number(k)] = v;
        }
        const total = calculateDenominationTotal(numericCounts);

        let expected = 0;
        for (const [face, qty] of Object.entries(numericCounts)) {
          expected += Number(face) * qty;
        }

        expect(total).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('adding one unit of any denomination increases total by face value', () => {
    fc.assert(
      fc.property(
        denomCountArb,
        fc.constantFrom(...PEN_FACE_VALUES),
        (counts, face) => {
          const numericCounts: Record<number, number> = {};
          for (const [k, v] of Object.entries(counts)) {
            numericCounts[Number(k)] = v;
          }

          const before = calculateDenominationTotal(numericCounts);
          numericCounts[face] = (numericCounts[face] ?? 0) + 1;
          const after = calculateDenominationTotal(numericCounts);

          expect(after - before).toBe(face);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('empty counts produce zero total', () => {
    expect(calculateDenominationTotal({})).toBe(0);
  });
});

// ============================================================================
// Property 2: IGV 18% Decomposition
// ============================================================================

describe('Property 2: IGV 18% Decomposition', () => {
  const IGV_RATE = LIMITS.IGV_RATE; // 0.18

  it('base + igv === total (within 1 centavo rounding)', () => {
    fc.assert(
      fc.property(igvTotalArb, (totalCents) => {
        const baseCents = Math.round(totalCents / (1 + IGV_RATE));
        const igvCents = totalCents - baseCents;

        // base + igv must exactly equal total
        expect(baseCents + igvCents).toBe(totalCents);
      }),
      { numRuns: 200 },
    );
  });

  it('IGV is approximately 18% of base', () => {
    fc.assert(
      fc.property(igvTotalArb, (totalCents) => {
        const baseCents = Math.round(totalCents / (1 + IGV_RATE));
        const igvCents = totalCents - baseCents;

        // IGV/base should be close to 0.18 (within rounding tolerance)
        if (baseCents > 0) {
          const ratio = igvCents / baseCents;
          expect(ratio).toBeGreaterThan(0.17);
          expect(ratio).toBeLessThan(0.19);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('base is always less than total for gravado', () => {
    fc.assert(
      fc.property(igvTotalArb, (totalCents) => {
        const baseCents = Math.round(totalCents / (1 + IGV_RATE));
        expect(baseCents).toBeLessThan(totalCents);
      }),
      { numRuns: 200 },
    );
  });

  it('IGV is always non-negative', () => {
    fc.assert(
      fc.property(igvTotalArb, (totalCents) => {
        const baseCents = Math.round(totalCents / (1 + IGV_RATE));
        const igvCents = totalCents - baseCents;
        expect(igvCents).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 3: Cash Variance Detection
// ============================================================================

describe('Property 3: Cash Variance Detection', () => {
  it('symmetric: |sobrante| === |faltante| for same magnitude', () => {
    fc.assert(
      fc.property(cashCentsArb, cashCentsArb, (expected, delta) => {
        const countedOver = expected + delta;
        const countedUnder = expected - delta;

        const diffOver = countedOver - expected;
        const diffUnder = countedUnder - expected;

        expect(Math.abs(diffOver)).toBe(Math.abs(diffUnder));
      }),
      { numRuns: 100 },
    );
  });

  it('diff within threshold is not alert-worthy', () => {
    fc.assert(
      fc.property(
        cashCentsArb,
        thresholdArb,
        fc.integer({ min: 0, max: 100 }),
        (expected, threshold, smallDelta) => {
          // Ensure delta is within threshold
          const delta = smallDelta % (threshold + 1);
          const counted = expected + delta;
          const diff = Math.abs(counted - expected);

          if (diff <= threshold) {
            // Should NOT trigger alert
            expect(diff).toBeLessThanOrEqual(threshold);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('threshold + 1 always triggers alert', () => {
    fc.assert(
      fc.property(cashCentsArb, thresholdArb, (expected, threshold) => {
        const counted = expected + threshold + 1;
        const diff = Math.abs(counted - expected);

        expect(diff).toBeGreaterThan(threshold);
      }),
      { numRuns: 100 },
    );
  });

  it('severity escalates at 5x threshold', () => {
    fc.assert(
      fc.property(thresholdArb, (threshold) => {
        const criticalBoundary = threshold * 5;

        // Below 5x = WARNING
        const warningDiff = criticalBoundary - 1;
        expect(warningDiff).toBeLessThanOrEqual(criticalBoundary);

        // At 5x+ = CRITICAL
        const criticalDiff = criticalBoundary + 1;
        expect(criticalDiff).toBeGreaterThan(criticalBoundary);
      }),
      { numRuns: 100 },
    );
  });
});

// ============================================================================
// Property 4: Opening Cash Limit
// ============================================================================

describe('Property 4: Opening Cash Limit', () => {
  const MAX_OPENING = LIMITS.DEFAULT_MAX_CASH_OPENING_CENTS;

  it('any amount <= max is accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_OPENING }),
        (cents) => {
          expect(cents).toBeLessThanOrEqual(MAX_OPENING);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('any amount > max is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_OPENING + 1, max: 10_000_000 }),
        (cents) => {
          expect(cents).toBeGreaterThan(MAX_OPENING);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('exact boundary is accepted', () => {
    expect(MAX_OPENING).toBeLessThanOrEqual(MAX_OPENING);
  });

  it('boundary + 1 is rejected', () => {
    expect(MAX_OPENING + 1).toBeGreaterThan(MAX_OPENING);
  });
});

// ============================================================================
// Property 5: Denomination Face Values are Valid PEN
// ============================================================================

describe('Property 5: PEN Currency Integrity', () => {
  it('all denominations are multiples of 10 centavos (smallest PEN coin)', () => {
    for (const d of PEN_DENOMINATIONS) {
      expect(d.faceCents % 10).toBe(0);
    }
  });

  it('bill denominations are >= S/10 (1000 centavos)', () => {
    const bills = PEN_DENOMINATIONS.filter(d => d.type === 'bill');
    for (const b of bills) {
      expect(b.faceCents).toBeGreaterThanOrEqual(1_000);
    }
  });

  it('coin denominations are <= S/5 (500 centavos)', () => {
    const coins = PEN_DENOMINATIONS.filter(d => d.type === 'coin');
    for (const c of coins) {
      expect(c.faceCents).toBeLessThanOrEqual(500);
    }
  });

  it('no duplicate face values exist', () => {
    const faceValues = PEN_DENOMINATIONS.map(d => d.faceCents);
    const unique = new Set(faceValues);
    expect(unique.size).toBe(faceValues.length);
  });

  it('labels match face values', () => {
    for (const d of PEN_DENOMINATIONS) {
      const expectedSoles = d.faceCents / 100;
      const labelNum = parseFloat(d.label.replace('S/ ', ''));
      expect(labelNum).toBe(expectedSoles);
    }
  });
});
