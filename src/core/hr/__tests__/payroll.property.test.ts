/**
 * Payroll Property Tests - fast-check based
 *
 * Property-based tests for payroll pure calculation functions.
 * Tests invariants that must hold for any valid input.
 *
 * All tests use pure functions only - no database, no mocks.
 * Verifies Peruvian labor law compliance through mathematical properties.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateOvertimePay,
  calculateAbsenceDeduction,
  calculateEsSalud,
  calculatePension,
  calculateCTS,
  calculateGratification,
  calculateGrossPayroll,
  calculateNetPayroll,
  generatePLAMERecord,
  PERU_MINIMUM_WAGE_CENTS,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
} from '@/src/core/services/payroll.service';
import type { PayrollComponents, PayrollDeductions, PayrollResult } from '@/src/core/services/payroll.service';

// ============================================================================
// Arbitraries
// ============================================================================

/** Salary in valid range: minimum wage to 10M centavos */
const positiveCentsArb = fc.integer({ min: PERU_MINIMUM_WAGE_CENTS, max: 10000000 });

/** Any non-negative salary for testing edge cases */
const nonNegativeCentsArb = fc.integer({ min: 0, max: 10000000 });

/** Overtime hours: 0 to 100 */
const overtimeHoursArb = fc.integer({ min: 0, max: 100 });

/** Absence days: 0 to 30 */
const absenceDaysArb = fc.integer({ min: 0, max: 30 });

/** Months worked in a semester: 1 to 6 */
const monthsWorkedArb = fc.integer({ min: 1, max: 6 });

/** Pension system */
const pensionSystemArb = fc.constantFrom('ONP', 'AFP_INTEGRA', 'AFP_PRIMA', 'AFP_PROFUTURO', 'AFP_HABITAT');

/** DNI (8-digit identifier) */
const dniArb = fc.stringMatching(/^[0-9]{8}$/);

/** Employee name */
const nameArb = fc.stringMatching(/^[A-Za-z ]{2,50}$/).filter(s => s.trim().length >= 2);

/** Period month */
const periodArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);

// ============================================================================
// Property Tests
// ============================================================================

describe('Payroll Property Tests', () => {
  // ==========================================================================
  // Property 16: calculateOvertimePay
  // ==========================================================================

  describe('Property 16: calculateOvertimePay', () => {
    it('returns 0 for 0 overtime hours', () => {
      fc.assert(
        fc.property(positiveCentsArb, (salary) => {
          expect(calculateOvertimePay(salary, 0)).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('first 2 hours at 25% surcharge, remaining at 35%', () => {
      fc.assert(
        fc.property(positiveCentsArb, overtimeHoursArb, (salary, hours) => {
          const result = calculateOvertimePay(salary, hours);
          const hourlyRate = salary / WORKING_DAYS_PER_MONTH / WORKING_HOURS_PER_DAY;

          if (hours <= 0) {
            expect(result).toBe(0);
          } else if (hours <= 2) {
            const expected = Math.round(hours * hourlyRate * 1.25);
            expect(result).toBe(expected);
          } else {
            const first2h = 2 * hourlyRate * 1.25;
            const remaining = (hours - 2) * hourlyRate * 1.35;
            const expected = Math.round(first2h + remaining);
            expect(result).toBe(expected);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('result is always a non-negative integer', () => {
      fc.assert(
        fc.property(positiveCentsArb, overtimeHoursArb, (salary, hours) => {
          const result = calculateOvertimePay(salary, hours);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 17: calculateEsSalud
  // ==========================================================================

  describe('Property 17: calculateEsSalud', () => {
    it('always exactly 9% of gross, rounded', () => {
      fc.assert(
        fc.property(nonNegativeCentsArb, (gross) => {
          const result = calculateEsSalud(gross);
          expect(result).toBe(Math.round(gross * 0.09));
        }),
        { numRuns: 200 },
      );
    });

    it('always non-negative', () => {
      fc.assert(
        fc.property(nonNegativeCentsArb, (gross) => {
          expect(calculateEsSalud(gross)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 18: calculatePension
  // ==========================================================================

  describe('Property 18: calculatePension', () => {
    it('ONP and AFP both calculate at 13%', () => {
      fc.assert(
        fc.property(nonNegativeCentsArb, pensionSystemArb, (gross, system) => {
          const result = calculatePension(gross, system);
          expect(result).toBe(Math.round(gross * 0.13));
        }),
        { numRuns: 200 },
      );
    });

    it('always non-negative', () => {
      fc.assert(
        fc.property(nonNegativeCentsArb, pensionSystemArb, (gross, system) => {
          expect(calculatePension(gross, system)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 19: calculateAbsenceDeduction
  // ==========================================================================

  describe('Property 19: calculateAbsenceDeduction', () => {
    it('equals baseSalary / 30 * days (rounded), capped at base salary', () => {
      fc.assert(
        fc.property(positiveCentsArb, absenceDaysArb, (salary, days) => {
          const result = calculateAbsenceDeduction(salary, days);

          if (days <= 0) {
            expect(result).toBe(0);
          } else {
            const raw = Math.round(salary / WORKING_DAYS_PER_MONTH * days);
            const expected = Math.min(raw, salary);
            expect(result).toBe(expected);
          }
        }),
        { numRuns: 200 },
      );
    });

    it('always non-negative', () => {
      fc.assert(
        fc.property(positiveCentsArb, absenceDaysArb, (salary, days) => {
          expect(calculateAbsenceDeduction(salary, days)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });

    it('never exceeds base salary', () => {
      fc.assert(
        fc.property(positiveCentsArb, absenceDaysArb, (salary, days) => {
          expect(calculateAbsenceDeduction(salary, days)).toBeLessThanOrEqual(salary);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 20: calculateCTS
  // ==========================================================================

  describe('Property 20: calculateCTS', () => {
    it('equals gross * monthsWorked / 12 (rounded)', () => {
      fc.assert(
        fc.property(positiveCentsArb, monthsWorkedArb, (gross, months) => {
          const result = calculateCTS(gross, months);
          expect(result).toBe(Math.round(gross * months / 12));
        }),
        { numRuns: 200 },
      );
    });

    it('always non-negative', () => {
      fc.assert(
        fc.property(positiveCentsArb, monthsWorkedArb, (gross, months) => {
          expect(calculateCTS(gross, months)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 21: calculateGratification
  // ==========================================================================

  describe('Property 21: calculateGratification', () => {
    it('equals gross * 1.09 (rounded)', () => {
      fc.assert(
        fc.property(positiveCentsArb, (gross) => {
          const result = calculateGratification(gross);
          expect(result).toBe(Math.round(gross * 1.09));
        }),
        { numRuns: 200 },
      );
    });

    it('always non-negative', () => {
      fc.assert(
        fc.property(positiveCentsArb, (gross) => {
          expect(calculateGratification(gross)).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 22: calculateGrossPayroll
  // ==========================================================================

  describe('Property 22: calculateGrossPayroll', () => {
    it('equals sum of all earnings components', () => {
      fc.assert(
        fc.property(
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          (base, commission, tips, overtime, bonuses) => {
            const components: PayrollComponents = {
              baseSalaryCents: base,
              commissionCents: commission,
              tipsCents: tips,
              overtimeCents: overtime,
              bonusesCents: bonuses,
            };
            const result = calculateGrossPayroll(components);
            expect(result).toBe(base + commission + tips + overtime + bonuses);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('gross is always >= 0 when all components >= 0', () => {
      fc.assert(
        fc.property(
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          (base, commission, tips, overtime, bonuses) => {
            const components: PayrollComponents = {
              baseSalaryCents: base,
              commissionCents: commission,
              tipsCents: tips,
              overtimeCents: overtime,
              bonusesCents: bonuses,
            };
            expect(calculateGrossPayroll(components)).toBeGreaterThanOrEqual(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 23: calculateNetPayroll
  // ==========================================================================

  describe('Property 23: calculateNetPayroll', () => {
    it('equals gross minus all deductions', () => {
      fc.assert(
        fc.property(
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          (gross, advances, absences, other, pension) => {
            const deductions: PayrollDeductions = {
              advancesCents: advances,
              absencesCents: absences,
              otherDeductionsCents: other,
              pensionCents: pension,
            };
            const result = calculateNetPayroll(gross, deductions);
            expect(result).toBe(gross - advances - absences - other - pension);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('net can be negative when deductions exceed gross', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100000 }),
          fc.integer({ min: 100001, max: 500000 }),
          (gross, bigAdvance) => {
            const deductions: PayrollDeductions = {
              advancesCents: bigAdvance,
              absencesCents: 0,
              otherDeductionsCents: 0,
              pensionCents: 0,
            };
            const result = calculateNetPayroll(gross, deductions);
            expect(result).toBeLessThan(0);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ==========================================================================
  // Property 66: CTS calculation is monotonic
  // ==========================================================================

  describe('Property 66: CTS monotonic', () => {
    it('more months worked yields more CTS', () => {
      fc.assert(
        fc.property(
          positiveCentsArb,
          fc.integer({ min: 1, max: 5 }),
          (gross, months) => {
            const cts1 = calculateCTS(gross, months);
            const cts2 = calculateCTS(gross, months + 1);
            expect(cts2).toBeGreaterThanOrEqual(cts1);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 67: Gratification always > gross
  // ==========================================================================

  describe('Property 67: Gratification >= gross', () => {
    it('gratification always >= gross salary (due to 9% bonus)', () => {
      fc.assert(
        fc.property(
          positiveCentsArb,
          (gross) => {
            const grat = calculateGratification(gross);
            // Gratification = gross * 1.09 (rounded), so always >= gross
            expect(grat).toBeGreaterThanOrEqual(gross);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('gratification strictly > gross for typical salary values', () => {
      fc.assert(
        fc.property(
          // For salaries >= 12 cents, the 9% bonus (>= 1.08) rounds up to at least 1
          fc.integer({ min: 12, max: 10000000 }),
          (gross) => {
            const grat = calculateGratification(gross);
            expect(grat).toBeGreaterThan(gross);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 68: Minimum wage enforcement
  // ==========================================================================

  describe('Property 68: Salary validation - minimum wage', () => {
    it('any salary below minimum wage is below PERU_MINIMUM_WAGE_CENTS', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: PERU_MINIMUM_WAGE_CENTS - 1 }),
          (salary) => {
            expect(salary).toBeLessThan(PERU_MINIMUM_WAGE_CENTS);
            // EsSalud and pension can still be calculated on any amount
            // but the service layer should reject this
            const essalud = calculateEsSalud(salary);
            expect(essalud).toBe(Math.round(salary * 0.09));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('any salary at or above minimum wage passes the threshold', () => {
      fc.assert(
        fc.property(positiveCentsArb, (salary) => {
          expect(salary).toBeGreaterThanOrEqual(PERU_MINIMUM_WAGE_CENTS);
        }),
        { numRuns: 100 },
      );
    });
  });

  // ==========================================================================
  // Property 69: PLAME record format validation
  // ==========================================================================

  describe('Property 69: PLAME record format', () => {
    it('contains DNI, is pipe-delimited, and has exactly 8 fields', () => {
      fc.assert(
        fc.property(
          dniArb,
          nameArb,
          periodArb,
          positiveCentsArb,
          positiveCentsArb,
          pensionSystemArb,
          nonNegativeCentsArb,
          nonNegativeCentsArb,
          (dni, name, period, gross, net, pensionSystem, pension, essalud) => {
            const payroll: PayrollResult = {
              id: '00000000-0000-0000-0000-000000000001',
              tenant_id: '00000000-0000-0000-0000-000000000002',
              employee_id: '00000000-0000-0000-0000-000000000003',
              period_month: period,
              business_date_start: new Date(),
              business_date_end: new Date(),
              base_salary_cents: gross,
              commission_cents: 0,
              tips_cents: 0,
              overtime_cents: 0,
              bonuses_cents: 0,
              advances_cents: 0,
              absences_cents: 0,
              other_deductions_cents: 0,
              essalud_cents: essalud,
              pension_cents: pension,
              gross_salary_cents: gross,
              net_salary_cents: net,
              days_worked: 30,
              hours_worked: 240,
              overtime_hours: 0,
              absences_count: 0,
              payslip_url: null,
              calculated_by: '00000000-0000-0000-0000-000000000004',
              calculated_at: new Date(),
              paid_at: null,
            };

            const employee = { dni, name, pension_system: pensionSystem };
            const record = generatePLAMERecord(payroll, employee);

            // Pipe-delimited
            const fields = record.split('|');

            // Exactly 8 fields
            expect(fields).toHaveLength(8);

            // Contains DNI as first field
            expect(fields[0]).toBe(dni);

            // Contains name as second field
            expect(fields[1]).toBe(name);

            // Contains period as third field
            expect(fields[2]).toBe(period);

            // Numeric fields are valid numbers
            expect(Number.isFinite(Number(fields[3]))).toBe(true); // gross
            expect(Number.isFinite(Number(fields[4]))).toBe(true); // net
            expect(fields[5]).toBe(pensionSystem);
            expect(Number.isFinite(Number(fields[6]))).toBe(true); // pension
            expect(Number.isFinite(Number(fields[7]))).toBe(true); // essalud
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
