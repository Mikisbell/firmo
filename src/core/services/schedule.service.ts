/**
 * Schedule Service - Business Logic Layer
 *
 * Enterprise-grade schedule management service implementing:
 * - Schedule template creation and management
 * - Template-to-employee assignment
 * - Schedule generation from templates
 * - Weekly calendar views per location
 * - Shift change request workflow (request/approve/reject)
 * - Schedule conflict detection
 *
 * All operations are multi-tenant: every query filters by tenant_id.
 *
 * @module core/services/schedule.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  Result,
  ok,
  err,
  DomainError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/src/core/result';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateTemplateInput {
  location_id: string;
  name: string;
  schedule_type: 'FIXED' | 'ROTATING';
  days_of_week: number[]; // 1=Monday ... 7=Sunday
  start_time: string;     // "HH:mm"
  end_time: string;       // "HH:mm"
  break_minutes?: number;
}

export interface ScheduleTemplateResult {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  schedule_type: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeScheduleAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  template_id: string;
  start_date: Date;
  end_date: Date | null;
  is_active: boolean;
  created_at: Date;
}

export interface GeneratedSchedule {
  id: string;
  tenant_id: string;
  location_id: string;
  employee_id: string;
  date: Date;
  shift_start: string;
  shift_end: string;
  break_minutes: number;
  status: string;
  created_by: string;
}

export interface WeeklyCalendarEntry {
  id: string;
  employee_id: string;
  date: Date;
  shift_start: string;
  shift_end: string;
  break_minutes: number;
  status: string;
  notes: string | null;
}

export interface ShiftChangeRequestInput {
  target_employee_id?: string;
  original_date: Date;
  new_date?: Date;
  reason: string;
}

export interface ShiftChangeRequestResult {
  id: string;
  tenant_id: string;
  requester_id: string;
  target_employee_id: string | null;
  original_date: Date;
  new_date: Date | null;
  reason: string;
  status: string;
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
}

export interface ScheduleConflict {
  existing_schedule_id: string;
  date: Date;
  shift_start: string;
  shift_end: string;
}

// ============================================================================
// ScheduleService
// ============================================================================

export class ScheduleService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Template Management
  // ==========================================================================

  /**
   * Create a new schedule template for a location.
   */
  async createTemplate(
    tenantId: string,
    input: CreateTemplateInput
  ): Promise<Result<ScheduleTemplateResult, DomainError>> {
    // Validate days_of_week
    if (!input.days_of_week || input.days_of_week.length === 0) {
      return err(new ValidationError('days_of_week must contain at least one day', 'days_of_week'));
    }
    for (const day of input.days_of_week) {
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        return err(new ValidationError('days_of_week values must be integers between 1 and 7', 'days_of_week'));
      }
    }

    // Validate time format
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(input.start_time)) {
      return err(new ValidationError('start_time must be in HH:mm format', 'start_time'));
    }
    if (!timeRegex.test(input.end_time)) {
      return err(new ValidationError('end_time must be in HH:mm format', 'end_time'));
    }

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      return err(new ValidationError('Template name is required', 'name'));
    }

    const id = uuidv4();
    const now = new Date();

    const template = await this.prisma.schedule_templates.create({
      data: {
        id,
        tenant_id: tenantId,
        location_id: input.location_id,
        name: input.name.trim(),
        schedule_type: input.schedule_type,
        days_of_week: input.days_of_week,
        start_time: input.start_time,
        end_time: input.end_time,
        break_minutes: input.break_minutes ?? 60,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });

    return ok({
      id: template.id,
      tenant_id: template.tenant_id,
      location_id: template.location_id,
      name: template.name,
      schedule_type: template.schedule_type,
      days_of_week: template.days_of_week,
      start_time: template.start_time,
      end_time: template.end_time,
      break_minutes: template.break_minutes,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
    });
  }

  // ==========================================================================
  // Employee Assignment
  // ==========================================================================

  /**
   * Assign a schedule template to an employee.
   */
  async assignToEmployee(
    tenantId: string,
    employeeId: string,
    templateId: string,
    startDate: Date
  ): Promise<Result<EmployeeScheduleAssignment, DomainError>> {
    // Verify template exists and belongs to tenant
    const template = await this.prisma.schedule_templates.findFirst({
      where: { id: templateId, tenant_id: tenantId, is_active: true },
    });

    if (!template) {
      return err(new NotFoundError('ScheduleTemplate', templateId));
    }

    // Deactivate any existing active assignment for this employee
    await this.prisma.employee_schedules.updateMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        is_active: true,
      },
      data: { is_active: false, end_date: startDate },
    });

    const id = uuidv4();
    const assignment = await this.prisma.employee_schedules.create({
      data: {
        id,
        tenant_id: tenantId,
        employee_id: employeeId,
        template_id: templateId,
        start_date: startDate,
        end_date: null,
        is_active: true,
        created_at: new Date(),
      },
    });

    return ok({
      id: assignment.id,
      tenant_id: assignment.tenant_id,
      employee_id: assignment.employee_id,
      template_id: assignment.template_id,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      is_active: assignment.is_active,
      created_at: assignment.created_at,
    });
  }

  // ==========================================================================
  // Schedule Generation
  // ==========================================================================

  /**
   * Generate individual schedule entries from a template for all assigned
   * employees over a date range.
   *
   * Only generates schedules for dates whose ISO day-of-week
   * (1=Monday ... 7=Sunday) appears in the template's days_of_week.
   */
  async generateSchedules(
    tenantId: string,
    templateId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Result<GeneratedSchedule[], DomainError>> {
    if (startDate > endDate) {
      return err(new ValidationError('startDate must be before or equal to endDate', 'startDate'));
    }

    // Fetch template
    const template = await this.prisma.schedule_templates.findFirst({
      where: { id: templateId, tenant_id: tenantId, is_active: true },
    });

    if (!template) {
      return err(new NotFoundError('ScheduleTemplate', templateId));
    }

    // Fetch active employee assignments for this template
    const assignments = await this.prisma.employee_schedules.findMany({
      where: {
        tenant_id: tenantId,
        template_id: templateId,
        is_active: true,
      },
    });

    if (assignments.length === 0) {
      return ok([]);
    }

    const generated: GeneratedSchedule[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      // getDay(): 0=Sunday ... 6=Saturday -> convert to ISO 1=Monday ... 7=Sunday
      const jsDay = current.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      if (template.days_of_week.includes(isoDay)) {
        for (const assignment of assignments) {
          const id = uuidv4();
          const scheduleDate = new Date(current);

          const schedule = await this.prisma.schedules.create({
            data: {
              id,
              tenant_id: tenantId,
              location_id: template.location_id,
              employee_id: assignment.employee_id,
              date: scheduleDate,
              shift_start: template.start_time,
              shift_end: template.end_time,
              break_minutes: template.break_minutes,
              status: 'SCHEDULED',
              created_by: tenantId, // system-generated
              created_at: new Date(),
              updated_at: new Date(),
            },
          });

          generated.push({
            id: schedule.id,
            tenant_id: schedule.tenant_id,
            location_id: schedule.location_id,
            employee_id: schedule.employee_id,
            date: schedule.date,
            shift_start: schedule.shift_start,
            shift_end: schedule.shift_end,
            break_minutes: schedule.break_minutes,
            status: schedule.status,
            created_by: schedule.created_by,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return ok(generated);
  }

  // ==========================================================================
  // Weekly Calendar
  // ==========================================================================

  /**
   * Get all schedules for a location for a given week (7 days starting from weekStart).
   */
  async getWeeklyCalendar(
    tenantId: string,
    locationId: string,
    weekStart: Date
  ): Promise<Result<WeeklyCalendarEntry[], DomainError>> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const schedules = await this.prisma.schedules.findMany({
      where: {
        tenant_id: tenantId,
        location_id: locationId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: [{ date: 'asc' }, { shift_start: 'asc' }],
    });

    const entries: WeeklyCalendarEntry[] = schedules.map((s) => ({
      id: s.id,
      employee_id: s.employee_id,
      date: s.date,
      shift_start: s.shift_start,
      shift_end: s.shift_end,
      break_minutes: s.break_minutes,
      status: s.status,
      notes: s.notes,
    }));

    return ok(entries);
  }

  // ==========================================================================
  // Shift Change Requests
  // ==========================================================================

  /**
   * Create a shift change request.
   */
  async requestShiftChange(
    tenantId: string,
    requesterId: string,
    data: ShiftChangeRequestInput
  ): Promise<Result<ShiftChangeRequestResult, DomainError>> {
    if (!data.reason || data.reason.trim().length === 0) {
      return err(new ValidationError('Reason is required for shift change request', 'reason'));
    }

    const id = uuidv4();
    const request = await this.prisma.shift_change_requests.create({
      data: {
        id,
        tenant_id: tenantId,
        requester_id: requesterId,
        target_employee_id: data.target_employee_id ?? null,
        original_date: data.original_date,
        new_date: data.new_date ?? null,
        reason: data.reason.trim(),
        status: 'PENDING',
        created_at: new Date(),
      },
    });

    return ok({
      id: request.id,
      tenant_id: request.tenant_id,
      requester_id: request.requester_id,
      target_employee_id: request.target_employee_id,
      original_date: request.original_date,
      new_date: request.new_date,
      reason: request.reason,
      status: request.status,
      approved_by: request.approved_by,
      approved_at: request.approved_at,
      rejection_reason: request.rejection_reason,
      created_at: request.created_at,
    });
  }

  /**
   * Approve a shift change request and swap the schedules.
   */
  async approveShiftChange(
    tenantId: string,
    requestId: string,
    approvedBy: string
  ): Promise<Result<ShiftChangeRequestResult, DomainError>> {
    const request = await this.prisma.shift_change_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!request) {
      return err(new NotFoundError('ShiftChangeRequest', requestId));
    }

    if (request.status !== 'PENDING') {
      return err(
        new DomainError(
          `Cannot approve a request with status ${request.status}`,
          'INVALID_STATUS'
        )
      );
    }

    const now = new Date();

    // If there is a target employee, swap the schedule entries
    if (request.target_employee_id) {
      // Find requester's schedule on original_date
      const requesterSchedule = await this.prisma.schedules.findFirst({
        where: {
          tenant_id: tenantId,
          employee_id: request.requester_id,
          date: request.original_date,
        },
      });

      // Find target's schedule on the new_date (or original_date if no new_date)
      const targetDate = request.new_date ?? request.original_date;
      const targetSchedule = await this.prisma.schedules.findFirst({
        where: {
          tenant_id: tenantId,
          employee_id: request.target_employee_id,
          date: targetDate,
        },
      });

      // Swap employee assignments
      if (requesterSchedule) {
        await this.prisma.schedules.update({
          where: { id: requesterSchedule.id },
          data: {
            original_employee_id: request.requester_id,
            employee_id: request.target_employee_id,
            swap_approved_by: approvedBy,
            updated_at: now,
          },
        });
      }

      if (targetSchedule) {
        await this.prisma.schedules.update({
          where: { id: targetSchedule.id },
          data: {
            original_employee_id: request.target_employee_id,
            employee_id: request.requester_id,
            swap_approved_by: approvedBy,
            updated_at: now,
          },
        });
      }
    }

    // Update the request status
    const updated = await this.prisma.shift_change_requests.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approved_by: approvedBy,
        approved_at: now,
      },
    });

    return ok({
      id: updated.id,
      tenant_id: updated.tenant_id,
      requester_id: updated.requester_id,
      target_employee_id: updated.target_employee_id,
      original_date: updated.original_date,
      new_date: updated.new_date,
      reason: updated.reason,
      status: updated.status,
      approved_by: updated.approved_by,
      approved_at: updated.approved_at,
      rejection_reason: updated.rejection_reason,
      created_at: updated.created_at,
    });
  }

  /**
   * Reject a shift change request.
   */
  async rejectShiftChange(
    tenantId: string,
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<Result<ShiftChangeRequestResult, DomainError>> {
    const request = await this.prisma.shift_change_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!request) {
      return err(new NotFoundError('ShiftChangeRequest', requestId));
    }

    if (request.status !== 'PENDING') {
      return err(
        new DomainError(
          `Cannot reject a request with status ${request.status}`,
          'INVALID_STATUS'
        )
      );
    }

    const updated = await this.prisma.shift_change_requests.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approved_by: rejectedBy,
        rejection_reason: reason,
      },
    });

    return ok({
      id: updated.id,
      tenant_id: updated.tenant_id,
      requester_id: updated.requester_id,
      target_employee_id: updated.target_employee_id,
      original_date: updated.original_date,
      new_date: updated.new_date,
      reason: updated.reason,
      status: updated.status,
      approved_by: updated.approved_by,
      approved_at: updated.approved_at,
      rejection_reason: updated.rejection_reason,
      created_at: updated.created_at,
    });
  }

  // ==========================================================================
  // Conflict Detection
  // ==========================================================================

  /**
   * Check for overlapping schedules for an employee on a given date/time range.
   *
   * Two schedules overlap when their time ranges intersect:
   *   existing.shift_start < candidateEnd AND existing.shift_end > candidateStart
   */
  async detectConflicts(
    tenantId: string,
    employeeId: string,
    date: Date,
    shiftStart: string,
    shiftEnd: string
  ): Promise<Result<ScheduleConflict[], DomainError>> {
    const schedules = await this.prisma.schedules.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        date,
      },
    });

    const conflicts: ScheduleConflict[] = [];

    for (const s of schedules) {
      // Time-based overlap check (string comparison works for "HH:mm" format)
      if (s.shift_start < shiftEnd && s.shift_end > shiftStart) {
        conflicts.push({
          existing_schedule_id: s.id,
          date: s.date,
          shift_start: s.shift_start,
          shift_end: s.shift_end,
        });
      }
    }

    return ok(conflicts);
  }
}
