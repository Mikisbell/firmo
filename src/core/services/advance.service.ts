/**
 * Advance Service - Business Logic Layer for RRHH Module
 *
 * Implements salary advance management for a Peruvian restaurant POS system.
 *
 * Key rules:
 * - Multi-tenant: all operations filter by tenant_id
 * - Event-sourced: mutations emit events through the events table
 * - All money values in centavos (integer, never float)
 * - Advance amount must be <= 50% of base salary
 * - Status flow: PENDING -> APPROVED -> PAID, or PENDING -> REJECTED
 *
 * @module core/services/advance.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Constants
// ============================================================================

/** Maximum advance percentage of base salary */
export const MAX_ADVANCE_SALARY_PERCENTAGE = 0.5;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RequestAdvanceInput {
  employee_id: string;
  amount_cents: number;
  reason: string;
  requested_by: string;
}

export interface AdvanceResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  amount_cents: number;
  reason: string;
  status: string;
  approved_by: string | null;
  approved_at: Date | null;
  paid_at: Date | null;
  deducted_from_payroll: string | null;
  rejection_reason: string | null;
  created_at: Date;
}

export interface ListAdvancesOptions {
  status?: string;
}

// ============================================================================
// Pure Calculation Helpers (exported for property testing)
// ============================================================================

/**
 * Validate that an advance amount is valid:
 * - Must be a positive integer
 * - Must be <= 50% of base salary
 */
export function isValidAdvanceAmount(amountCents: number, baseSalaryCents: number): boolean {
  if (!Number.isInteger(amountCents)) return false;
  if (amountCents <= 0) return false;
  const maxAllowed = Math.floor(baseSalaryCents * MAX_ADVANCE_SALARY_PERCENTAGE);
  return amountCents <= maxAllowed;
}

/**
 * Calculate the maximum allowed advance for a given salary.
 */
export function calculateMaxAdvance(baseSalaryCents: number): number {
  return Math.floor(baseSalaryCents * MAX_ADVANCE_SALARY_PERCENTAGE);
}

/**
 * Check if a status transition is valid for advances.
 * Valid transitions: PENDING -> APPROVED | REJECTED, APPROVED -> PAID
 */
export function isValidAdvanceStatusTransition(from: string, to: string): boolean {
  if (from === 'PENDING') return to === 'APPROVED' || to === 'REJECTED';
  if (from === 'APPROVED') return to === 'PAID';
  return false;
}

/**
 * Calculate total from a list of advance amounts. Always >= 0.
 */
export function calculatePendingTotal(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + a, 0);
}

// ============================================================================
// AdvanceService
// ============================================================================

export class AdvanceService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Request Advance
  // ==========================================================================

  async request(
    tenantId: string,
    data: RequestAdvanceInput,
  ): Promise<Result<AdvanceResult, DomainError>> {
    // Validate amount is positive integer
    if (!Number.isInteger(data.amount_cents)) {
      return err(
        new ValidationError(
          'Amount must be an integer (centavos)',
          'amount_cents',
        ),
      );
    }

    if (data.amount_cents <= 0) {
      return err(
        new ValidationError(
          'Amount must be greater than 0',
          'amount_cents',
          { actual: data.amount_cents },
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

    // Validate amount <= 50% of base salary
    const maxAllowed = calculateMaxAdvance(employee.base_salary_cents ?? 0);
    if (data.amount_cents > maxAllowed) {
      return err(
        new ValidationError(
          `Advance amount exceeds 50% of base salary. Max allowed: ${maxAllowed} centavos. Requested: ${data.amount_cents} centavos.`,
          'amount_cents',
          {
            max_allowed: maxAllowed,
            base_salary_cents: employee.base_salary_cents,
            requested: data.amount_cents,
          },
        ),
      );
    }

    const advanceId = uuidv4();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const advance = await tx.advances.create({
          data: {
            id: advanceId,
            tenant_id: tenantId,
            employee_id: data.employee_id,
            amount_cents: data.amount_cents,
            reason: data.reason,
            status: 'PENDING',
            created_at: new Date(),
          },
        });

        // Emit ADVANCE_REQUESTED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'ADVANCE_REQUESTED',
            entity_type: 'ADVANCE',
            entity_id: advanceId,
            actor_id: data.requested_by,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              advance_id: advanceId,
              employee_id: data.employee_id,
              amount_cents: data.amount_cents,
              reason: data.reason,
            },
          },
        });

        return advance;
      },
      { maxRetries: 3 },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId },
        'Failed to create advance request',
      );
      return err(
        new DomainError('Failed to create advance request', 'ADVANCE_REQUEST_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { advanceId, tenantId, employeeId: data.employee_id },
      'Advance requested successfully',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Approve Advance
  // ==========================================================================

  async approve(
    tenantId: string,
    advanceId: string,
    approvedBy: string,
  ): Promise<Result<AdvanceResult, DomainError>> {
    const existing = await this.prisma.advances.findFirst({
      where: { id: advanceId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Advance', advanceId));
    }

    if (existing.status !== 'PENDING') {
      return err(
        new ValidationError(
          `Cannot approve an advance with status '${existing.status}'. Only PENDING advances can be approved.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const now = new Date();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.advances.update({
          where: { id: advanceId },
          data: {
            status: 'APPROVED',
            approved_by: approvedBy,
            approved_at: now,
          },
        });

        // Emit ADVANCE_APPROVED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: now,
            type: 'ADVANCE_APPROVED',
            entity_type: 'ADVANCE',
            entity_id: advanceId,
            actor_id: approvedBy,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              advance_id: advanceId,
              employee_id: existing.employee_id,
              amount_cents: existing.amount_cents,
              approved_by: approvedBy,
            },
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, advanceId },
        'Failed to approve advance',
      );
      return err(
        new DomainError('Failed to approve advance', 'ADVANCE_APPROVAL_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { advanceId, tenantId, approvedBy },
      'Advance approved',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Reject Advance
  // ==========================================================================

  async reject(
    tenantId: string,
    advanceId: string,
    rejectedBy: string,
    reason: string,
  ): Promise<Result<AdvanceResult, DomainError>> {
    if (!reason || reason.trim().length === 0) {
      return err(
        new ValidationError('Rejection reason is required', 'rejection_reason'),
      );
    }

    const existing = await this.prisma.advances.findFirst({
      where: { id: advanceId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Advance', advanceId));
    }

    if (existing.status !== 'PENDING') {
      return err(
        new ValidationError(
          `Cannot reject an advance with status '${existing.status}'. Only PENDING advances can be rejected.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const updated = await this.prisma.advances.update({
      where: { id: advanceId },
      data: {
        status: 'REJECTED',
        rejection_reason: reason.trim(),
      },
    });

    pinoLogger.info(
      { advanceId, tenantId, rejectedBy, reason },
      'Advance rejected',
    );

    return ok(this.mapToResult(updated));
  }

  // ==========================================================================
  // Mark as Paid
  // ==========================================================================

  async markAsPaid(
    tenantId: string,
    advanceId: string,
  ): Promise<Result<AdvanceResult, DomainError>> {
    const existing = await this.prisma.advances.findFirst({
      where: { id: advanceId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Advance', advanceId));
    }

    if (existing.status !== 'APPROVED') {
      return err(
        new ValidationError(
          `Cannot mark as paid an advance with status '${existing.status}'. Only APPROVED advances can be marked as paid.`,
          'status',
          { current_status: existing.status },
        ),
      );
    }

    const now = new Date();

    const updated = await this.prisma.advances.update({
      where: { id: advanceId },
      data: {
        status: 'PAID',
        paid_at: now,
      },
    });

    pinoLogger.info(
      { advanceId, tenantId },
      'Advance marked as paid',
    );

    return ok(this.mapToResult(updated));
  }

  // ==========================================================================
  // Get By ID
  // ==========================================================================

  async getById(
    tenantId: string,
    advanceId: string,
  ): Promise<Result<AdvanceResult, DomainError>> {
    const advance = await this.prisma.advances.findFirst({
      where: { id: advanceId, tenant_id: tenantId },
    });

    if (!advance) {
      return err(new NotFoundError('Advance', advanceId));
    }

    return ok(this.mapToResult(advance));
  }

  // ==========================================================================
  // List By Employee
  // ==========================================================================

  async listByEmployee(
    tenantId: string,
    employeeId: string,
    options?: ListAdvancesOptions,
  ): Promise<Result<AdvanceResult[], DomainError>> {
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      employee_id: employeeId,
    };

    if (options?.status) {
      where.status = options.status;
    }

    const advances = await this.prisma.advances.findMany({
      where: where as any,
      orderBy: { created_at: 'desc' },
    });

    return ok(advances.map((a: any) => this.mapToResult(a)));
  }

  // ==========================================================================
  // Get Pending Total
  // ==========================================================================

  /**
   * Sum of all APPROVED (not yet PAID) advances for an employee.
   */
  async getPendingTotal(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<number, DomainError>> {
    const approvedAdvances = await this.prisma.advances.findMany({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        status: 'APPROVED',
      },
      select: { amount_cents: true },
    });

    const total = approvedAdvances.reduce(
      (sum: number, a: any) => sum + a.amount_cents,
      0,
    );

    return ok(total);
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapToResult(raw: any): AdvanceResult {
    return {
      id: raw.id,
      tenant_id: raw.tenant_id,
      employee_id: raw.employee_id,
      amount_cents: raw.amount_cents,
      reason: raw.reason,
      status: raw.status,
      approved_by: raw.approved_by ?? null,
      approved_at: raw.approved_at ?? null,
      paid_at: raw.paid_at ?? null,
      deducted_from_payroll: raw.deducted_from_payroll ?? null,
      rejection_reason: raw.rejection_reason ?? null,
      created_at: raw.created_at,
    };
  }
}
