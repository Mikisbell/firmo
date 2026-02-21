/**
 * Report Service - Servicio de Reportes RRHH
 * Fase 10 - Reportes y Analytics
 *
 * Pure functions for generating HR reports.
 * All calculations are deterministic and testable.
 *
 * Requirements: 15.1-15.9
 */

// ============ TYPES ============

export interface AttendanceReportRow {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  justifiedDays: number;
  attendancePercent: number;
}

export interface HoursWorkedReportRow {
  employeeId: string;
  employeeName: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  overtimePercent: number;
}

export interface PayrollReportRow {
  employeeId: string;
  employeeName: string;
  baseSalaryCents: number;
  commissionCents: number;
  overtimeCents: number;
  bonusesCents: number;
  grossSalaryCents: number;
  essaludCents: number;
  pensionCents: number;
  advancesCents: number;
  netSalaryCents: number;
}

export interface VacationReportRow {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  availableDays: number;
}

export interface PerformanceReportRow {
  employeeId: string;
  employeeName: string;
  evaluationCount: number;
  averageScore: number;
  trend: 'up' | 'down' | 'stable';
  lastEvaluationDate?: string;
}

export interface TurnoverReportRow {
  period: string;
  hires: number;
  terminations: number;
  turnoverRate: number;
  headcount: number;
}

export interface LaborCostReportRow {
  period: string;
  totalGrossCents: number;
  totalNetCents: number;
  totalEssaludCents: number;
  totalPensionCents: number;
  totalBenefitsCents: number;
  employeeCount: number;
  averageCostCents: number;
}

export interface TrendDataPoint {
  period: string;
  value: number;
  label?: string;
}

export interface ReportSummary<T> {
  title: string;
  period: string;
  generatedAt: string;
  tenantId: string;
  rows: T[];
  totals?: Record<string, number>;
}

// ============ PURE FUNCTIONS ============

/** Calculate attendance percentage */
export function calculateAttendancePercent(presentDays: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  return Math.round((presentDays / totalDays) * 10000) / 100;
}

/** Calculate overtime percentage of total hours */
export function calculateOvertimePercent(overtimeHours: number, totalHours: number): number {
  if (totalHours <= 0) return 0;
  return Math.round((overtimeHours / totalHours) * 10000) / 100;
}

/** Determine performance trend from scores */
export function calculateTrend(scores: number[]): 'up' | 'down' | 'stable' {
  if (scores.length < 2) return 'stable';
  const recent = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  const diff = recent - previous;
  if (diff > 0.3) return 'up';
  if (diff < -0.3) return 'down';
  return 'stable';
}

/** Calculate turnover rate */
export function calculateTurnoverRate(terminations: number, avgHeadcount: number): number {
  if (avgHeadcount <= 0) return 0;
  return Math.round((terminations / avgHeadcount) * 10000) / 100;
}

/** Calculate average cost per employee */
export function calculateAverageCost(totalCostCents: number, employeeCount: number): number {
  if (employeeCount <= 0) return 0;
  return Math.round(totalCostCents / employeeCount);
}

/** Generate attendance report from raw data */
export function generateAttendanceReport(
  data: Array<{
    employeeId: string;
    employeeName: string;
    records: Array<{ status: string }>;
  }>,
  totalWorkDays: number
): AttendanceReportRow[] {
  return data.map(d => {
    const presentDays = d.records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const absentDays = d.records.filter(r => r.status === 'ABSENT').length;
    const lateDays = d.records.filter(r => r.status === 'LATE').length;
    const justifiedDays = d.records.filter(r => r.status === 'JUSTIFIED').length;

    return {
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      totalDays: totalWorkDays,
      presentDays,
      absentDays,
      lateDays,
      justifiedDays,
      attendancePercent: calculateAttendancePercent(presentDays, totalWorkDays),
    };
  });
}

/** Generate hours worked report from raw data */
export function generateHoursWorkedReport(
  data: Array<{
    employeeId: string;
    employeeName: string;
    regularHours: number;
    overtimeHours: number;
  }>
): HoursWorkedReportRow[] {
  return data.map(d => {
    const totalHours = d.regularHours + d.overtimeHours;
    return {
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      regularHours: d.regularHours,
      overtimeHours: d.overtimeHours,
      totalHours,
      overtimePercent: calculateOvertimePercent(d.overtimeHours, totalHours),
    };
  });
}

/** Generate payroll summary from payroll records */
export function generatePayrollReport(
  records: PayrollReportRow[]
): ReportSummary<PayrollReportRow> & { totals: Record<string, number> } {
  const totals = records.reduce(
    (acc, r) => ({
      totalGross: acc.totalGross + r.grossSalaryCents,
      totalNet: acc.totalNet + r.netSalaryCents,
      totalEssalud: acc.totalEssalud + r.essaludCents,
      totalPension: acc.totalPension + r.pensionCents,
      totalAdvances: acc.totalAdvances + r.advancesCents,
    }),
    { totalGross: 0, totalNet: 0, totalEssalud: 0, totalPension: 0, totalAdvances: 0 }
  );

  return {
    title: 'Reporte de Planilla',
    period: '',
    generatedAt: new Date().toISOString(),
    tenantId: '',
    rows: records,
    totals,
  };
}

/** Generate vacation balance report */
export function generateVacationReport(
  data: VacationReportRow[]
): VacationReportRow[] {
  return data.map(d => ({
    ...d,
    availableDays: d.totalDays - d.usedDays - d.pendingDays,
  }));
}

/** Generate performance report from evaluation data */
export function generatePerformanceReport(
  data: Array<{
    employeeId: string;
    employeeName: string;
    scores: number[];
    lastDate?: string;
  }>
): PerformanceReportRow[] {
  return data.map(d => {
    const averageScore = d.scores.length > 0
      ? Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 100) / 100
      : 0;

    return {
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      evaluationCount: d.scores.length,
      averageScore,
      trend: calculateTrend(d.scores),
      lastEvaluationDate: d.lastDate,
    };
  });
}

/** Generate turnover report from hire/termination data */
export function generateTurnoverReport(
  data: Array<{
    period: string;
    hires: number;
    terminations: number;
    startHeadcount: number;
    endHeadcount: number;
  }>
): TurnoverReportRow[] {
  return data.map(d => {
    const avgHeadcount = (d.startHeadcount + d.endHeadcount) / 2;
    return {
      period: d.period,
      hires: d.hires,
      terminations: d.terminations,
      turnoverRate: calculateTurnoverRate(d.terminations, avgHeadcount),
      headcount: d.endHeadcount,
    };
  });
}

/** Generate labor cost report */
export function generateLaborCostReport(
  data: Array<{
    period: string;
    totalGrossCents: number;
    totalNetCents: number;
    totalEssaludCents: number;
    totalPensionCents: number;
    totalBenefitsCents: number;
    employeeCount: number;
  }>
): LaborCostReportRow[] {
  return data.map(d => ({
    ...d,
    averageCostCents: calculateAverageCost(
      d.totalGrossCents + d.totalEssaludCents + d.totalBenefitsCents,
      d.employeeCount
    ),
  }));
}

/** Generate trend data points from monthly values */
export function generateTrendData(
  monthlyValues: Array<{ period: string; value: number }>,
  label?: string
): TrendDataPoint[] {
  return monthlyValues.map(m => ({
    period: m.period,
    value: m.value,
    label,
  }));
}

/** Format cents to currency string (PEN) */
export function formatCentsToPEN(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

/** Export report rows to CSV format */
export function exportToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T; header: string }>
): string {
  const header = columns.map(c => c.header).join(',');
  if (rows.length === 0) return header;
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return String(val ?? '');
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}
