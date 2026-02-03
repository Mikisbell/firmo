/**
 * Money Calculation Property Tests
 * 
 * Tests money arithmetic operations maintain invariants:
 * - Addition/subtraction preserve integer type
 * - Multiplication/division round correctly
 * - Conversion to/from display format is lossless
 * - Formatting produces consistent output
 * 
 * **Validates: Requirements 1.1, 1.2, 1.5, 1.6**
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { cents, add, sub, mul, formatCents, parseMoneyToCents } from '@/src/core/domain/money';
import {
  centavosArb,
  smallCentavosArb,
  positiveCentavosArb,
  quantityArb,
} from '@/src/test-utils';
import {
  testRoundTrip,
  testInvariant,
  testCommutativity,
  testAssociativity,
} from '@/src/test-utils';
import {
  expectCentavos,
  expectPositiveCentavos,
} from '@/src/test-utils';

describe('Money Calculation - Property Tests', () => {
  describe('Property 1: Money Arithmetic Preserves Integer Invariant', () => {
    it('addition preserves integer type', () => {
      fc.assert(
        fc.property(centavosArb, centavosArb, (a, b) => {
          const result = add(a, b);
          expectCentavos(result);
        }),
        { numRuns: 100 }
      );
    });

    it('subtraction preserves integer type', () => {
      fc.assert(
        fc.property(centavosArb, centavosArb, (a, b) => {
          // Only test when a >= b to avoid negative results
          if ((a as number) >= (b as number)) {
            const result = sub(a, b);
            expectCentavos(result);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('multiplication preserves integer type', () => {
      fc.assert(
        fc.property(centavosArb, quantityArb, (a, qty) => {
          const result = mul(a, qty);
          expectCentavos(result);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Centavos Round-Trip Consistency', () => {
    it('format → parse round-trip is lossless', () => {
      testRoundTrip(
        smallCentavosArb,
        (c) => formatCents(c),
        (s) => parseMoneyToCents(s),
        (a, b) => (a as number) === (b as number)
      );
    });

    it('parse → format round-trip is lossless', () => {
      // Generate valid money strings
      const moneyStringArb = fc
        .tuple(
          fc.integer({ min: 0, max: 999 }),
          fc.integer({ min: 0, max: 99 })
        )
        .map(([i, d]) => `${i}.${String(d).padStart(2, '0')}`);

      testRoundTrip(
        moneyStringArb,
        (s) => formatCents(parseMoneyToCents(s)),
        (s) => s,
        (a, b) => a === b
      );
    });
  });

  describe('Property 4: Money Formatting Determinism', () => {
    it('formatting produces consistent output', () => {
      fc.assert(
        fc.property(centavosArb, (c) => {
          const format1 = formatCents(c);
          const format2 = formatCents(c);
          const format3 = formatCents(c);
          if (format1 !== format2 || format2 !== format3) {
            throw new Error(
              `Formatting not deterministic: ${format1} !== ${format2} !== ${format3}`
            );
          }
        }),
        { numRuns: 100 }
      );
    });

    it('formatting produces valid format (N.DD)', () => {
      fc.assert(
        fc.property(centavosArb, (c) => {
          const formatted = formatCents(c);
          if (!/^-?\d+\.\d{2}$/.test(formatted)) {
            throw new Error(`Invalid format: ${formatted}`);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 1.5: Money Arithmetic Results Are Non-Negative', () => {
    it('addition result is non-negative', () => {
      testInvariant(
        fc.tuple(centavosArb, centavosArb),
        ([a, b]) => (add(a, b) as number) >= 0,
        'Addition result must be non-negative'
      );
    });

    it('multiplication result is non-negative', () => {
      testInvariant(
        fc.tuple(centavosArb, quantityArb),
        ([a, qty]) => (mul(a, qty) as number) >= 0,
        'Multiplication result must be non-negative'
      );
    });
  });

  describe('Commutativity: Addition is Commutative', () => {
    it('a + b === b + a', () => {
      testCommutativity(
        centavosArb,
        centavosArb,
        (a, b) => add(a, b),
        (a, b) => (a as number) === (b as number)
      );
    });
  });

  describe('Associativity: Addition is Associative', () => {
    it('(a + b) + c === a + (b + c)', () => {
      testAssociativity(
        centavosArb,
        centavosArb,
        centavosArb,
        (a, b) => add(a, b),
        (a, b) => (a as number) === (b as number)
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero values', () => {
      const zero = cents(0);
      expectCentavos(zero);
      expect((zero as number)).toBe(0);
    });

    it('handles large values', () => {
      const large = cents(10_000_000);
      expectCentavos(large);
      expect((large as number)).toBe(10_000_000);
    });

    it('formatting zero produces "0.00"', () => {
      expect(formatCents(cents(0))).toBe('0.00');
    });

    it('formatting handles cents correctly', () => {
      expect(formatCents(cents(1))).toBe('0.01');
      expect(formatCents(cents(99))).toBe('0.99');
      expect(formatCents(cents(100))).toBe('1.00');
      expect(formatCents(cents(2550))).toBe('25.50');
    });
  });
});
