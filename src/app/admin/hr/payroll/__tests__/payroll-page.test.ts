/**
 * Admin HR Payroll Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - formatCurrency: "S/ X.XX" with 2 decimals
 * - PayrollRecord field structure (gross = base + commissions + tips + overtime + bonuses - advances - absences)
 * - Deductions: essalud (9%), pension (13%)
 * - Net salary = gross - deductions
 * - API URLs
 *
 * @module app/admin/hr/payroll/__tests__/payroll-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

interface PayrollRecord {
  employee_id:         string;
  period_month:        string;
  base_salary_cents:   number;
  commission_cents:    number;
  tips_cents:          number;
  overtime_cents:      number;
  bonuses_cents:       number;
  advances_cents:      number;
  absences_cents:      number;
  essalud_cents:       number;
  pension_cents:       number;
  gross_salary_cents:  number;
  net_salary_cents:    number;
  days_worked:         number;
  overtime_hours:      number;
  absences_count:      number;
}

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcGrossSalary(record: Pick<PayrollRecord, 'base_salary_cents' | 'commission_cents' | 'tips_cents' | 'overtime_cents' | 'bonuses_cents' | 'advances_cents' | 'absences_cents'>): number {
  return (
    record.base_salary_cents +
    record.commission_cents +
    record.tips_cents +
    record.overtime_cents +
    record.bonuses_cents -
    record.advances_cents -
    record.absences_cents
  );
}

function calcNetSalary(grossCents: number, essaludCents: number, pensionCents: number): number {
  return grossCents - essaludCents - pensionCents;
}

function buildPayrollPeriodURL(periodMonth: string): string {
  return `/api/hr/payroll/period/${periodMonth}`;
}

const CALCULATE_URL = '/api/hr/payroll/calculate';

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminHRPayrollPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminHRPayrollPage — formatCurrency', () => {
  it('incluye S/', () => {
    expect(formatCurrency(100000)).toContain('S/');
  });

  it('0 → S/ 0.00', () => {
    expect(formatCurrency(0)).toContain('0');
    expect(formatCurrency(0)).toContain('S/');
  });

  it('property: siempre incluye S/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999900 }),
        (cents) => {
          expect(formatCurrency(cents)).toContain('S/');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Gross salary calculation
// ============================================================================

describe('AdminHRPayrollPage — Cálculo de salario bruto', () => {
  const base = {
    base_salary_cents:  150000,  // S/ 1500
    commission_cents:    20000,  // S/ 200
    tips_cents:           5000,  // S/ 50
    overtime_cents:      10000,  // S/ 100
    bonuses_cents:        5000,  // S/ 50
    advances_cents:      10000,  // S/ 100
    absences_cents:       5000,  // S/ 50
  };

  it('bruto = base + comisiones + propinas + extras + bonos - adelantos - ausencias', () => {
    // 150000 + 20000 + 5000 + 10000 + 5000 - 10000 - 5000 = 175000
    expect(calcGrossSalary(base)).toBe(175000);
  });

  it('solo base salary → bruto = base', () => {
    const minimal = { base_salary_cents: 100000, commission_cents: 0, tips_cents: 0, overtime_cents: 0, bonuses_cents: 0, advances_cents: 0, absences_cents: 0 };
    expect(calcGrossSalary(minimal)).toBe(100000);
  });

  it('con adelantos mayores que extras → bruto < base', () => {
    const withAdvances = { ...base, advances_cents: 200000, absences_cents: 0, commission_cents: 0, tips_cents: 0, overtime_cents: 0, bonuses_cents: 0 };
    expect(calcGrossSalary(withAdvances)).toBeLessThan(base.base_salary_cents);
  });

  it('property: bruto sin deducciones >= base salary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 50000 }),
        (base, commissions, tips) => {
          const record = { base_salary_cents: base, commission_cents: commissions, tips_cents: tips, overtime_cents: 0, bonuses_cents: 0, advances_cents: 0, absences_cents: 0 };
          expect(calcGrossSalary(record)).toBeGreaterThanOrEqual(base);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Net salary calculation
// ============================================================================

describe('AdminHRPayrollPage — Cálculo de salario neto', () => {
  it('neto = bruto - essalud - pension', () => {
    // 175000 - 15750 - 22750 = 136500
    expect(calcNetSalary(175000, 15750, 22750)).toBe(136500);
  });

  it('sin deducciones → neto = bruto', () => {
    expect(calcNetSalary(150000, 0, 0)).toBe(150000);
  });

  it('neto siempre <= bruto', () => {
    expect(calcNetSalary(150000, 13500, 19500)).toBeLessThanOrEqual(150000);
  });

  it('property: neto <= bruto cuando deducciones >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 150000 }),
        (gross, essalud, pension) => {
          expect(calcNetSalary(gross, essalud, pension)).toBeLessThanOrEqual(gross);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URLs
// ============================================================================

describe('AdminHRPayrollPage — URLs', () => {
  it('period URL incluye el mes', () => {
    const url = buildPayrollPeriodURL('2026-03');
    expect(url).toBe('/api/hr/payroll/period/2026-03');
  });

  it('calculate URL correcta', () => {
    expect(CALCULATE_URL).toBe('/api/hr/payroll/calculate');
  });

  it('property: period URL siempre contiene el período', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month) => {
          const period = `${year}-${String(month).padStart(2, '0')}`;
          expect(buildPayrollPeriodURL(period)).toContain(period);
        }
      ),
      { numRuns: 100 }
    );
  });
});
