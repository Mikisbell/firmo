/**
 * Evaluation & Training Property Tests - fast-check based
 *
 * Property-based tests for evaluation and training pure calculation functions.
 * Tests invariants that must hold for any valid input.
 *
 * All tests use pure functions only - no database, no mocks.
 * Properties 36-45.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateAverageScores,
  validateScores,
} from '@/src/core/services/evaluation.service';
import {
  isTrainingExpired,
  calculateCompletionRate,
} from '@/src/core/services/training.service';

// ============================================================================
// Arbitraries
// ============================================================================

/** Score value between 1 and 5 */
const scoreArb = fc.integer({ min: 1, max: 5 });

/** Dictionary of scores with non-empty string keys and valid score values */
const scoresArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && s !== '__proto__' && s !== 'constructor' && s !== 'prototype'),
  scoreArb,
  { minKeys: 1, maxKeys: 10 },
);

/** Months of validity for training */
const monthsArb = fc.integer({ min: 1, max: 120 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Evaluation & Training Property Tests', () => {

  // ==========================================================================
  // Property 36: calculateAverageScores returns value between min and max score
  // ==========================================================================

  describe('Property 36: calculateAverageScores returns value between min and max score', () => {
    it('average is always between the minimum and maximum score values', () => {
      fc.assert(
        fc.property(scoresArb, (scores) => {
          const values = Object.values(scores);
          const avg = calculateAverageScores(scores);
          const min = Math.min(...values);
          const max = Math.max(...values);

          expect(avg).toBeGreaterThanOrEqual(min);
          expect(avg).toBeLessThanOrEqual(max);
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 37: calculateAverageScores with single score returns that score
  // ==========================================================================

  describe('Property 37: calculateAverageScores with single score returns that score', () => {
    it('single-entry scores returns the score itself', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          scoreArb,
          (key, value) => {
            const scores = { [key]: value };
            expect(calculateAverageScores(scores)).toBe(value);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 38: validateScores accepts valid scores (all 1-5)
  // ==========================================================================

  describe('Property 38: validateScores accepts valid scores (all 1-5)', () => {
    it('scores with all values in [1,5] are valid', () => {
      fc.assert(
        fc.property(scoresArb, (scores) => {
          expect(validateScores(scores)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 39: validateScores rejects scores outside 1-5
  // ==========================================================================

  describe('Property 39: validateScores rejects scores outside 1-5', () => {
    it('scores with any value outside [1,5] are invalid', () => {
      const invalidScoreArb = fc.oneof(
        fc.integer({ min: -100, max: 0 }),
        fc.integer({ min: 6, max: 100 }),
      );

      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          invalidScoreArb,
          (key, value) => {
            const scores = { [key]: value };
            expect(validateScores(scores)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 40: Average score is symmetric (order doesn't matter)
  // ==========================================================================

  describe('Property 40: Average score is symmetric (order doesn\'t matter)', () => {
    it('calculating average with different key orderings yields same result', () => {
      fc.assert(
        fc.property(scoresArb, (scores) => {
          // Build a new object with reversed key order
          const keys = Object.keys(scores);
          const reversed: Record<string, number> = {};
          for (let i = keys.length - 1; i >= 0; i--) {
            reversed[keys[i]] = scores[keys[i]];
          }

          expect(calculateAverageScores(scores)).toBe(calculateAverageScores(reversed));
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 41: Empty scores gives 0 average
  // ==========================================================================

  describe('Property 41: Empty scores gives 0 average', () => {
    it('empty object always returns 0', () => {
      expect(calculateAverageScores({})).toBe(0);
    });
  });

  // ==========================================================================
  // Property 42: isTrainingExpired - recently completed training is not expired
  // ==========================================================================

  describe('Property 42: isTrainingExpired - recently completed training is not expired', () => {
    it('training completed today with any positive validity months is not expired', () => {
      fc.assert(
        fc.property(monthsArb, (months) => {
          const today = new Date();
          expect(isTrainingExpired(today, months)).toBe(false);
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 43: isTrainingExpired - very old training is expired
  // ==========================================================================

  describe('Property 43: isTrainingExpired - very old training is expired', () => {
    it('training completed 20 years ago with any validity <= 120 months is expired', () => {
      fc.assert(
        fc.property(monthsArb, (months) => {
          const twentyYearsAgo = new Date();
          twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
          expect(isTrainingExpired(twentyYearsAgo, months)).toBe(true);
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 44: calculateCompletionRate - always between 0 and 100
  // ==========================================================================

  describe('Property 44: calculateCompletionRate - always between 0 and 100', () => {
    it('completion rate is between 0 and 100 when completed <= required', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (completed, required) => {
            // Ensure completed <= required for this property
            const actual = Math.min(completed, required);
            const rate = calculateCompletionRate(actual, required);
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(100);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 45: calculateCompletionRate - completed >= required gives >= 100
  // ==========================================================================

  describe('Property 45: calculateCompletionRate - completed >= required gives >= 100', () => {
    it('when completed >= required, rate is >= 100', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          (required, extra) => {
            const completed = required + extra;
            const rate = calculateCompletionRate(completed, required);
            expect(rate).toBeGreaterThanOrEqual(100);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
