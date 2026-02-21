/**
 * Payroll Service Unit Tests
 *
 * Tests the PayrollService with mocked Prisma client.
 * Verifies Peruvian labor law calculations, tenant isolation, event emission,
 * and validation rules.
 *
 * Pure calculation functions are also tested directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PayrollService,
  PERU_MINIMUM_WAGE_CENTS,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_DAY,
  calculateOvertimePay,
  calculateAbsenceDeduction,
  calculateEsSalud,
  calculatePension,
  calculateCTS,
  calculateGratification,
  calculateGrossPayroll,
  calculateNetPayroll,
  generatePLAMERecord,
} from '../payroll.service';
import type { PayrollComponents, PayrollDeductions, PayrollResult } from '../payroll.service';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock withTransaction to directly execute the callback with mockTx from the prisma instance
vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (prisma: any, operation: any, _opts?: any) => {
    try {
      const result = await operation(prisma._mockTx || mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// Shared mock transaction client
const mockTx: any = {
  payroll_records: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  events: {
    create: vi.fn(),
  },
};

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = '11111111-2222-3333-4444-555555555555';
const ACTOR_ID = '99999999-8888-7777-6666-555555555555';
const PERIOD = '2026-01';

function makeEmployeeRow(overrides?: Record<string, unknown>) {
  return {
    id: EMPLOYEE_ID,
    tenant_id: TENANT_ID,
    name: 'Juan Perez',
    role: 'CASHIER',
    is_active: true,
    base_salary_cents: 150000,
    commission_rate: null,
    pension_system: 'ONP',
    has_health_insurance: false,
    hire_date: new Date('2025-06-01'),
    position: 'Cajero Principal',
    dni: '12345678',
    ...overrides,
  };
}

function makeAttendanceRecords(count: number, overrides?: Record<string, unknown>) {
  return Array.from({ length: count }, (_, i) => ({
    id: `att-${i}`,
    employee_id: EMPLOYEE_ID,
    date: new Date(2026, 0, i + 1),
    worked_minutes: 480,
    overtime_minutes: 0,
    status: 'PRESENT',
    ...overrides,
  }));
}

function makePayrollRow(overrides?: Record<string, unknown>) {
  return {
    id: 'payroll-001',
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    period_month: PERIOD,
    business_date_start: new Date(2026, 0, 1),
    business_date_end: new Date(2026, 0, 31),
    base_salary_cents: 150000,
    commission_cents: 0,
    tips_cents: 0,
    overtime_cents: 0,
    bonuses_cents: 0,
    advances_cents: 0,
    absences_cents: 0,
    other_deductions_cents: 0,
    essalud_cents: 13500,
    pension_cents: 19500,
    gross_salary_cents: 150000,
    net_salary_cents: 130500,
    days_worked: 30,
    hours_worked: 240,
    overtime_hours: 0,
    absences_count: 0,
    payslip_url: null,
    calculated_by: ACTOR_ID,
    calculated_at: new Date(),
    paid_at: null,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PayrollService', () => {
  let service: PayrollService;

  const mockPrisma: any = {
    _mockTx: mockTx,
    employees: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    attendance: {
      findMany: vi.fn(),
    },
    advances: {
      findMany: vi.fn(),
    },
    payroll_records: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    events: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    service = new PayrollService(mockPrisma);
    vi.clearAllMocks();
  });

  // ========================================================================
  // Pure Calculation Functions
  // ========================================================================

  describe('calculateOvertimePay', () => {
    it('should return 0 for 0 overtime hours', () => {
      expect(calculateOvertimePay(150000, 0)).toBe(0);
    });

    it('should calculate first 2 hours at 1.25x', () => {
      const hourlyRate = 150000 / 30 / 8;
      const expected = Math.round(2 * hourlyRate * 1.25);
      expect(calculateOvertimePay(150000, 2)).toBe(expected);
    });

    it('should calculate beyond 2 hours at 1.35x', () => {
      const hourlyRate = 150000 / 30 / 8;
      const first2h = 2 * hourlyRate * 1.25;
      const remaining = 3 * hourlyRate * 1.35;
      const expected = Math.round(first2h + remaining);
      expect(calculateOvertimePay(150000, 5)).toBe(expected);
    });

    it('should return 0 for negative hours', () => {
      expect(calculateOvertimePay(150000, -1)).toBe(0);
    });
  });

  describe('calculateAbsenceDeduction', () => {
    it('should return 0 for 0 absences', () => {
      expect(calculateAbsenceDeduction(150000, 0)).toBe(0);
    });

    it('should deduct baseSalary / 30 per day', () => {
      const expected = Math.round(150000 / 30 * 3);
      expect(calculateAbsenceDeduction(150000, 3)).toBe(expected);
    });

    it('should never exceed base salary', () => {
      const result = calculateAbsenceDeduction(150000, 31);
      expect(result).toBeLessThanOrEqual(150000);
    });

    it('should return 0 for negative absences', () => {
      expect(calculateAbsenceDeduction(150000, -1)).toBe(0);
    });
  });

  describe('calculateEsSalud', () => {
    it('should calculate 9% of gross', () => {
      expect(calculateEsSalud(150000)).toBe(Math.round(150000 * 0.09));
    });

    it('should return 0 for 0 gross', () => {
      expect(calculateEsSalud(0)).toBe(0);
    });
  });

  describe('calculatePension', () => {
    it('should calculate ONP at 13%', () => {
      expect(calculatePension(150000, 'ONP')).toBe(Math.round(150000 * 0.13));
    });

    it('should calculate AFP_INTEGRA at 13%', () => {
      expect(calculatePension(150000, 'AFP_INTEGRA')).toBe(Math.round(150000 * 0.13));
    });

    it('should calculate AFP_PRIMA at 13%', () => {
      expect(calculatePension(150000, 'AFP_PRIMA')).toBe(Math.round(150000 * 0.13));
    });

    it('should calculate AFP_PROFUTURO at 13%', () => {
      expect(calculatePension(150000, 'AFP_PROFUTURO')).toBe(Math.round(150000 * 0.13));
    });

    it('should calculate AFP_HABITAT at 13%', () => {
      expect(calculatePension(150000, 'AFP_HABITAT')).toBe(Math.round(150000 * 0.13));
    });
  });

  describe('calculateCTS', () => {
    it('should calculate 1/12 of gross per month worked', () => {
      expect(calculateCTS(150000, 6)).toBe(Math.round(150000 * 6 / 12));
    });

    it('should return half the gross for 6 months', () => {
      expect(calculateCTS(200000, 6)).toBe(100000);
    });
  });

  describe('calculateGratification', () => {
    it('should return gross + 9% bonus', () => {
      expect(calculateGratification(150000)).toBe(Math.round(150000 * 1.09));
    });
  });

  describe('calculateGrossPayroll', () => {
    it('should sum all earnings components', () => {
      const components: PayrollComponents = {
        baseSalaryCents: 150000,
        commissionCents: 10000,
        tipsCents: 5000,
        overtimeCents: 8000,
        bonusesCents: 3000,
      };
      expect(calculateGrossPayroll(components)).toBe(176000);
    });

    it('should handle all zeros', () => {
      const components: PayrollComponents = {
        baseSalaryCents: 0,
        commissionCents: 0,
        tipsCents: 0,
        overtimeCents: 0,
        bonusesCents: 0,
      };
      expect(calculateGrossPayroll(components)).toBe(0);
    });
  });

  describe('calculateNetPayroll', () => {
    it('should subtract all deductions from gross', () => {
      const deductions: PayrollDeductions = {
        advancesCents: 10000,
        absencesCents: 5000,
        otherDeductionsCents: 2000,
        pensionCents: 19500,
      };
      expect(calculateNetPayroll(150000, deductions)).toBe(113500);
    });

    it('can return negative when deductions exceed gross', () => {
      const deductions: PayrollDeductions = {
        advancesCents: 100000,
        absencesCents: 50000,
        otherDeductionsCents: 20000,
        pensionCents: 19500,
      };
      expect(calculateNetPayroll(150000, deductions)).toBe(-39500);
    });
  });

  describe('generatePLAMERecord', () => {
    it('should generate pipe-delimited record with 8 fields', () => {
      const payroll = makePayrollRow() as unknown as PayrollResult;
      const employee = { dni: '12345678', name: 'Juan Perez', pension_system: 'ONP' };

      const plame = generatePLAMERecord(payroll, employee);
      const fields = plame.split('|');

      expect(fields).toHaveLength(8);
      expect(fields[0]).toBe('12345678');
      expect(fields[1]).toBe('Juan Perez');
      expect(fields[2]).toBe(PERIOD);
      expect(fields[3]).toBe(String(payroll.gross_salary_cents));
      expect(fields[4]).toBe(String(payroll.net_salary_cents));
      expect(fields[5]).toBe('ONP');
      expect(fields[6]).toBe(String(payroll.pension_cents));
      expect(fields[7]).toBe(String(payroll.essalud_cents));
    });
  });

  // ========================================================================
  // calculateForEmployee
  // ========================================================================

  describe('calculateForEmployee', () => {
    it('should create payroll record in DB and emit PAYROLL_CALCULATED event', async () => {
      const employee = makeEmployeeRow();
      const attendance = makeAttendanceRecords(25);
      const payrollRow = makePayrollRow();

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenant_id).toBe(TENANT_ID);
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.period_month).toBe(PERIOD);
      }

      // Verify event was emitted
      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            type: 'PAYROLL_CALCULATED',
            entity_type: 'PAYROLL',
          }),
        }),
      );
    });

    it('should fail if employee not found', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      const result = await service.calculateForEmployee(TENANT_ID, 'non-existent', PERIOD, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should fail if employee is not active', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null); // findFirst with is_active: true returns null

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('should fail with invalid period format', async () => {
      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, '2026/01', ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Invalid period format');
      }
    });

    it('should fail if transaction fails (unique constraint)', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockRejectedValue(new Error('Unique constraint failed'));

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PAYROLL_CALCULATION_FAILED');
      }
    });

    it('should include approved advances in deductions', async () => {
      const employee = makeEmployeeRow();
      const attendance = makeAttendanceRecords(30);
      const advances = [
        { id: 'adv-1', employee_id: EMPLOYEE_ID, amount_cents: 20000, status: 'APPROVED' },
        { id: 'adv-2', employee_id: EMPLOYEE_ID, amount_cents: 10000, status: 'APPROVED' },
      ];
      const payrollRow = makePayrollRow({ advances_cents: 30000 });

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue(advances);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);

      // Verify that advance amount was passed to the create call
      expect(mockTx.payroll_records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            advances_cents: 30000,
          }),
        }),
      );
    });

    it('should calculate overtime from attendance records', async () => {
      const employee = makeEmployeeRow();
      // 25 days present with 60 min overtime per day = 25 hours total overtime
      const attendance = makeAttendanceRecords(25, { overtime_minutes: 60 });
      const payrollRow = makePayrollRow({ overtime_hours: 25 });

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);

      // Verify overtime_hours was passed
      const createCall = mockTx.payroll_records.create.mock.calls[0][0];
      expect(createCall.data.overtime_hours).toBe(25);
    });

    it('should count absences from attendance records', async () => {
      const employee = makeEmployeeRow();
      const attendance = [
        ...makeAttendanceRecords(25),
        ...makeAttendanceRecords(3, { status: 'ABSENT', worked_minutes: 0, overtime_minutes: 0 }),
      ];
      const payrollRow = makePayrollRow({ absences_count: 3, days_worked: 27 });

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);

      const createCall = mockTx.payroll_records.create.mock.calls[0][0];
      expect(createCall.data.absences_count).toBe(3);
      expect(createCall.data.days_worked).toBe(27);
    });

    it('should calculate EsSalud and pension correctly', async () => {
      const employee = makeEmployeeRow({ pension_system: 'AFP_PRIMA' });
      const attendance = makeAttendanceRecords(30);
      const payrollRow = makePayrollRow();

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      const createCall = mockTx.payroll_records.create.mock.calls[0][0];
      // EsSalud = 9% of 150000 = 13500
      expect(createCall.data.essalud_cents).toBe(13500);
      // AFP pension = 13% of 150000 = 19500
      expect(createCall.data.pension_cents).toBe(19500);
    });

    it('should handle employee with commission rate', async () => {
      const employee = makeEmployeeRow({ commission_rate: 0.05 }); // 5% commission
      const attendance = makeAttendanceRecords(30);
      const payrollRow = makePayrollRow({ commission_cents: 7500 });

      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue(attendance);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(payrollRow);
      mockTx.events.create.mockResolvedValue({});

      await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      const createCall = mockTx.payroll_records.create.mock.calls[0][0];
      // commission = 150000 * 0.05 = 7500
      expect(createCall.data.commission_cents).toBe(7500);
    });
  });

  // ========================================================================
  // calculateMonthly
  // ========================================================================

  describe('calculateMonthly', () => {
    it('should process all active employees', async () => {
      const emp1 = makeEmployeeRow({ id: 'emp-1' });
      const emp2 = makeEmployeeRow({ id: 'emp-2' });

      mockPrisma.employees.findMany.mockResolvedValue([emp1, emp2]);

      // For each employee, mock the individual calls
      mockPrisma.employees.findFirst
        .mockResolvedValueOnce(emp1)
        .mockResolvedValueOnce(emp2);
      mockPrisma.attendance.findMany.mockResolvedValue(makeAttendanceRecords(30));
      mockPrisma.advances.findMany.mockResolvedValue([]);

      const row1 = makePayrollRow({ id: 'payroll-1', employee_id: 'emp-1' });
      const row2 = makePayrollRow({ id: 'payroll-2', employee_id: 'emp-2' });

      mockTx.payroll_records.create
        .mockResolvedValueOnce(row1)
        .mockResolvedValueOnce(row2);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateMonthly(TENANT_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(2);
        expect(result.data.successful).toHaveLength(2);
        expect(result.data.failed).toHaveLength(0);
      }
    });

    it('should skip employees that error and continue with rest', async () => {
      const emp1 = makeEmployeeRow({ id: 'emp-1' });
      const emp2 = makeEmployeeRow({ id: 'emp-2' });

      mockPrisma.employees.findMany.mockResolvedValue([emp1, emp2]);

      // emp-1 will fail (not found on the second query), emp-2 will succeed
      mockPrisma.employees.findFirst
        .mockResolvedValueOnce(null) // emp-1 not found
        .mockResolvedValueOnce(emp2);
      mockPrisma.attendance.findMany.mockResolvedValue(makeAttendanceRecords(30));
      mockPrisma.advances.findMany.mockResolvedValue([]);

      const row2 = makePayrollRow({ id: 'payroll-2', employee_id: 'emp-2' });
      mockTx.payroll_records.create.mockResolvedValue(row2);
      mockTx.events.create.mockResolvedValue({});

      const result = await service.calculateMonthly(TENANT_ID, PERIOD, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(2);
        expect(result.data.successful).toHaveLength(1);
        expect(result.data.failed).toHaveLength(1);
        expect(result.data.failed[0].employeeId).toBe('emp-1');
      }
    });

    it('should fail with invalid period format', async () => {
      const result = await service.calculateMonthly(TENANT_ID, 'invalid', ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });

  // ========================================================================
  // getByEmployeePeriod
  // ========================================================================

  describe('getByEmployeePeriod', () => {
    it('should return correct payroll record', async () => {
      const row = makePayrollRow();
      mockPrisma.payroll_records.findFirst.mockResolvedValue(row);

      const result = await service.getByEmployeePeriod(TENANT_ID, EMPLOYEE_ID, PERIOD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.period_month).toBe(PERIOD);
        expect(result.data.tenant_id).toBe(TENANT_ID);
      }

      expect(mockPrisma.payroll_records.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          employee_id: EMPLOYEE_ID,
          period_month: PERIOD,
        },
      });
    });

    it('should return NOT_FOUND for missing payroll', async () => {
      mockPrisma.payroll_records.findFirst.mockResolvedValue(null);

      const result = await service.getByEmployeePeriod(TENANT_ID, EMPLOYEE_ID, '2026-12');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ========================================================================
  // listByPeriod
  // ========================================================================

  describe('listByPeriod', () => {
    it('should return all payroll records for a period', async () => {
      const rows = [
        makePayrollRow({ id: 'p-1', employee_id: 'emp-1' }),
        makePayrollRow({ id: 'p-2', employee_id: 'emp-2' }),
      ];
      mockPrisma.payroll_records.findMany.mockResolvedValue(rows);

      const result = await service.listByPeriod(TENANT_ID, PERIOD);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('p-1');
        expect(result.data[1].id).toBe('p-2');
      }

      expect(mockPrisma.payroll_records.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          period_month: PERIOD,
        },
        orderBy: { calculated_at: 'desc' },
      });
    });

    it('should return empty array when no records found', async () => {
      mockPrisma.payroll_records.findMany.mockResolvedValue([]);

      const result = await service.listByPeriod(TENANT_ID, '2026-12');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should always filter by tenant_id (tenant isolation)', async () => {
      mockPrisma.payroll_records.findMany.mockResolvedValue([]);

      await service.listByPeriod(TENANT_ID, PERIOD);

      const call = mockPrisma.payroll_records.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(TENANT_ID);
    });
  });

  // ========================================================================
  // getHistory
  // ========================================================================

  describe('getHistory', () => {
    it('should return payroll records sorted by period descending', async () => {
      const rows = [
        makePayrollRow({ id: 'p-3', period_month: '2026-03' }),
        makePayrollRow({ id: 'p-2', period_month: '2026-02' }),
        makePayrollRow({ id: 'p-1', period_month: '2026-01' }),
      ];
      mockPrisma.payroll_records.findMany.mockResolvedValue(rows);

      const result = await service.getHistory(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].period_month).toBe('2026-03');
        expect(result.data[2].period_month).toBe('2026-01');
      }

      expect(mockPrisma.payroll_records.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          employee_id: EMPLOYEE_ID,
        },
        orderBy: { period_month: 'desc' },
      });
    });

    it('should return empty array for employee with no history', async () => {
      mockPrisma.payroll_records.findMany.mockResolvedValue([]);

      const result = await service.getHistory(TENANT_ID, 'new-employee');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('should filter by tenant_id (tenant isolation)', async () => {
      mockPrisma.payroll_records.findMany.mockResolvedValue([]);

      await service.getHistory(TENANT_ID, EMPLOYEE_ID);

      const call = mockPrisma.payroll_records.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(TENANT_ID);
      expect(call.where.employee_id).toBe(EMPLOYEE_ID);
    });
  });

  // ========================================================================
  // Tenant Isolation
  // ========================================================================

  describe('tenant isolation', () => {
    it('calculateForEmployee: queries employee with tenant_id', async () => {
      mockPrisma.employees.findFirst.mockResolvedValue(null);

      await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(mockPrisma.employees.findFirst).toHaveBeenCalledWith({
        where: { id: EMPLOYEE_ID, tenant_id: TENANT_ID, is_active: true },
      });
    });

    it('calculateForEmployee: includes tenant_id in payroll record', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(makePayrollRow());
      mockTx.events.create.mockResolvedValue({});

      await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(mockTx.payroll_records.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('calculateForEmployee: includes tenant_id in event', async () => {
      const employee = makeEmployeeRow();
      mockPrisma.employees.findFirst.mockResolvedValue(employee);
      mockPrisma.attendance.findMany.mockResolvedValue([]);
      mockPrisma.advances.findMany.mockResolvedValue([]);
      mockTx.payroll_records.create.mockResolvedValue(makePayrollRow());
      mockTx.events.create.mockResolvedValue({});

      await service.calculateForEmployee(TENANT_ID, EMPLOYEE_ID, PERIOD, ACTOR_ID);

      expect(mockTx.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('getByEmployeePeriod: queries with tenant_id', async () => {
      mockPrisma.payroll_records.findFirst.mockResolvedValue(null);

      await service.getByEmployeePeriod(TENANT_ID, EMPLOYEE_ID, PERIOD);

      expect(mockPrisma.payroll_records.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          employee_id: EMPLOYEE_ID,
          period_month: PERIOD,
        },
      });
    });
  });
});
