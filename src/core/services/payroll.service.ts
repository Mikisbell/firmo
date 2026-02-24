/**
 * Payroll Service - Business Logic Layer for RRHH Module
 *
 * Implements Peruvian labor law payroll calculations including:
 * - Overtime (25% surcharge first 2h, 35% beyond)
 * - EsSalud (9% employer contribution)
 * - ONP/AFP pension (13% employee contribution)
 * - CTS (Compensacion por Tiempo de Servicios)
 * - Gratificaciones (July and December bonuses)
 * - Absence deductions (base / 30 per day)
 *
 * All money values in centavos (integer, never float).
 * Multi-tenant: all operations filter by tenant_id.
 * Event-sourced: all mutations emit events through the events table.
 *
 * @module core/services/payroll.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Constants
// ============================================================================

/** Peruvian minimum wage in centavos: S/1,025.00 */
export const PERU_MINIMUM_WAGE_CENTS = 102500;

/** Standard working days per month (Peruvian convention) */
export const WORKING_DAYS_PER_MONTH = 30;

/** Standard working hours per day */
export const WORKING_HOURS_PER_DAY = 8;

/** EsSalud rate: 9% of gross salary (employer contribution) */
export const ESSALUD_RATE = 0.09;

/** ONP rate: 13% of gross salary (employee contribution) */
export const ONP_RATE = 0.13;

/** AFP default rate: 13% of gross salary (employee contribution) */
export const AFP_RATE = 0.13;

/** Overtime first 2 hours surcharge multiplier: 1.25x */
export const OVERTIME_FIRST_2H_MULTIPLIER = 1.25;

/** Overtime beyond 2 hours surcharge multiplier: 1.35x */
export const OVERTIME_BEYOND_2H_MULTIPLIER = 1.35;

/** Gratification extraordinary bonus rate: 9% */
export const GRATIFICATION_BONUS_RATE = 0.09;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface PayrollComponents {
  baseSalaryCents: number;
  commissionCents: number;
  tipsCents: number;
  overtimeCents: number;
  bonusesCents: number;
}

export interface PayrollDeductions {
  advancesCents: number;
  absencesCents: number;
  otherDeductionsCents: number;
  pensionCents: number;
}

export interface PayrollResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  period_month: string;
  business_date_start: Date;
  business_date_end: Date;
  base_salary_cents: number;
  commission_cents: number;
  tips_cents: number;
  overtime_cents: number;
  bonuses_cents: number;
  advances_cents: number;
  absences_cents: number;
  other_deductions_cents: number;
  essalud_cents: number;
  pension_cents: number;
  gross_salary_cents: number;
  net_salary_cents: number;
  days_worked: number;
  hours_worked: number;
  overtime_hours: number;
  absences_count: number;
  payslip_url: string | null;
  calculated_by: string;
  calculated_at: Date;
  paid_at: Date | null;
}

export interface PayrollBatchResult {
  successful: PayrollResult[];
  failed: Array<{ employeeId: string; error: string }>;
  total: number;
}

// ============================================================================
// Pure Calculation Functions
// ============================================================================

/**
 * Calculate overtime pay based on Peruvian labor law.
 * First 2 hours: 25% surcharge (1.25x hourly rate)
 * Beyond 2 hours: 35% surcharge (1.35x hourly rate)
 *
 * @param baseSalaryCents - Monthly base salary in centavos
 * @param overtimeHours - Total overtime hours
 * @returns Overtime pay in centavos (integer)
 */
export function calculateOvertimePay(baseSalaryCents: number, overtimeHours: number): number {
  if (overtimeHours <= 0) return 0;

  const hourlyRate = baseSalaryCents / WORKING_DAYS_PER_MONTH / WORKING_HOURS_PER_DAY;
  const first2h = Math.min(overtimeHours, 2) * hourlyRate * OVERTIME_FIRST_2H_MULTIPLIER;
  const remaining = Math.max(overtimeHours - 2, 0) * hourlyRate * OVERTIME_BEYOND_2H_MULTIPLIER;

  return Math.round(first2h + remaining);
}

/**
 * Calculate absence deduction based on Peruvian labor law.
 * Deduction = base_salary / 30 per day of absence.
 *
 * @param baseSalaryCents - Monthly base salary in centavos
 * @param absencesDays - Number of absence days
 * @returns Absence deduction in centavos (integer)
 */
export function calculateAbsenceDeduction(baseSalaryCents: number, absencesDays: number): number {
  if (absencesDays <= 0) return 0;

  const dailyRate = baseSalaryCents / WORKING_DAYS_PER_MONTH;
  const deduction = Math.round(dailyRate * absencesDays);

  // Never exceed base salary
  return Math.min(deduction, baseSalaryCents);
}

/**
 * Calculate EsSalud contribution (employer contribution).
 * Rate: 9% of gross salary.
 *
 * @param grossSalaryCents - Gross salary in centavos
 * @returns EsSalud amount in centavos (integer)
 */
export function calculateEsSalud(grossSalaryCents: number): number {
  return Math.round(grossSalaryCents * ESSALUD_RATE);
}

/**
 * Calculate pension contribution (employee contribution).
 * ONP: 13% of gross salary
 * AFP: 13% of gross salary (default rate)
 *
 * @param grossSalaryCents - Gross salary in centavos
 * @param pensionSystem - Pension system identifier
 * @returns Pension amount in centavos (integer)
 */
export function calculatePension(grossSalaryCents: number, pensionSystem: string): number {
  if (pensionSystem === 'ONP') {
    return Math.round(grossSalaryCents * ONP_RATE);
  }
  // AFP systems: AFP_INTEGRA, AFP_PRIMA, AFP_PROFUTURO, AFP_HABITAT
  return Math.round(grossSalaryCents * AFP_RATE);
}

/**
 * Calculate CTS (Compensacion por Tiempo de Servicios).
 * 1/12 of monthly gross salary per semester (up to 6 months).
 *
 * @param grossSalaryCents - Monthly gross salary in centavos
 * @param monthsWorked - Months worked in the semester (1-6)
 * @returns CTS amount in centavos (integer)
 */
export function calculateCTS(grossSalaryCents: number, monthsWorked: number): number {
  return Math.round(grossSalaryCents * monthsWorked / 12);
}

/**
 * Calculate gratification (July and December bonuses).
 * One full gross salary plus 9% extraordinary bonus (bonificacion extraordinaria).
 *
 * @param grossSalaryCents - Monthly gross salary in centavos
 * @returns Gratification amount in centavos (integer)
 */
export function calculateGratification(grossSalaryCents: number): number {
  return Math.round(grossSalaryCents * (1 + GRATIFICATION_BONUS_RATE));
}

/**
 * Calculate gross payroll from salary components.
 * Gross = base + commission + tips + overtime + bonuses
 *
 * @param components - Payroll salary components
 * @returns Gross salary in centavos (integer)
 */
export function calculateGrossPayroll(components: PayrollComponents): number {
  return (
    components.baseSalaryCents +
    components.commissionCents +
    components.tipsCents +
    components.overtimeCents +
    components.bonusesCents
  );
}

/**
 * Calculate net payroll from gross salary and deductions.
 * Net = gross - advances - absences - otherDeductions - pension
 *
 * Note: Net can be negative if deductions exceed gross.
 *
 * @param grossCents - Gross salary in centavos
 * @param deductions - Payroll deductions
 * @returns Net salary in centavos (integer, can be negative)
 */
export function calculateNetPayroll(grossCents: number, deductions: PayrollDeductions): number {
  return (
    grossCents -
    deductions.advancesCents -
    deductions.absencesCents -
    deductions.otherDeductionsCents -
    deductions.pensionCents
  );
}

/**
 * Generate a simplified PLAME record (pipe-delimited format).
 * Format: DNI|EMPLOYEE_NAME|PERIOD|GROSS_CENTS|NET_CENTS|PENSION_SYSTEM|PENSION_CENTS|ESSALUD_CENTS
 *
 * @param payroll - Payroll result
 * @param employee - Employee data with DNI, name, and pension system
 * @returns PLAME record string
 */
export function generatePLAMERecord(
  payroll: PayrollResult,
  employee: { dni: string; name: string; pension_system: string },
): string {
  return [
    employee.dni,
    employee.name,
    payroll.period_month,
    String(payroll.gross_salary_cents),
    String(payroll.net_salary_cents),
    employee.pension_system,
    String(payroll.pension_cents),
    String(payroll.essalud_cents),
  ].join('|');
}

// ============================================================================
// PayrollService
// ============================================================================

export class PayrollService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Calculate for Employee
  // ==========================================================================

  /**
   * Calculate payroll for a single employee for a given period.
   * Creates a payroll_records entry and emits PAYROLL_CALCULATED event.
   */
  async calculateForEmployee(
    tenantId: string,
    employeeId: string,
    periodMonth: string,
    calculatedBy: string,
  ): Promise<Result<PayrollResult, DomainError>> {
    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return err(
        new ValidationError(
          `Invalid period format: ${periodMonth}. Expected YYYY-MM`,
          'period_month',
        ),
      );
    }

    // Fetch employee
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId, is_active: true },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', employeeId));
    }

    // Parse period dates
    const [year, month] = periodMonth.split('-').map(Number);
    const dateStart = new Date(year, month - 1, 1);
    const dateEnd = new Date(year, month, 0); // last day of month

    // Query attendance for this period
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        date: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    });

    // Calculate attendance metrics
    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let absencesCount = 0;

    for (const record of attendanceRecords) {
      totalWorkedMinutes += record.worked_minutes || 0;
      totalOvertimeMinutes += record.overtime_minutes || 0;
      if (record.status === 'ABSENT') {
        absencesCount++;
      }
    }

    const hoursWorked = Math.round(totalWorkedMinutes / 60);
    const overtimeHours = Math.round(totalOvertimeMinutes / 60);

    // Query approved advances for this period
    const advances = await this.prisma.advances.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        status: 'APPROVED',
      },
    });

    const totalAdvancesCents = advances.reduce(
      (sum: number, adv: any) => sum + (adv.amount_cents || 0),
      0,
    );

    // Calculate salary components
    const baseSalaryCents = employee.base_salary_cents || 0;
    const commissionRate = employee.commission_rate ? Number(employee.commission_rate) : 0;
    const commissionCents = Math.round(baseSalaryCents * commissionRate);
    const overtimeCents = calculateOvertimePay(baseSalaryCents, overtimeHours);
    const absencesCents = calculateAbsenceDeduction(baseSalaryCents, absencesCount);

    const components: PayrollComponents = {
      baseSalaryCents,
      commissionCents,
      tipsCents: 0,
      overtimeCents,
      bonusesCents: 0,
    };

    const grossSalaryCents = calculateGrossPayroll(components);
    const pensionSystem = employee.pension_system || 'ONP';
    const essaludCents = calculateEsSalud(grossSalaryCents);
    const pensionCents = calculatePension(grossSalaryCents, pensionSystem);

    const deductions: PayrollDeductions = {
      advancesCents: totalAdvancesCents,
      absencesCents,
      otherDeductionsCents: 0,
      pensionCents,
    };

    const netSalaryCents = calculateNetPayroll(grossSalaryCents, deductions);

    const daysWorked = WORKING_DAYS_PER_MONTH - absencesCount;
    const payrollId = uuidv4();

    // Create payroll record in transaction with event emission
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const payrollRecord = await tx.payroll_records.create({
          data: {
            id: payrollId,
            tenant_id: tenantId,
            employee_id: employeeId,
            period_month: periodMonth,
            business_date_start: dateStart,
            business_date_end: dateEnd,
            base_salary_cents: baseSalaryCents,
            commission_cents: commissionCents,
            tips_cents: 0,
            overtime_cents: overtimeCents,
            bonuses_cents: 0,
            advances_cents: totalAdvancesCents,
            absences_cents: absencesCents,
            other_deductions_cents: 0,
            essalud_cents: essaludCents,
            pension_cents: pensionCents,
            gross_salary_cents: grossSalaryCents,
            net_salary_cents: netSalaryCents,
            days_worked: daysWorked,
            hours_worked: hoursWorked,
            overtime_hours: overtimeHours,
            absences_count: absencesCount,
            calculated_by: calculatedBy,
          },
        });

        // Emit PAYROLL_CALCULATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'PAYROLL_CALCULATED',
            entity_type: 'PAYROLL',
            entity_id: payrollId,
            actor_id: calculatedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              payroll_id: payrollId,
              employee_id: employeeId,
              period_month: periodMonth,
              gross_salary_cents: grossSalaryCents,
              net_salary_cents: netSalaryCents,
            },
          },
        });

        return payrollRecord;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, employeeId, periodMonth },
        'Failed to calculate payroll',
      );
      return err(
        new DomainError('Failed to calculate payroll', 'PAYROLL_CALCULATION_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { payrollId, employeeId, tenantId, periodMonth },
      'Payroll calculated successfully',
    );

    return ok(this.mapPayrollToResult(txResult.data));
  }

  // ==========================================================================
  // Calculate Monthly (Batch)
  // ==========================================================================

  /**
   * Calculate payroll for all active employees of a tenant for a given period.
   * Skips employees that error, continues with rest.
   */
  async calculateMonthly(
    tenantId: string,
    periodMonth: string,
    calculatedBy: string,
  ): Promise<Result<PayrollBatchResult, DomainError>> {
    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return err(
        new ValidationError(
          `Invalid period format: ${periodMonth}. Expected YYYY-MM`,
          'period_month',
        ),
      );
    }

    // Fetch all active employees
    const employees = await this.prisma.employees.findMany({
      where: { tenant_id: tenantId, is_active: true },
    });

    const successful: PayrollResult[] = [];
    const failed: Array<{ employeeId: string; error: string }> = [];

    for (const employee of employees) {
      const result = await this.calculateForEmployee(
        tenantId,
        employee.id,
        periodMonth,
        calculatedBy,
      );

      if (result.success) {
        successful.push(result.data);
      } else {
        failed.push({
          employeeId: employee.id,
          error: result.error.message,
        });
      }
    }

    pinoLogger.info(
      {
        tenantId,
        periodMonth,
        total: employees.length,
        successful: successful.length,
        failed: failed.length,
      },
      'Monthly payroll calculation completed',
    );

    return ok({
      successful,
      failed,
      total: employees.length,
    });
  }

  // ==========================================================================
  // Get by Employee & Period
  // ==========================================================================

  /**
   * Get payroll record for a specific employee and period.
   */
  async getByEmployeePeriod(
    tenantId: string,
    employeeId: string,
    periodMonth: string,
  ): Promise<Result<PayrollResult, DomainError>> {
    const record = await this.prisma.payroll_records.findFirst({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        period_month: periodMonth,
      },
    });

    if (!record) {
      return err(new NotFoundError('Payroll', `${employeeId}/${periodMonth}`));
    }

    return ok(this.mapPayrollToResult(record));
  }

  // ==========================================================================
  // List by Period
  // ==========================================================================

  /**
   * List all payroll records for a given period.
   */
  async listByPeriod(
    tenantId: string,
    periodMonth: string,
  ): Promise<Result<PayrollResult[], DomainError>> {
    try {
      const records = await this.prisma.payroll_records.findMany({
        where: {
          tenant_id: tenantId,
          period_month: periodMonth,
        },
        orderBy: { calculated_at: 'desc' },
      });

      return ok(records.map((r: any) => this.mapPayrollToResult(r)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, periodMonth }, 'Failed to list payroll by period');
      return err(
        new DomainError('Failed to list payroll records', 'PAYROLL_LIST_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Get History
  // ==========================================================================

  /**
   * Get payroll history for an employee, sorted by period descending.
   */
  async getHistory(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<PayrollResult[], DomainError>> {
    try {
      const records = await this.prisma.payroll_records.findMany({
        where: {
          tenant_id: tenantId,
          employee_id: employeeId,
        },
        orderBy: { period_month: 'desc' },
      });

      return ok(records.map((r: any) => this.mapPayrollToResult(r)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to get payroll history');
      return err(
        new DomainError('Failed to get payroll history', 'PAYROLL_HISTORY_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapPayrollToResult(record: any): PayrollResult {
    return {
      id: record.id,
      tenant_id: record.tenant_id,
      employee_id: record.employee_id,
      period_month: record.period_month,
      business_date_start: record.business_date_start,
      business_date_end: record.business_date_end,
      base_salary_cents: record.base_salary_cents,
      commission_cents: record.commission_cents,
      tips_cents: record.tips_cents,
      overtime_cents: record.overtime_cents,
      bonuses_cents: record.bonuses_cents,
      advances_cents: record.advances_cents,
      absences_cents: record.absences_cents,
      other_deductions_cents: record.other_deductions_cents,
      essalud_cents: record.essalud_cents,
      pension_cents: record.pension_cents,
      gross_salary_cents: record.gross_salary_cents,
      net_salary_cents: record.net_salary_cents,
      days_worked: record.days_worked,
      hours_worked: record.hours_worked,
      overtime_hours: record.overtime_hours,
      absences_count: record.absences_count,
      payslip_url: record.payslip_url ?? null,
      calculated_by: record.calculated_by,
      calculated_at: record.calculated_at,
      paid_at: record.paid_at ?? null,
    };
  }
}
