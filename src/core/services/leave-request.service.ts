/**
 * Leave Request Service - Business Logic Layer for RRHH Module
 *
 * Implements leave request management: vacations, sick leave, personal leave,
 * maternity, and paternity leave for a Peruvian restaurant POS system.
 *
 * Key rules:
 * - Multi-tenant: all operations filter by tenant_id
 * - Event-sourced: all mutations emit events through the events table
 * - Peru: 30 calendar days of vacation per year of service
 * - Only PENDING requests can be approved, rejected, or cancelled
 *
 * @module core/services/leave-request.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Constants
// ============================================================================

/** Peru: 30 calendar days of vacation per year of service */
export const PERU_VACATION_DAYS_PER_YEAR = 30;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateLeaveRequestInput {
  employee_id: string;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  days_requested: number;
  reason?: string;
  with_pay?: boolean;
  certificate_url?: string;
  created_by: string;
}

export interface LeaveRequestResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  days_requested: number;
  reason: string | null;
  with_pay: boolean;
  status: string;
  approved_by: string | null;
  approved_at: Date | null;
  rejection_reason: string | null;
  certificate_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VacationBalanceResult {
  employee_id: string;
  total_earned_days: number;
  total_used_days: number;
  available_days: number;
  hire_date: Date;
  years_of_service: number;
}

export interface ListLeaveRequestsOptions {
  status?: string;
  leave_type?: string;
}

// ============================================================================
// Pure Calculation Helpers (exported for property testing)
// ============================================================================

/**
 * Calculate years of service from hire date to reference date.
 * Returns a non-negative number (floored to integer years).
 */
export function calculateYearsOfService(hireDate: Date, referenceDate: Date): number {
  const diffMs = referenceDate.getTime() - hireDate.getTime();
  if (diffMs <= 0) return 0;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays / 365.25);
}

/**
 * Calculate total earned vacation days based on years of service.
 * Peru: 30 calendar days per year of service.
 */
export function calculateEarnedVacationDays(yearsOfService: number): number {
  return Math.max(0, yearsOfService) * PERU_VACATION_DAYS_PER_YEAR;
}

/**
 * Calculate available vacation days.
 * Available = earned - used, minimum 0.
 */
export function calculateAvailableVacationDays(earnedDays: number, usedDays: number): number {
  return Math.max(0, earnedDays - usedDays);
}

/**
 * Validate leave date range: start_date must be <= end_date.
 */
export function isValidDateRange(startDate: Date, endDate: Date): boolean {
  return startDate.getTime() <= endDate.getTime();
}

/**
 * Check if a status transition is valid for leave requests.
 * Valid transitions: PENDING -> APPROVED | REJECTED | CANCELLED
 */
export function isValidLeaveStatusTransition(from: string, to: string): boolean {
  if (from !== 'PENDING') return false;
  return to === 'APPROVED' || to === 'REJECTED' || to === 'CANCELLED';
}

// ============================================================================
// LeaveRequestService
// ============================================================================

export class LeaveRequestService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Create Leave Request
  // ==========================================================================

  async create(
    tenantId: string,
    data: CreateLeaveRequestInput,
  ): Promise<Result<LeaveRequestResult, DomainError>> {
    // Validate days_requested > 0
    if (data.days_requested <= 0) {
      return err(
        new ValidationError(
          'Days requested must be greater than 0',
          'days_requested',
          { actual: data.days_requested },
        ),
      );
    }

    // Validate days_requested is integer
    if (!Number.isInteger(data.days_requested)) {
      return err(
        new ValidationError(
          'Days requested must be an integer',
          'days_requested',
        ),
      );
    }

    // Validate date range
    if (!isValidDateRange(data.start_date, data.end_date)) {
      return err(
        new ValidationError(
          'Start date must be before or equal to end date',
          'start_date',
          {
            start_date: data.start_date.toISOString(),
            end_date: data.end_date.toISOString(),
          },
        ),
      );
    }

    // Validate employee exists and is active
    const employee = await this.prisma.employees.findFirst({
      where: {
        id: data.employee_id,
        tenant_id: tenantId,
      },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', data.employee_id));
    }

    if (!employee.is_active) {
      return err(
        new ValidationError(
          'Employee is not active',
          'employee_id',
          { employee_id: data.employee_id },
        ),
      );
    }

    const requestId = uuidv4();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const leaveRequest = await tx.leave_requests.create({
          data: {
            id: requestId,
            tenant_id: tenantId,
            employee_id: data.employee_id,
            leave_type: data.leave_type,
            start_date: data.start_date,
            end_date: data.end_date,
            days_requested: data.days_requested,
            reason: data.reason ?? null,
            with_pay: data.with_pay ?? true,
            status: 'PENDING',
            certificate_url: data.certificate_url ?? null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        // Emit LEAVE_REQUEST_CREATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'LEAVE_REQUEST_CREATED',
            entity_type: 'LEAVE_REQUEST',
            entity_id: requestId,
            actor_id: data.created_by,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              leave_request_id: requestId,
              employee_id: data.employee_id,
              leave_type: data.leave_type,
              start_date: data.start_date.toISOString(),
              end_date: data.end_date.toISOString(),
              days_requested: data.days_requested,
            },
          },
        });

        return leaveRequest;
      },
      { maxRetries: 3 },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId },
        'Failed to create leave request',
      );
      return err(
        new DomainError('Failed to create leave request', 'LEAVE_REQUEST_CREATION_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { requestId, tenantId, employeeId: data.employee_id },
      'Leave request created successfully',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Approve Leave Request
  // ==========================================================================

  async approve(
    tenantId: string,
    requestId: string,
    approvedBy: string,
  ): Promise<Result<LeaveRequestResult, DomainError>> {
    const existing = await this.prisma.leave_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('LeaveRequest', requestId));
    }

    if (existing.status !== 'PENDING') {
      return err(
        new ValidationError(
          `Cannot approve a leave request with status '${existing.status}'. Only PENDING requests can be approved.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const now = new Date();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.leave_requests.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            approved_by: approvedBy,
            approved_at: now,
            updated_at: now,
          },
        });

        // Emit LEAVE_REQUEST_APPROVED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: now,
            type: 'LEAVE_REQUEST_APPROVED',
            entity_type: 'LEAVE_REQUEST',
            entity_id: requestId,
            actor_id: approvedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              leave_request_id: requestId,
              employee_id: existing.employee_id,
              approved_by: approvedBy,
            },
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, requestId },
        'Failed to approve leave request',
      );
      return err(
        new DomainError('Failed to approve leave request', 'LEAVE_REQUEST_APPROVAL_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { requestId, tenantId, approvedBy },
      'Leave request approved',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Reject Leave Request
  // ==========================================================================

  async reject(
    tenantId: string,
    requestId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<Result<LeaveRequestResult, DomainError>> {
    if (!reason || reason.trim().length === 0) {
      return err(
        new ValidationError('Rejection reason is required', 'rejection_reason'),
      );
    }

    const existing = await this.prisma.leave_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('LeaveRequest', requestId));
    }

    if (existing.status !== 'PENDING') {
      return err(
        new ValidationError(
          `Cannot reject a leave request with status '${existing.status}'. Only PENDING requests can be rejected.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const now = new Date();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.leave_requests.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            approved_by: rejectedBy,
            approved_at: now,
            rejection_reason: reason.trim(),
            updated_at: now,
          },
        });

        // Emit LEAVE_REQUEST_REJECTED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: now,
            type: 'LEAVE_REQUEST_REJECTED',
            entity_type: 'LEAVE_REQUEST',
            entity_id: requestId,
            actor_id: rejectedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              leave_request_id: requestId,
              employee_id: existing.employee_id,
              rejected_by: rejectedBy,
              reason: reason.trim(),
            },
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, requestId },
        'Failed to reject leave request',
      );
      return err(
        new DomainError('Failed to reject leave request', 'LEAVE_REQUEST_REJECTION_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { requestId, tenantId, rejectedBy, reason },
      'Leave request rejected',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Cancel Leave Request
  // ==========================================================================

  async cancel(
    tenantId: string,
    requestId: string,
  ): Promise<Result<LeaveRequestResult, DomainError>> {
    const existing = await this.prisma.leave_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('LeaveRequest', requestId));
    }

    if (existing.status !== 'PENDING') {
      return err(
        new ValidationError(
          `Cannot cancel a leave request with status '${existing.status}'. Only PENDING requests can be cancelled.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const now = new Date();

    const updated = await this.prisma.leave_requests.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        updated_at: now,
      },
    });

    pinoLogger.info(
      { requestId, tenantId },
      'Leave request cancelled',
    );

    return ok(this.mapToResult(updated));
  }

  // ==========================================================================
  // Get By ID
  // ==========================================================================

  async getById(
    tenantId: string,
    requestId: string,
  ): Promise<Result<LeaveRequestResult, DomainError>> {
    const leaveRequest = await this.prisma.leave_requests.findFirst({
      where: { id: requestId, tenant_id: tenantId },
    });

    if (!leaveRequest) {
      return err(new NotFoundError('LeaveRequest', requestId));
    }

    return ok(this.mapToResult(leaveRequest));
  }

  // ==========================================================================
  // List By Employee
  // ==========================================================================

  async listByEmployee(
    tenantId: string,
    employeeId: string,
    options?: ListLeaveRequestsOptions,
  ): Promise<Result<LeaveRequestResult[], DomainError>> {
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      employee_id: employeeId,
    };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.leave_type) {
      where.leave_type = options.leave_type;
    }

    const requests = await this.prisma.leave_requests.findMany({
      where: where as any,
      orderBy: { created_at: 'desc' },
    });

    return ok(requests.map((r: any) => this.mapToResult(r)));
  }

  // ==========================================================================
  // Get Vacation Balance
  // ==========================================================================

  /**
   * Calculate vacation balance for an employee.
   * Peru: 30 calendar days per year of service.
   * Balance = (years_of_service * 30) - approved_vacation_days_used
   */
  async getVacationBalance(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<VacationBalanceResult, DomainError>> {
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, tenant_id: tenantId },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', employeeId));
    }

    const hireDate = employee.hire_date ?? new Date();
    const now = new Date();

    const yearsOfService = calculateYearsOfService(hireDate, now);
    const totalEarnedDays = calculateEarnedVacationDays(yearsOfService);

    // Count approved vacation days used
    const approvedVacations = await this.prisma.leave_requests.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        leave_type: 'VACATION',
        status: 'APPROVED',
      },
      select: { days_requested: true },
    });

    const totalUsedDays = approvedVacations.reduce(
      (sum: number, r: any) => sum + r.days_requested,
      0,
    );

    const availableDays = calculateAvailableVacationDays(totalEarnedDays, totalUsedDays);

    return ok({
      employee_id: employeeId,
      total_earned_days: totalEarnedDays,
      total_used_days: totalUsedDays,
      available_days: availableDays,
      hire_date: hireDate,
      years_of_service: yearsOfService,
    });
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapToResult(raw: any): LeaveRequestResult {
    return {
      id: raw.id,
      tenant_id: raw.tenant_id,
      employee_id: raw.employee_id,
      leave_type: raw.leave_type,
      start_date: raw.start_date,
      end_date: raw.end_date,
      days_requested: raw.days_requested,
      reason: raw.reason,
      with_pay: raw.with_pay,
      status: raw.status,
      approved_by: raw.approved_by,
      approved_at: raw.approved_at,
      rejection_reason: raw.rejection_reason,
      certificate_url: raw.certificate_url,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }
}
