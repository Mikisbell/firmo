/**
 * Attendance Service - Business Logic Layer
 *
 * Implements clock-in/clock-out, absence detection, justification,
 * and monthly reporting for the RRHH module.
 *
 * All operations are multi-tenant: every query filters by tenant_id.
 *
 * Pure calculation helpers (calculateHoursWorked, calculateOvertime,
 * calculateLateness) carry no side effects and can be unit-tested
 * independently.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, NotFoundError, ValidationError, ConflictError } from '@/src/core/result';
import { AttendanceStatus } from '@/src/core/types/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BreakEntry {
  start: string; // ISO timestamp
  end: string;   // ISO timestamp
  duration_mins: number;
}

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  location_id: string;
  employee_id: string;
  schedule_id: string | null;
  date: Date;
  clock_in: Date;
  clock_out: Date | null;
  breaks: BreakEntry[];
  scheduled_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  early_leave_minutes: number;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface MonthlyReport {
  employee_id: string;
  month: string; // "YYYY-MM"
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  justified_days: number;
  total_worked_minutes: number;
  total_overtime_minutes: number;
  total_late_minutes: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AttendanceService {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // clockIn
  // =========================================================================

  /**
   * Record a clock-in for an employee.
   *
   * If a schedule is provided (or found for the employee), lateness is
   * calculated against the scheduled start time.
   */
  async clockIn(
    tenantId: string,
    employeeId: string,
    clockInTime: Date,
    scheduleId?: string,
  ): Promise<Result<AttendanceRecord, DomainError>> {
    // Prevent duplicate clock-in for the same day
    const dateOnly = new Date(clockInTime);
    dateOnly.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.attendance.findFirst({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        date: dateOnly,
      },
    });

    if (existing) {
      return err(new ConflictError(
        'Employee already clocked in for this date',
        'clock_in',
        { employeeId, date: dateOnly.toISOString() },
      ));
    }

    // Resolve schedule to compute lateness / scheduled_minutes
    let lateMinutes = 0;
    let scheduledMinutes = 480; // default 8h
    let resolvedScheduleId: string | null = scheduleId ?? null;
    let locationId = '';

    if (scheduleId) {
      const schedule = await this.prisma.employee_schedules.findFirst({
        where: { id: scheduleId, tenant_id: tenantId, employee_id: employeeId, is_active: true },
        include: { template: true },
      });

      if (schedule?.template) {
        const tmpl = schedule.template;
        locationId = tmpl.location_id;
        resolvedScheduleId = schedule.id;
        const scheduledStart = this.parseTimeOnDate(tmpl.start_time, clockInTime);
        const scheduledEnd = this.parseTimeOnDate(tmpl.end_time, clockInTime);
        scheduledMinutes = Math.round(
          (scheduledEnd.getTime() - scheduledStart.getTime()) / 60_000,
        ) - (tmpl.break_minutes ?? 0);
        lateMinutes = this.calculateLateness(clockInTime, scheduledStart);
      }
    }

    const status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    const id = uuidv4();
    const now = new Date();

    const record = await this.prisma.attendance.create({
      data: {
        id,
        tenant_id: tenantId,
        location_id: locationId,
        employee_id: employeeId,
        schedule_id: resolvedScheduleId,
        date: dateOnly,
        clock_in: clockInTime,
        breaks: [],
        scheduled_minutes: scheduledMinutes,
        worked_minutes: 0,
        overtime_minutes: 0,
        late_minutes: lateMinutes,
        early_leave_minutes: 0,
        status,
        created_at: now,
        updated_at: now,
      },
    });

    return ok(this.toAttendanceRecord(record));
  }

  // =========================================================================
  // clockOut
  // =========================================================================

  /**
   * Record a clock-out for an existing attendance record.
   *
   * Calculates worked_minutes (clock_out - clock_in - breaks) and
   * overtime_minutes (anything above 480 min by default).
   */
  async clockOut(
    tenantId: string,
    attendanceId: string,
    clockOutTime: Date,
  ): Promise<Result<AttendanceRecord, DomainError>> {
    const record = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, tenant_id: tenantId },
    });

    if (!record) {
      return err(new NotFoundError('Attendance', attendanceId));
    }

    if (record.clock_out) {
      return err(new ConflictError(
        'Employee already clocked out',
        'clock_out',
        { attendanceId },
      ));
    }

    const breaks = (record.breaks as unknown ?? []) as BreakEntry[];
    const workedMinutes = this.calculateHoursWorked(record.clock_in, clockOutTime, breaks);
    const overtimeMinutes = this.calculateOvertime(workedMinutes, record.scheduled_minutes || 480);

    const updated = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        clock_out: clockOutTime,
        worked_minutes: workedMinutes,
        overtime_minutes: overtimeMinutes,
        updated_at: new Date(),
      },
    });

    return ok(this.toAttendanceRecord(updated));
  }

  // =========================================================================
  // getByEmployee
  // =========================================================================

  /**
   * Retrieve attendance records for an employee within a date range.
   */
  async getByEmployee(
    tenantId: string,
    employeeId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Result<AttendanceRecord[], DomainError>> {
    const records = await this.prisma.attendance.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return ok(records.map((r) => this.toAttendanceRecord(r)));
  }

  // =========================================================================
  // justifyAbsence
  // =========================================================================

  /**
   * Mark an attendance record as JUSTIFIED (e.g. medical leave).
   */
  async justifyAbsence(
    tenantId: string,
    attendanceId: string,
    justification: string,
    certificateUrl?: string,
  ): Promise<Result<AttendanceRecord, DomainError>> {
    if (!justification || justification.trim().length === 0) {
      return err(new ValidationError('Justification text is required', 'justification'));
    }

    const record = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, tenant_id: tenantId },
    });

    if (!record) {
      return err(new NotFoundError('Attendance', attendanceId));
    }

    const notes = certificateUrl
      ? `${justification} | Certificate: ${certificateUrl}`
      : justification;

    const updated = await this.prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: AttendanceStatus.JUSTIFIED,
        notes,
        updated_at: new Date(),
      },
    });

    return ok(this.toAttendanceRecord(updated));
  }

  // =========================================================================
  // detectAbsences
  // =========================================================================

  /**
   * Find employees who were scheduled to work on `date` but did not clock in.
   * Creates ABSENT attendance records for each missing employee.
   */
  async detectAbsences(
    tenantId: string,
    date: Date,
  ): Promise<Result<AttendanceRecord[], DomainError>> {
    const dateOnly = new Date(date);
    dateOnly.setUTCHours(0, 0, 0, 0);

    // Day of week: JS 0=Sun ... 6=Sat  ->  Prisma schema 1=Mon ... 7=Sun
    const jsDay = dateOnly.getUTCDay(); // 0-6
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1-7

    // Find all active schedules for this date's day-of-week
    const schedules = await this.prisma.employee_schedules.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        start_date: { lte: dateOnly },
        OR: [
          { end_date: null },
          { end_date: { gte: dateOnly } },
        ],
      },
      include: { template: true },
    });

    // Filter to schedules whose template includes this day-of-week
    const scheduledEmployeeIds = schedules
      .filter((s) => s.template.days_of_week.includes(isoDay))
      .map((s) => s.employee_id);

    if (scheduledEmployeeIds.length === 0) {
      return ok([]);
    }

    // Find who already clocked in
    const clockedIn = await this.prisma.attendance.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: { in: scheduledEmployeeIds },
        date: dateOnly,
      },
      select: { employee_id: true },
    });

    const clockedInSet = new Set(clockedIn.map((r) => r.employee_id));
    const absentEmployeeIds = [...new Set(scheduledEmployeeIds)].filter(
      (eid) => !clockedInSet.has(eid),
    );

    if (absentEmployeeIds.length === 0) {
      return ok([]);
    }

    const now = new Date();
    const absenceRecords: AttendanceRecord[] = [];

    for (const employeeId of absentEmployeeIds) {
      const id = uuidv4();
      const record = await this.prisma.attendance.create({
        data: {
          id,
          tenant_id: tenantId,
          location_id: '',
          employee_id: employeeId,
          schedule_id: null,
          date: dateOnly,
          clock_in: dateOnly, // placeholder
          breaks: [],
          scheduled_minutes: 480,
          worked_minutes: 0,
          overtime_minutes: 0,
          late_minutes: 0,
          early_leave_minutes: 0,
          status: AttendanceStatus.ABSENT,
          created_at: now,
          updated_at: now,
        },
      });
      absenceRecords.push(this.toAttendanceRecord(record));
    }

    return ok(absenceRecords);
  }

  // =========================================================================
  // getMonthlyReport
  // =========================================================================

  /**
   * Aggregate attendance data for a given employee/month.
   *
   * @param month - format "YYYY-MM"
   */
  async getMonthlyReport(
    tenantId: string,
    employeeId: string,
    month: string,
  ): Promise<Result<MonthlyReport, DomainError>> {
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(mon) || mon < 1 || mon > 12) {
      return err(new ValidationError('Invalid month format, expected YYYY-MM', 'month'));
    }

    const startDate = new Date(Date.UTC(year, mon - 1, 1));
    const endDate = new Date(Date.UTC(year, mon, 0)); // last day of month

    const records = await this.prisma.attendance.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let justifiedDays = 0;
    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalLateMinutes = 0;

    for (const rec of records) {
      switch (rec.status) {
        case AttendanceStatus.PRESENT:
          presentDays++;
          break;
        case AttendanceStatus.ABSENT:
          absentDays++;
          break;
        case AttendanceStatus.LATE:
          lateDays++;
          presentDays++; // late employees still worked
          break;
        case AttendanceStatus.JUSTIFIED:
          justifiedDays++;
          break;
      }
      totalWorkedMinutes += rec.worked_minutes;
      totalOvertimeMinutes += rec.overtime_minutes;
      totalLateMinutes += rec.late_minutes;
    }

    const report: MonthlyReport = {
      employee_id: employeeId,
      month,
      total_days: records.length,
      present_days: presentDays,
      absent_days: absentDays,
      late_days: lateDays,
      justified_days: justifiedDays,
      total_worked_minutes: totalWorkedMinutes,
      total_overtime_minutes: totalOvertimeMinutes,
      total_late_minutes: totalLateMinutes,
    };

    return ok(report);
  }

  // =========================================================================
  // Pure calculation helpers
  // =========================================================================

  /**
   * Calculate worked time in minutes.
   *
   * worked = (clockOut - clockIn) - sum(break durations)
   * Result is clamped to >= 0.
   */
  calculateHoursWorked(
    clockIn: Date,
    clockOut: Date,
    breaks?: BreakEntry[],
  ): number {
    const totalMs = clockOut.getTime() - clockIn.getTime();
    const totalMinutes = totalMs / 60_000;

    const breakMinutes = (breaks ?? []).reduce(
      (sum, b) => sum + (b.duration_mins ?? 0),
      0,
    );

    return Math.max(0, Math.round(totalMinutes - breakMinutes));
  }

  /**
   * Calculate overtime minutes.
   *
   * overtime = max(0, workedMinutes - standardMinutes)
   * Default standard is 480 min (8 hours).
   */
  calculateOvertime(workedMinutes: number, standardMinutes: number = 480): number {
    return Math.max(0, workedMinutes - standardMinutes);
  }

  /**
   * Calculate late minutes.
   *
   * lateness = max(0, clockIn - scheduledStart) in minutes.
   */
  calculateLateness(clockIn: Date, scheduledStart: Date): number {
    const diffMs = clockIn.getTime() - scheduledStart.getTime();
    return Math.max(0, Math.round(diffMs / 60_000));
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Parse a "HH:MM" time string onto a specific date, returning a Date in UTC.
   */
  private parseTimeOnDate(timeStr: string, referenceDate: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(referenceDate);
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  }

  /**
   * Map a raw Prisma record to the typed AttendanceRecord interface.
   */
  private toAttendanceRecord(raw: any): AttendanceRecord {
    return {
      id: raw.id,
      tenant_id: raw.tenant_id,
      location_id: raw.location_id,
      employee_id: raw.employee_id,
      schedule_id: raw.schedule_id,
      date: raw.date,
      clock_in: raw.clock_in,
      clock_out: raw.clock_out,
      breaks: (raw.breaks ?? []) as BreakEntry[],
      scheduled_minutes: raw.scheduled_minutes,
      worked_minutes: raw.worked_minutes,
      overtime_minutes: raw.overtime_minutes,
      late_minutes: raw.late_minutes,
      early_leave_minutes: raw.early_leave_minutes,
      status: raw.status,
      notes: raw.notes,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }
}
