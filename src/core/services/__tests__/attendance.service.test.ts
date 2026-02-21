/**
 * AttendanceService Unit Tests
 *
 * Uses mocked Prisma to test:
 * - clockIn: creates record with correct status, detects lateness
 * - clockOut: calculates worked/overtime minutes
 * - justifyAbsence: changes status to JUSTIFIED
 * - detectAbsences: finds missing employees
 * - getMonthlyReport: aggregates correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttendanceService } from '../attendance.service';
import { AttendanceStatus } from '@/src/core/types/shared';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockPrisma = {
  attendance: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  employee_schedules: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AttendanceService', () => {
  let service: AttendanceService;
  const tenantId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const employeeId = '00000000-0000-4000-a000-000000000001';

  beforeEach(() => {
    service = new AttendanceService(mockPrisma);
    vi.clearAllMocks();
  });

  // =========================================================================
  // clockIn
  // =========================================================================

  describe('clockIn', () => {
    it('creates a PRESENT record when no schedule provided and no prior clock-in', async () => {
      const clockInTime = new Date('2026-02-19T08:00:00.000Z');

      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.attendance.create.mockImplementation(({ data }: any) => ({
        ...data,
        clock_out: null,
      }));

      const result = await service.clockIn(tenantId, employeeId, clockInTime);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(AttendanceStatus.PRESENT);
        expect(result.data.tenant_id).toBe(tenantId);
        expect(result.data.employee_id).toBe(employeeId);
        expect(result.data.late_minutes).toBe(0);
      }

      expect(mockPrisma.attendance.create).toHaveBeenCalledTimes(1);
    });

    it('detects lateness when schedule is provided and clock-in is after start', async () => {
      const clockInTime = new Date('2026-02-19T08:30:00.000Z');
      const scheduleId = '00000000-0000-4000-a000-000000000099';

      mockPrisma.attendance.findFirst.mockResolvedValue(null);
      mockPrisma.employee_schedules.findFirst.mockResolvedValue({
        id: scheduleId,
        tenant_id: tenantId,
        employee_id: employeeId,
        template: {
          location_id: 'loc-001',
          start_time: '08:00',
          end_time: '17:00',
          break_minutes: 60,
          days_of_week: [1, 2, 3, 4, 5],
        },
      });
      mockPrisma.attendance.create.mockImplementation(({ data }: any) => ({
        ...data,
        clock_out: null,
      }));

      const result = await service.clockIn(tenantId, employeeId, clockInTime, scheduleId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(AttendanceStatus.LATE);
        expect(result.data.late_minutes).toBe(30);
        expect(result.data.scheduled_minutes).toBe(480); // 9h - 1h break
      }
    });

    it('returns ConflictError when employee already clocked in for the day', async () => {
      const clockInTime = new Date('2026-02-19T08:00:00.000Z');

      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: 'existing-id',
        tenant_id: tenantId,
        employee_id: employeeId,
      });

      const result = await service.clockIn(tenantId, employeeId, clockInTime);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
      }
    });
  });

  // =========================================================================
  // clockOut
  // =========================================================================

  describe('clockOut', () => {
    it('calculates worked and overtime minutes correctly', async () => {
      const attendanceId = '00000000-0000-4000-a000-000000000010';
      const clockOutTime = new Date('2026-02-19T18:00:00.000Z');

      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        clock_in: new Date('2026-02-19T08:00:00.000Z'),
        clock_out: null,
        breaks: [],
        scheduled_minutes: 480,
      });

      mockPrisma.attendance.update.mockImplementation(({ data }: any) => ({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        location_id: '',
        schedule_id: null,
        date: new Date('2026-02-19'),
        clock_in: new Date('2026-02-19T08:00:00.000Z'),
        clock_out: clockOutTime,
        breaks: [],
        scheduled_minutes: 480,
        worked_minutes: data.worked_minutes,
        overtime_minutes: data.overtime_minutes,
        late_minutes: 0,
        early_leave_minutes: 0,
        status: 'PRESENT',
        notes: null,
        created_at: new Date(),
        updated_at: data.updated_at,
      }));

      const result = await service.clockOut(tenantId, attendanceId, clockOutTime);

      expect(result.success).toBe(true);
      if (result.success) {
        // 10h = 600 min worked, 600-480 = 120 min overtime
        expect(result.data.worked_minutes).toBe(600);
        expect(result.data.overtime_minutes).toBe(120);
      }
    });

    it('returns NotFoundError when attendance record does not exist', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(null);

      const result = await service.clockOut(tenantId, 'nonexistent-id', new Date());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns ConflictError when already clocked out', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: 'att-id',
        tenant_id: tenantId,
        clock_out: new Date('2026-02-19T17:00:00.000Z'),
      });

      const result = await service.clockOut(tenantId, 'att-id', new Date());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CONFLICT');
      }
    });

    it('subtracts break time from worked minutes', async () => {
      const attendanceId = 'att-breaks';
      const clockOutTime = new Date('2026-02-19T17:00:00.000Z');

      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        clock_in: new Date('2026-02-19T08:00:00.000Z'),
        clock_out: null,
        breaks: [
          { start: '2026-02-19T12:00:00Z', end: '2026-02-19T13:00:00Z', duration_mins: 60 },
        ],
        scheduled_minutes: 480,
      });

      mockPrisma.attendance.update.mockImplementation(({ data }: any) => ({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        location_id: '',
        schedule_id: null,
        date: new Date('2026-02-19'),
        clock_in: new Date('2026-02-19T08:00:00.000Z'),
        clock_out: clockOutTime,
        breaks: [{ start: '2026-02-19T12:00:00Z', end: '2026-02-19T13:00:00Z', duration_mins: 60 }],
        scheduled_minutes: 480,
        worked_minutes: data.worked_minutes,
        overtime_minutes: data.overtime_minutes,
        late_minutes: 0,
        early_leave_minutes: 0,
        status: 'PRESENT',
        notes: null,
        created_at: new Date(),
        updated_at: data.updated_at,
      }));

      const result = await service.clockOut(tenantId, attendanceId, clockOutTime);

      expect(result.success).toBe(true);
      if (result.success) {
        // 9h = 540 total, minus 60 break = 480 worked, 0 overtime
        expect(result.data.worked_minutes).toBe(480);
        expect(result.data.overtime_minutes).toBe(0);
      }
    });
  });

  // =========================================================================
  // justifyAbsence
  // =========================================================================

  describe('justifyAbsence', () => {
    it('changes status to JUSTIFIED and stores justification', async () => {
      const attendanceId = 'att-absent';

      mockPrisma.attendance.findFirst.mockResolvedValue({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        status: AttendanceStatus.ABSENT,
      });

      mockPrisma.attendance.update.mockImplementation(({ data }: any) => ({
        id: attendanceId,
        tenant_id: tenantId,
        employee_id: employeeId,
        location_id: '',
        schedule_id: null,
        date: new Date('2026-02-19'),
        clock_in: new Date('2026-02-19'),
        clock_out: null,
        breaks: [],
        scheduled_minutes: 480,
        worked_minutes: 0,
        overtime_minutes: 0,
        late_minutes: 0,
        early_leave_minutes: 0,
        status: data.status,
        notes: data.notes,
        created_at: new Date(),
        updated_at: data.updated_at,
      }));

      const result = await service.justifyAbsence(
        tenantId,
        attendanceId,
        'Medical appointment',
        'https://example.com/cert.pdf',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(AttendanceStatus.JUSTIFIED);
        expect(result.data.notes).toContain('Medical appointment');
        expect(result.data.notes).toContain('https://example.com/cert.pdf');
      }
    });

    it('returns ValidationError when justification is empty', async () => {
      const result = await service.justifyAbsence(tenantId, 'att-1', '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns NotFoundError when attendance record not found', async () => {
      mockPrisma.attendance.findFirst.mockResolvedValue(null);

      const result = await service.justifyAbsence(tenantId, 'nonexistent', 'Reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // =========================================================================
  // detectAbsences
  // =========================================================================

  describe('detectAbsences', () => {
    it('creates ABSENT records for employees who did not clock in', async () => {
      const date = new Date('2026-02-19T00:00:00.000Z'); // Thursday = isoDay 4

      mockPrisma.employee_schedules.findMany.mockResolvedValue([
        {
          employee_id: 'emp-1',
          template: { days_of_week: [1, 2, 3, 4, 5], location_id: 'loc-1' },
        },
        {
          employee_id: 'emp-2',
          template: { days_of_week: [1, 2, 3, 4, 5], location_id: 'loc-1' },
        },
        {
          employee_id: 'emp-3',
          template: { days_of_week: [1, 2, 3], location_id: 'loc-1' }, // not scheduled for Thursday
        },
      ]);

      // emp-1 clocked in, emp-2 did not
      mockPrisma.attendance.findMany.mockResolvedValue([
        { employee_id: 'emp-1' },
      ]);

      mockPrisma.attendance.create.mockImplementation(({ data }: any) => ({
        ...data,
        clock_out: null,
      }));

      const result = await service.detectAbsences(tenantId, date);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].employee_id).toBe('emp-2');
        expect(result.data[0].status).toBe(AttendanceStatus.ABSENT);
      }
    });

    it('returns empty array when all scheduled employees clocked in', async () => {
      const date = new Date('2026-02-19T00:00:00.000Z');

      mockPrisma.employee_schedules.findMany.mockResolvedValue([
        {
          employee_id: 'emp-1',
          template: { days_of_week: [1, 2, 3, 4, 5], location_id: 'loc-1' },
        },
      ]);

      mockPrisma.attendance.findMany.mockResolvedValue([
        { employee_id: 'emp-1' },
      ]);

      const result = await service.detectAbsences(tenantId, date);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns empty array when no employees are scheduled', async () => {
      mockPrisma.employee_schedules.findMany.mockResolvedValue([]);

      const result = await service.detectAbsences(tenantId, new Date('2026-02-19'));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // =========================================================================
  // getMonthlyReport
  // =========================================================================

  describe('getMonthlyReport', () => {
    it('aggregates monthly attendance correctly', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([
        { status: 'PRESENT', worked_minutes: 480, overtime_minutes: 0, late_minutes: 0 },
        { status: 'PRESENT', worked_minutes: 480, overtime_minutes: 0, late_minutes: 0 },
        { status: 'LATE', worked_minutes: 450, overtime_minutes: 0, late_minutes: 30 },
        { status: 'ABSENT', worked_minutes: 0, overtime_minutes: 0, late_minutes: 0 },
        { status: 'JUSTIFIED', worked_minutes: 0, overtime_minutes: 0, late_minutes: 0 },
        { status: 'PRESENT', worked_minutes: 540, overtime_minutes: 60, late_minutes: 0 },
      ]);

      const result = await service.getMonthlyReport(tenantId, employeeId, '2026-02');

      expect(result.success).toBe(true);
      if (result.success) {
        const report = result.data;
        expect(report.total_days).toBe(6);
        expect(report.present_days).toBe(4); // 3 PRESENT + 1 LATE (counted as present)
        expect(report.absent_days).toBe(1);
        expect(report.late_days).toBe(1);
        expect(report.justified_days).toBe(1);
        expect(report.total_worked_minutes).toBe(1950); // 480+480+450+0+0+540
        expect(report.total_overtime_minutes).toBe(60);
        expect(report.total_late_minutes).toBe(30);
      }
    });

    it('returns validation error for invalid month format', async () => {
      const result = await service.getMonthlyReport(tenantId, employeeId, 'invalid');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns empty report when no records exist', async () => {
      mockPrisma.attendance.findMany.mockResolvedValue([]);

      const result = await service.getMonthlyReport(tenantId, employeeId, '2026-02');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_days).toBe(0);
        expect(result.data.present_days).toBe(0);
        expect(result.data.absent_days).toBe(0);
        expect(result.data.total_worked_minutes).toBe(0);
      }
    });
  });

  // =========================================================================
  // Pure calculation helpers
  // =========================================================================

  describe('calculateHoursWorked', () => {
    it('calculates difference between clock_in and clock_out in minutes', () => {
      const clockIn = new Date('2026-02-19T08:00:00.000Z');
      const clockOut = new Date('2026-02-19T17:00:00.000Z');

      expect(service.calculateHoursWorked(clockIn, clockOut)).toBe(540);
    });

    it('subtracts break durations', () => {
      const clockIn = new Date('2026-02-19T08:00:00.000Z');
      const clockOut = new Date('2026-02-19T17:00:00.000Z');
      const breaks = [
        { start: '2026-02-19T12:00:00Z', end: '2026-02-19T13:00:00Z', duration_mins: 60 },
      ];

      expect(service.calculateHoursWorked(clockIn, clockOut, breaks)).toBe(480);
    });

    it('returns 0 when clock_out is before clock_in', () => {
      const clockIn = new Date('2026-02-19T17:00:00.000Z');
      const clockOut = new Date('2026-02-19T08:00:00.000Z');

      expect(service.calculateHoursWorked(clockIn, clockOut)).toBe(0);
    });
  });

  describe('calculateOvertime', () => {
    it('returns overtime when worked > standard', () => {
      expect(service.calculateOvertime(600, 480)).toBe(120);
    });

    it('returns 0 when worked <= standard', () => {
      expect(service.calculateOvertime(480, 480)).toBe(0);
      expect(service.calculateOvertime(400, 480)).toBe(0);
    });

    it('uses 480 as default standard minutes', () => {
      expect(service.calculateOvertime(500)).toBe(20);
    });
  });

  describe('calculateLateness', () => {
    it('returns positive minutes when clock_in is after scheduled start', () => {
      const clockIn = new Date('2026-02-19T08:30:00.000Z');
      const scheduledStart = new Date('2026-02-19T08:00:00.000Z');

      expect(service.calculateLateness(clockIn, scheduledStart)).toBe(30);
    });

    it('returns 0 when clock_in is before or at scheduled start', () => {
      const clockIn = new Date('2026-02-19T07:50:00.000Z');
      const scheduledStart = new Date('2026-02-19T08:00:00.000Z');

      expect(service.calculateLateness(clockIn, scheduledStart)).toBe(0);
    });
  });
});
