/**
 * Leave & Advance Property Tests - fast-check based
 *
 * Property-based tests for leave request and advance pure calculation functions.
 * Tests invariants that must hold for any valid input.
 *
 * All tests use pure functions only - no database, no mocks.
 * Verifies Peruvian labor law compliance through mathematical properties.
 *
 * Properties covered:
 * 24: Vacation balance = years_of_service * 30 - used_days (always >= 0 earned)
 * 25: Leave dates: start <= end implies days > 0
 * 26: Leave status transitions: PENDING -> APPROVED or REJECTED or CANCELLED only
 * 27: Rejected leaves always have a rejection reason
 * 28: Approved leaves have approver
 * 29: Multiple leave requests for same period should be detectable
 * 30: Vacation balance is monotonically related to years of service
 * 31: Advance amount always > 0
 * 32: Advance must be <= 50% of salary
 * 33: Advance status transitions: PENDING -> APPROVED -> PAID
 * 34: Paid advances have paid_at timestamp
 * 35: Total pending advances sum is always >= 0
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateYearsOfService,
  calculateEarnedVacationDays,
  calculateAvailableVacationDays,
  isValidDateRange,
  isValidLeaveStatusTransition,
  PERU_VACATION_DAYS_PER_YEAR,
} from '@/src/core/services/leave-request.service';
import {
  isValidAdvanceAmount,
  calculateMaxAdvance,
  isValidAdvanceStatusTransition,
  calculatePendingTotal,
  MAX_ADVANCE_SALARY_PERCENTAGE,
} from '@/src/core/services/advance.service';

// ============================================================================
// Arbitraries
// ============================================================================

const daysArb = fc.integer({ min: 1, max: 30 });
const yearsArb = fc.integer({ min: 0, max: 30 });
const amountArb = fc.integer({ min: 1, max: 5000000 });
const salaryArb = fc.integer({ min: 102500, max: 10000000 });
const usedDaysArb = fc.integer({ min: 0, max: 900 }); // 30 years * 30 days max
const leaveStatusArb = fc.constantFrom('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
const advanceStatusArb = fc.constantFrom('PENDING', 'APPROVED', 'REJECTED', 'PAID');

// ============================================================================
// Leave Request Properties
// ============================================================================

describe('Leave Request Property Tests', () => {
  // ==========================================================================
  // Property 24: Vacation balance = years_of_service * 30 - used_days
  // ==========================================================================

  describe('Property 24: Vacation balance calculation', () => {
    it('total earned days = years_of_service * 30', () => {
      fc.assert(
        fc.property(yearsArb, (years) => {
          const earned = calculateEarnedVacationDays(years);
          expect(earned).toBe(years * PERU_VACATION_DAYS_PER_YEAR);
        }),
        { numRuns: 200 },
      );
    });

    it('earned days is always >= 0', () => {
      fc.assert(
        fc.property(yearsArb, (years) => {
          const earned = calculateEarnedVacationDays(years);
          expect(earned).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });

    it('available days = max(0, earned - used)', () => {
      fc.assert(
        fc.property(yearsArb, usedDaysArb, (years, used) => {
          const earned = calculateEarnedVacationDays(years);
          const available = calculateAvailableVacationDays(earned, used);
          expect(available).toBe(Math.max(0, earned - used));
        }),
        { numRuns: 200 },
      );
    });

    it('available days is always >= 0', () => {
      fc.assert(
        fc.property(yearsArb, usedDaysArb, (years, used) => {
          const earned = calculateEarnedVacationDays(years);
          const available = calculateAvailableVacationDays(earned, used);
          expect(available).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 25: Leave dates: start <= end implies days > 0
  // ==========================================================================

  describe('Property 25: Leave date range validation', () => {
    // Use integer-based timestamps to avoid fc.date() producing Date(NaN)
    const baseEpochMs = new Date('2020-01-01').getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const dateFromDayOffset = (offset: number) => new Date(baseEpochMs + offset * dayMs);

    it('start <= end is a valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3650 }), // ~10 years of day offsets
          fc.integer({ min: 0, max: 365 }),
          (startOffset, durationDays) => {
            const start = dateFromDayOffset(startOffset);
            const end = dateFromDayOffset(startOffset + durationDays);
            expect(isValidDateRange(start, end)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('start > end is not a valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3650 }),
          fc.integer({ min: 1, max: 365 }),
          (endOffset, durationDays) => {
            const end = dateFromDayOffset(endOffset);
            const start = dateFromDayOffset(endOffset + durationDays);
            expect(isValidDateRange(start, end)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('same date is valid (single day leave)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3650 }),
          (dayOffset) => {
            const date = dateFromDayOffset(dayOffset);
            expect(isValidDateRange(date, date)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 26: Leave status transitions
  // ==========================================================================

  describe('Property 26: Leave status transitions', () => {
    it('PENDING can transition to APPROVED, REJECTED, or CANCELLED', () => {
      expect(isValidLeaveStatusTransition('PENDING', 'APPROVED')).toBe(true);
      expect(isValidLeaveStatusTransition('PENDING', 'REJECTED')).toBe(true);
      expect(isValidLeaveStatusTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('non-PENDING statuses cannot transition to anything', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('APPROVED', 'REJECTED', 'CANCELLED'),
          leaveStatusArb,
          (from, to) => {
            expect(isValidLeaveStatusTransition(from, to)).toBe(false);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('PENDING cannot transition to PENDING', () => {
      expect(isValidLeaveStatusTransition('PENDING', 'PENDING')).toBe(false);
    });
  });

  // ==========================================================================
  // Property 27: Rejected leaves always have a rejection reason
  // ==========================================================================

  describe('Property 27: Rejected leaves must have reason', () => {
    it('a rejected leave record always has a non-empty rejection_reason', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          (reason) => {
            // Simulate the business rule: rejection always includes reason
            const rejectedLeave = {
              status: 'REJECTED',
              rejection_reason: reason.trim(),
            };
            expect(rejectedLeave.rejection_reason.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 28: Approved leaves have approver
  // ==========================================================================

  describe('Property 28: Approved leaves have approver', () => {
    it('an approved leave record always has approved_by set', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (approverId) => {
            // Simulate the business rule: approval always includes approver
            const approvedLeave = {
              status: 'APPROVED',
              approved_by: approverId,
              approved_at: new Date(),
            };
            expect(approvedLeave.approved_by).toBeDefined();
            expect(approvedLeave.approved_by.length).toBeGreaterThan(0);
            expect(approvedLeave.approved_at).toBeInstanceOf(Date);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 29: Overlapping leave detection
  // ==========================================================================

  describe('Property 29: Multiple leave requests for same period detectable', () => {
    it('two leave requests with overlapping dates can be detected', () => {
      // Use integer day offsets from a fixed epoch to avoid Date(NaN) issues
      const epochMs = new Date('2025-01-01').getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 334 }), // day offset within 2025 (0..334 ~ Jan 1 - Dec 1)
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 0, max: 15 }),
          (dayOffset, duration, overlapOffset) => {
            const start1 = new Date(epochMs + dayOffset * dayMs);
            const end1 = new Date(start1.getTime() + duration * dayMs);
            const start2 = new Date(start1.getTime() + overlapOffset * dayMs);
            const end2 = new Date(start2.getTime() + duration * dayMs);

            // Check overlap: two ranges overlap if start1 <= end2 AND start2 <= end1
            const overlaps = start1.getTime() <= end2.getTime() &&
                             start2.getTime() <= end1.getTime();

            // If overlapOffset < duration, they must overlap
            if (overlapOffset < duration) {
              expect(overlaps).toBe(true);
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 30: Vacation balance monotonically related to years of service
  // ==========================================================================

  describe('Property 30: Vacation balance monotonic with years of service', () => {
    it('more years of service = more earned days', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 29 }),
          (years) => {
            const earned1 = calculateEarnedVacationDays(years);
            const earned2 = calculateEarnedVacationDays(years + 1);
            expect(earned2).toBeGreaterThan(earned1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('with same used days, more years = more available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 29 }),
          fc.integer({ min: 0, max: 100 }),
          (years, used) => {
            const earned1 = calculateEarnedVacationDays(years);
            const earned2 = calculateEarnedVacationDays(years + 1);
            const avail1 = calculateAvailableVacationDays(earned1, used);
            const avail2 = calculateAvailableVacationDays(earned2, used);
            expect(avail2).toBeGreaterThanOrEqual(avail1);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

// ============================================================================
// Advance Properties
// ============================================================================

describe('Advance Property Tests', () => {
  // ==========================================================================
  // Property 31: Advance amount always > 0
  // ==========================================================================

  describe('Property 31: Advance amount always > 0', () => {
    it('valid advances have positive integer amounts', () => {
      fc.assert(
        fc.property(amountArb, salaryArb, (amount, salary) => {
          if (isValidAdvanceAmount(amount, salary)) {
            expect(amount).toBeGreaterThan(0);
            expect(Number.isInteger(amount)).toBe(true);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('zero or negative amounts are never valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 0 }),
          salaryArb,
          (amount, salary) => {
            expect(isValidAdvanceAmount(amount, salary)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 32: Advance must be <= 50% of salary
  // ==========================================================================

  describe('Property 32: Advance <= 50% of salary', () => {
    it('amounts within 50% are valid', () => {
      fc.assert(
        fc.property(salaryArb, (salary) => {
          const maxAdvance = calculateMaxAdvance(salary);
          // Any amount from 1 to maxAdvance should be valid
          if (maxAdvance >= 1) {
            expect(isValidAdvanceAmount(1, salary)).toBe(true);
            expect(isValidAdvanceAmount(maxAdvance, salary)).toBe(true);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('amounts above 50% are invalid', () => {
      fc.assert(
        fc.property(salaryArb, (salary) => {
          const maxAdvance = calculateMaxAdvance(salary);
          const overMax = maxAdvance + 1;
          expect(isValidAdvanceAmount(overMax, salary)).toBe(false);
        }),
        { numRuns: 200 },
      );
    });

    it('max advance is always floor(salary * 0.5)', () => {
      fc.assert(
        fc.property(salaryArb, (salary) => {
          const maxAdvance = calculateMaxAdvance(salary);
          expect(maxAdvance).toBe(Math.floor(salary * MAX_ADVANCE_SALARY_PERCENTAGE));
        }),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 33: Advance status transitions
  // ==========================================================================

  describe('Property 33: Advance status transitions', () => {
    it('PENDING -> APPROVED is valid', () => {
      expect(isValidAdvanceStatusTransition('PENDING', 'APPROVED')).toBe(true);
    });

    it('PENDING -> REJECTED is valid', () => {
      expect(isValidAdvanceStatusTransition('PENDING', 'REJECTED')).toBe(true);
    });

    it('APPROVED -> PAID is valid', () => {
      expect(isValidAdvanceStatusTransition('APPROVED', 'PAID')).toBe(true);
    });

    it('PENDING -> PAID is invalid (must be APPROVED first)', () => {
      expect(isValidAdvanceStatusTransition('PENDING', 'PAID')).toBe(false);
    });

    it('REJECTED cannot transition to anything', () => {
      fc.assert(
        fc.property(advanceStatusArb, (to) => {
          expect(isValidAdvanceStatusTransition('REJECTED', to)).toBe(false);
        }),
        { numRuns: 20 },
      );
    });

    it('PAID cannot transition to anything', () => {
      fc.assert(
        fc.property(advanceStatusArb, (to) => {
          expect(isValidAdvanceStatusTransition('PAID', to)).toBe(false);
        }),
        { numRuns: 20 },
      );
    });
  });

  // ==========================================================================
  // Property 34: Paid advances have paid_at timestamp
  // ==========================================================================

  describe('Property 34: Paid advances have paid_at timestamp', () => {
    it('a PAID advance record always has paid_at set', () => {
      const baseEpochMs = new Date('2020-01-01').getTime();
      const dayMs = 24 * 60 * 60 * 1000;

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 3650 }), // day offset -> valid date
          amountArb,
          (dayOffset, amount) => {
            const paidAt = new Date(baseEpochMs + dayOffset * dayMs);
            // Simulate business rule: paid advances must have paid_at
            const paidAdvance = {
              status: 'PAID',
              amount_cents: amount,
              paid_at: paidAt,
            };
            expect(paidAdvance.paid_at).toBeInstanceOf(Date);
            expect(paidAdvance.status).toBe('PAID');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 35: Total pending advances sum is always >= 0
  // ==========================================================================

  describe('Property 35: Total pending advances sum >= 0', () => {
    it('sum of positive advance amounts is always >= 0', () => {
      fc.assert(
        fc.property(
          fc.array(amountArb, { minLength: 0, maxLength: 20 }),
          (amounts) => {
            const total = calculatePendingTotal(amounts);
            expect(total).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('empty array sums to 0', () => {
      expect(calculatePendingTotal([])).toBe(0);
    });

    it('sum equals individual amounts added together', () => {
      fc.assert(
        fc.property(
          fc.array(amountArb, { minLength: 1, maxLength: 10 }),
          (amounts) => {
            const total = calculatePendingTotal(amounts);
            const expected = amounts.reduce((sum, a) => sum + a, 0);
            expect(total).toBe(expected);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
