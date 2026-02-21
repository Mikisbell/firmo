/**
 * Tests: Report Service
 * Fase 10 - Reportes y Analytics
 *
 * Property tests + unit tests for report pure functions.
 * Validates: Requirements 15.1-15.9
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateAttendancePercent,
  calculateOvertimePercent,
  calculateTrend,
  calculateTurnoverRate,
  calculateAverageCost,
  generateAttendanceReport,
  generateHoursWorkedReport,
  generatePayrollReport,
  generateVacationReport,
  generatePerformanceReport,
  generateTurnoverReport,
  generateLaborCostReport,
  generateTrendData,
  formatCentsToPEN,
  exportToCSV,
} from '../report.service';

// ============ PURE FUNCTION UNIT TESTS ============

describe('calculateAttendancePercent', () => {
  it('should return 0 for 0 total days', () => {
    expect(calculateAttendancePercent(5, 0)).toBe(0);
  });

  it('should return 100 for perfect attendance', () => {
    expect(calculateAttendancePercent(20, 20)).toBe(100);
  });

  it('should return correct percentage', () => {
    expect(calculateAttendancePercent(15, 20)).toBe(75);
  });

  it('should always be between 0 and 100 for valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: 1, max: 31 }),
        (present, total) => {
          const capped = Math.min(present, total);
          const result = calculateAttendancePercent(capped, total);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('calculateOvertimePercent', () => {
  it('should return 0 for 0 total hours', () => {
    expect(calculateOvertimePercent(5, 0)).toBe(0);
  });

  it('should calculate correctly', () => {
    expect(calculateOvertimePercent(10, 100)).toBe(10);
  });

  it('should always be between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 200 }),
        (overtime, total) => {
          const capped = Math.min(overtime, total);
          const result = calculateOvertimePercent(capped, total);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('calculateTrend', () => {
  it('should return stable for single score', () => {
    expect(calculateTrend([3.5])).toBe('stable');
  });

  it('should return stable for empty scores', () => {
    expect(calculateTrend([])).toBe('stable');
  });

  it('should return up for significant improvement', () => {
    expect(calculateTrend([3.0, 3.5])).toBe('up');
  });

  it('should return down for significant decline', () => {
    expect(calculateTrend([4.0, 3.5])).toBe('down');
  });

  it('should return stable for minor changes', () => {
    expect(calculateTrend([3.5, 3.6])).toBe('stable');
  });

  it('should only consider last two scores', () => {
    // Even though overall trend is up, last two show decline
    expect(calculateTrend([1.0, 2.0, 4.0, 3.5])).toBe('down');
  });
});

describe('calculateTurnoverRate', () => {
  it('should return 0 for 0 headcount', () => {
    expect(calculateTurnoverRate(5, 0)).toBe(0);
  });

  it('should calculate rate correctly', () => {
    // 2 terminations / 20 avg headcount = 10%
    expect(calculateTurnoverRate(2, 20)).toBe(10);
  });

  it('should always be non-negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 1000 }),
        (terms, headcount) => {
          const result = calculateTurnoverRate(terms, headcount);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('calculateAverageCost', () => {
  it('should return 0 for 0 employees', () => {
    expect(calculateAverageCost(100000, 0)).toBe(0);
  });

  it('should divide evenly', () => {
    expect(calculateAverageCost(300000, 3)).toBe(100000);
  });

  it('should round to nearest integer', () => {
    // 100000 / 3 = 33333.33...
    expect(calculateAverageCost(100000, 3)).toBe(33333);
  });
});

// ============ REPORT GENERATION TESTS ============

describe('generateAttendanceReport', () => {
  it('should correctly count statuses', () => {
    const data = [
      {
        employeeId: 'e1',
        employeeName: 'Juan',
        records: [
          { status: 'PRESENT' },
          { status: 'PRESENT' },
          { status: 'LATE' },
          { status: 'ABSENT' },
          { status: 'JUSTIFIED' },
        ],
      },
    ];

    const report = generateAttendanceReport(data, 5);
    expect(report).toHaveLength(1);
    expect(report[0].presentDays).toBe(3); // PRESENT + LATE
    expect(report[0].absentDays).toBe(1);
    expect(report[0].lateDays).toBe(1);
    expect(report[0].justifiedDays).toBe(1);
    expect(report[0].attendancePercent).toBe(60); // 3/5
  });

  it('should handle empty records', () => {
    const report = generateAttendanceReport(
      [{ employeeId: 'e1', employeeName: 'Ana', records: [] }],
      20
    );
    expect(report[0].presentDays).toBe(0);
    expect(report[0].attendancePercent).toBe(0);
  });
});

describe('generateHoursWorkedReport', () => {
  it('should calculate total hours and overtime percentage', () => {
    const data = [
      { employeeId: 'e1', employeeName: 'Juan', regularHours: 160, overtimeHours: 40 },
    ];

    const report = generateHoursWorkedReport(data);
    expect(report[0].totalHours).toBe(200);
    expect(report[0].overtimePercent).toBe(20);
  });

  it('should handle zero hours', () => {
    const data = [
      { employeeId: 'e1', employeeName: 'Ana', regularHours: 0, overtimeHours: 0 },
    ];

    const report = generateHoursWorkedReport(data);
    expect(report[0].totalHours).toBe(0);
    expect(report[0].overtimePercent).toBe(0);
  });
});

describe('generatePayrollReport', () => {
  it('should calculate totals correctly', () => {
    const records = [
      {
        employeeId: 'e1', employeeName: 'Juan',
        baseSalaryCents: 200000, commissionCents: 50000, overtimeCents: 30000, bonusesCents: 10000,
        grossSalaryCents: 290000, essaludCents: 26100, pensionCents: 37700,
        advancesCents: 50000, netSalaryCents: 176200,
      },
      {
        employeeId: 'e2', employeeName: 'Ana',
        baseSalaryCents: 150000, commissionCents: 30000, overtimeCents: 0, bonusesCents: 0,
        grossSalaryCents: 180000, essaludCents: 16200, pensionCents: 23400,
        advancesCents: 0, netSalaryCents: 140400,
      },
    ];

    const report = generatePayrollReport(records);
    expect(report.totals.totalGross).toBe(470000);
    expect(report.totals.totalNet).toBe(316600);
    expect(report.totals.totalEssalud).toBe(42300);
    expect(report.totals.totalPension).toBe(61100);
    expect(report.totals.totalAdvances).toBe(50000);
    expect(report.rows).toHaveLength(2);
  });
});

describe('generateVacationReport', () => {
  it('should calculate available days', () => {
    const data = [
      { employeeId: 'e1', employeeName: 'Juan', totalDays: 30, usedDays: 10, pendingDays: 5, availableDays: 0 },
    ];

    const report = generateVacationReport(data);
    expect(report[0].availableDays).toBe(15); // 30 - 10 - 5
  });

  it('should always have availableDays = total - used - pending', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 0, max: 10 }),
        (total, used, pending) => {
          const data = [{
            employeeId: 'e1', employeeName: 'Test',
            totalDays: total, usedDays: used, pendingDays: pending, availableDays: 0,
          }];
          const report = generateVacationReport(data);
          expect(report[0].availableDays).toBe(total - used - pending);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('generatePerformanceReport', () => {
  it('should calculate average score and trend', () => {
    const data = [
      { employeeId: 'e1', employeeName: 'Juan', scores: [3.0, 3.5, 4.2], lastDate: '2025-12-15' },
    ];

    const report = generatePerformanceReport(data);
    expect(report[0].evaluationCount).toBe(3);
    expect(report[0].averageScore).toBeCloseTo(3.57, 1);
    expect(report[0].trend).toBe('up');
  });

  it('should handle no scores', () => {
    const data = [
      { employeeId: 'e1', employeeName: 'Ana', scores: [] },
    ];
    const report = generatePerformanceReport(data);
    expect(report[0].averageScore).toBe(0);
    expect(report[0].trend).toBe('stable');
  });
});

describe('generateTurnoverReport', () => {
  it('should calculate turnover rate correctly', () => {
    const data = [
      { period: '2025-01', hires: 3, terminations: 1, startHeadcount: 20, endHeadcount: 22 },
    ];

    const report = generateTurnoverReport(data);
    // avg headcount = (20 + 22) / 2 = 21
    // turnover = 1 / 21 * 100 = 4.76%
    expect(report[0].turnoverRate).toBeCloseTo(4.76, 1);
    expect(report[0].headcount).toBe(22);
  });
});

describe('generateLaborCostReport', () => {
  it('should calculate average cost per employee', () => {
    const data = [
      {
        period: '2025-01',
        totalGrossCents: 1000000, totalNetCents: 750000,
        totalEssaludCents: 90000, totalPensionCents: 130000,
        totalBenefitsCents: 50000, employeeCount: 5,
      },
    ];

    const report = generateLaborCostReport(data);
    // total cost = 1000000 + 90000 + 50000 = 1140000
    // average = 1140000 / 5 = 228000
    expect(report[0].averageCostCents).toBe(228000);
  });
});

describe('generateTrendData', () => {
  it('should map monthly values to trend points', () => {
    const data = [
      { period: '2025-01', value: 100 },
      { period: '2025-02', value: 110 },
    ];
    const trend = generateTrendData(data, 'Asistencia');
    expect(trend).toHaveLength(2);
    expect(trend[0].label).toBe('Asistencia');
    expect(trend[1].value).toBe(110);
  });
});

describe('formatCentsToPEN', () => {
  it('should format correctly', () => {
    const result = formatCentsToPEN(102500);
    expect(result).toContain('S/');
    expect(result).toContain('1');
  });

  it('should handle zero', () => {
    expect(formatCentsToPEN(0)).toContain('0');
  });
});

describe('exportToCSV', () => {
  it('should generate valid CSV with header', () => {
    const rows = [
      { name: 'Juan', age: 30 },
      { name: 'Ana', age: 25 },
    ];
    const columns = [
      { key: 'name' as const, header: 'Nombre' },
      { key: 'age' as const, header: 'Edad' },
    ];

    const csv = exportToCSV(rows, columns);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Nombre,Edad');
    expect(lines[1]).toBe('Juan,30');
    expect(lines[2]).toBe('Ana,25');
  });

  it('should quote values containing commas', () => {
    const rows = [{ name: 'Doe, John', value: 42 }];
    const columns = [
      { key: 'name' as const, header: 'Name' },
      { key: 'value' as const, header: 'Val' },
    ];

    const csv = exportToCSV(rows, columns);
    expect(csv).toContain('"Doe, John"');
  });

  it('should handle empty rows', () => {
    const csv = exportToCSV([], [{ key: 'a' as never, header: 'A' }]);
    expect(csv).toBe('A');
  });

  it('should preserve data integrity for any number of rows', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 10 }).filter(s => !s.includes(',') && !s.includes('\n')),
            val: fc.integer({ min: 0, max: 999999 }),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (rows) => {
          const csv = exportToCSV(rows, [
            { key: 'id', header: 'ID' },
            { key: 'val', header: 'Value' },
          ]);
          const lines = csv.split('\n');
          // Header + data rows (no trailing newline)
          const expectedLines = rows.length === 0 ? 1 : rows.length + 1;
          expect(lines.length).toBe(expectedLines);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ PROPERTY TESTS ============

describe('Property 75: Reportes contienen datos correctos', () => {
  it('attendance report rows match input employees', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 31 }).chain(totalDays =>
          fc.tuple(
            fc.array(
              fc.record({
                employeeId: fc.uuid(),
                employeeName: fc.string({ minLength: 1, maxLength: 30 }),
                records: fc.array(
                  fc.record({
                    status: fc.constantFrom('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED'),
                  }),
                  { minLength: 0, maxLength: totalDays }
                ),
              }),
              { minLength: 1, maxLength: 10 }
            ),
            fc.constant(totalDays)
          )
        ),
        ([data, totalDays]) => {
          const report = generateAttendanceReport(data, totalDays);
          expect(report.length).toBe(data.length);
          for (let i = 0; i < data.length; i++) {
            expect(report[i].employeeId).toBe(data[i].employeeId);
            expect(report[i].totalDays).toBe(totalDays);
            expect(report[i].attendancePercent).toBeGreaterThanOrEqual(0);
            expect(report[i].attendancePercent).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('payroll totals equal sum of individual values', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            employeeId: fc.uuid(),
            employeeName: fc.string({ minLength: 1, maxLength: 30 }),
            baseSalaryCents: fc.integer({ min: 0, max: 1000000 }),
            commissionCents: fc.integer({ min: 0, max: 500000 }),
            overtimeCents: fc.integer({ min: 0, max: 200000 }),
            bonusesCents: fc.integer({ min: 0, max: 100000 }),
            grossSalaryCents: fc.integer({ min: 0, max: 2000000 }),
            essaludCents: fc.integer({ min: 0, max: 200000 }),
            pensionCents: fc.integer({ min: 0, max: 300000 }),
            advancesCents: fc.integer({ min: 0, max: 500000 }),
            netSalaryCents: fc.integer({ min: 0, max: 1500000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (records) => {
          const report = generatePayrollReport(records);
          const expectedGross = records.reduce((s, r) => s + r.grossSalaryCents, 0);
          const expectedNet = records.reduce((s, r) => s + r.netSalaryCents, 0);
          expect(report.totals.totalGross).toBe(expectedGross);
          expect(report.totals.totalNet).toBe(expectedNet);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 76: Gráficos de tendencias', () => {
  it('trend data points preserve all input values', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            period: fc.string({ minLength: 7, maxLength: 7 }),
            value: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 12 }
        ),
        (monthly) => {
          const trend = generateTrendData(monthly, 'Test');
          expect(trend.length).toBe(monthly.length);
          for (let i = 0; i < monthly.length; i++) {
            expect(trend[i].period).toBe(monthly[i].period);
            expect(trend[i].value).toBe(monthly[i].value);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('performance trend correctly identifies direction', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 5, noNaN: true }),
        fc.float({ min: 1, max: 5, noNaN: true }),
        (score1, score2) => {
          const trend = calculateTrend([score1, score2]);
          const diff = score2 - score1;
          if (diff > 0.3) expect(trend).toBe('up');
          else if (diff < -0.3) expect(trend).toBe('down');
          else expect(trend).toBe('stable');
        }
      ),
      { numRuns: 100 }
    );
  });
});
