/**
 * Training Service - Business Logic Layer for Employee Training Records
 *
 * Implements the Service Layer Pattern for employee training management.
 * Tracks completed trainings, certifications, and compliance status.
 *
 * Key rules:
 * - Multi-tenant: all operations filter by tenant_id
 * - Event-sourced: mutations emit events through the events table
 * - Training types: MANDATORY, OPTIONAL, CERTIFICATION
 * - Scores are 0-100 when provided
 * - Compliance = employee has completed all MANDATORY training types
 *
 * @module core/services/training.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Constants
// ============================================================================

/**
 * Known mandatory training types for restaurant employees.
 * These are the standard trainings required by Peruvian health regulations
 * and internal restaurant policies.
 */
export const MANDATORY_TRAINING_TYPES = [
  'Manipulacion de Alimentos',
  'Seguridad e Higiene',
  'Primeros Auxilios',
] as const;

// ============================================================================
// Pure Functions (exported for testing)
// ============================================================================

/**
 * Check if a training has expired based on its completion date and validity period.
 */
export function isTrainingExpired(completionDate: Date, validityMonths: number): boolean {
  const expiry = new Date(completionDate);
  expiry.setMonth(expiry.getMonth() + validityMonths);
  return new Date() > expiry;
}

/**
 * Calculate the completion rate as a percentage with 2 decimal places.
 * Returns 100 when there are no required trainings.
 */
export function calculateCompletionRate(completedTrainings: number, requiredTrainings: number): number {
  if (requiredTrainings === 0) return 100;
  return Math.round((completedTrainings / requiredTrainings) * 10000) / 100;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RecordTrainingInput {
  employee_id: string;
  training_name: string;
  training_type: string;
  provider?: string;
  duration_hours?: number;
  completion_date: Date;
  certificate_url?: string;
  score?: number;
  notes?: string;
  assigned_by?: string;
  recorded_by: string;
}

export interface TrainingResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  training_name: string;
  training_type: string;
  provider: string | null;
  duration_hours: number | null;
  completion_date: Date;
  certificate_url: string | null;
  score: number | null;
  notes: string | null;
  assigned_by: string | null;
  created_at: Date;
}

export interface ComplianceResult {
  employee_id: string;
  is_compliant: boolean;
  completed_mandatory: number;
  total_mandatory_types: number;
  missing_trainings: string[];
  completion_rate: number;
}

export interface ListTrainingOptions {
  training_type?: string;
}

// ============================================================================
// TrainingService
// ============================================================================

export class TrainingService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Record Training
  // ==========================================================================

  /**
   * Record a completed training for an employee.
   * Validates employee existence, training name, and score range.
   */
  async record(
    tenantId: string,
    data: RecordTrainingInput,
  ): Promise<Result<TrainingResult, DomainError>> {
    // Validate training name
    if (!data.training_name || data.training_name.trim().length === 0) {
      return err(
        new ValidationError('Training name is required', 'training_name'),
      );
    }

    // Validate score range if provided
    if (data.score !== undefined && data.score !== null) {
      if (data.score < 0 || data.score > 100) {
        return err(
          new ValidationError(
            'Score must be between 0 and 100',
            'score',
            { actual: data.score },
          ),
        );
      }
    }

    // Validate employee exists
    const employee = await this.prisma.employees.findFirst({
      where: { id: data.employee_id, tenant_id: tenantId },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', data.employee_id));
    }

    const trainingId = uuidv4();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const training = await tx.training_records.create({
          data: {
            id: trainingId,
            tenant_id: tenantId,
            employee_id: data.employee_id,
            training_name: data.training_name.trim(),
            training_type: data.training_type,
            provider: data.provider ?? null,
            duration_hours: data.duration_hours ?? null,
            completion_date: data.completion_date,
            certificate_url: data.certificate_url ?? null,
            score: data.score ?? null,
            notes: data.notes ?? null,
            assigned_by: data.assigned_by ?? null,
          },
        });

        // Emit TRAINING_COMPLETED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'TRAINING_COMPLETED',
            entity_type: 'TRAINING',
            entity_id: trainingId,
            actor_id: data.recorded_by,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              training_id: trainingId,
              employee_id: data.employee_id,
              training_name: data.training_name,
              training_type: data.training_type,
              completion_date: data.completion_date.toISOString(),
              score: data.score ?? null,
            },
          },
        });

        return training;
      },
      { maxRetries: 3 },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId },
        'Failed to record training',
      );
      return err(
        new DomainError('Failed to record training', 'TRAINING_RECORD_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { trainingId, tenantId, employeeId: data.employee_id },
      'Training recorded successfully',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Get by ID
  // ==========================================================================

  /**
   * Get a single training record by ID, scoped to tenant.
   */
  async getById(
    tenantId: string,
    trainingId: string,
  ): Promise<Result<TrainingResult, DomainError>> {
    const training = await this.prisma.training_records.findFirst({
      where: {
        id: trainingId,
        tenant_id: tenantId,
      },
    });

    if (!training) {
      return err(new NotFoundError('Training', trainingId));
    }

    return ok(this.mapToResult(training));
  }

  // ==========================================================================
  // List by Employee
  // ==========================================================================

  /**
   * List all training records for an employee, optionally filtered by type.
   */
  async listByEmployee(
    tenantId: string,
    employeeId: string,
    options?: ListTrainingOptions,
  ): Promise<Result<TrainingResult[], DomainError>> {
    try {
      const where: Record<string, unknown> = {
        tenant_id: tenantId,
        employee_id: employeeId,
      };

      if (options?.training_type) {
        where.training_type = options.training_type;
      }

      const trainings = await this.prisma.training_records.findMany({
        where: where as any,
        orderBy: { completion_date: 'desc' },
      });

      return ok(trainings.map((t) => this.mapToResult(t)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to list trainings');
      return err(
        new DomainError('Failed to list trainings', 'TRAINING_LIST_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // List by Type
  // ==========================================================================

  /**
   * List all training records of a specific type across all employees.
   */
  async listByType(
    tenantId: string,
    trainingType: string,
  ): Promise<Result<TrainingResult[], DomainError>> {
    try {
      const trainings = await this.prisma.training_records.findMany({
        where: {
          tenant_id: tenantId,
          training_type: trainingType,
        },
        orderBy: { completion_date: 'desc' },
      });

      return ok(trainings.map((t) => this.mapToResult(t)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, trainingType }, 'Failed to list trainings by type');
      return err(
        new DomainError('Failed to list trainings by type', 'TRAINING_LIST_BY_TYPE_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Compliance Status
  // ==========================================================================

  /**
   * Check if an employee has completed all mandatory trainings.
   * Uses MANDATORY_TRAINING_TYPES as the list of required trainings.
   */
  async getComplianceStatus(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<ComplianceResult, DomainError>> {
    try {
      const mandatoryTrainings = await this.prisma.training_records.findMany({
        where: {
          tenant_id: tenantId,
          employee_id: employeeId,
          training_type: 'MANDATORY',
        },
      });

      const completedNames = new Set(
        mandatoryTrainings.map((t) => t.training_name),
      );

      const missing = MANDATORY_TRAINING_TYPES.filter(
        (name) => !completedNames.has(name),
      );

      const completedMandatory = MANDATORY_TRAINING_TYPES.length - missing.length;
      const totalMandatoryTypes = MANDATORY_TRAINING_TYPES.length;

      return ok({
        employee_id: employeeId,
        is_compliant: missing.length === 0,
        completed_mandatory: completedMandatory,
        total_mandatory_types: totalMandatoryTypes,
        missing_trainings: missing as unknown as string[],
        completion_rate: calculateCompletionRate(completedMandatory, totalMandatoryTypes),
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to get compliance status');
      return err(
        new DomainError('Failed to get compliance status', 'COMPLIANCE_CHECK_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Employee Training Hours
  // ==========================================================================

  /**
   * Calculate total training hours for an employee.
   * Null duration_hours values are treated as 0.
   */
  async getEmployeeTrainingHours(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<number, DomainError>> {
    try {
      const trainings = await this.prisma.training_records.findMany({
        where: {
          tenant_id: tenantId,
          employee_id: employeeId,
        },
        select: {
          duration_hours: true,
        },
      });

      const totalHours = trainings.reduce(
        (sum, t) => sum + (t.duration_hours ?? 0),
        0,
      );

      return ok(totalHours);
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to get training hours');
      return err(
        new DomainError('Failed to get training hours', 'TRAINING_HOURS_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapToResult(training: any): TrainingResult {
    return {
      id: training.id,
      tenant_id: training.tenant_id,
      employee_id: training.employee_id,
      training_name: training.training_name,
      training_type: training.training_type,
      provider: training.provider,
      duration_hours: training.duration_hours,
      completion_date: training.completion_date,
      certificate_url: training.certificate_url,
      score: training.score,
      notes: training.notes,
      assigned_by: training.assigned_by,
      created_at: training.created_at,
    };
  }
}
