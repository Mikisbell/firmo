/**
 * Evaluation Service - Business Logic Layer for Performance Evaluations
 *
 * Implements the Service Layer Pattern for employee performance evaluations.
 * Supports the full evaluation lifecycle: DRAFT -> COMPLETED -> REVIEWED.
 *
 * Key rules:
 * - Multi-tenant: all operations filter by tenant_id
 * - Event-sourced: all mutations emit events through the events table
 * - Scores are 1-5 per category (e.g., punctuality, quality, attitude, sales)
 * - Automatic metrics are captured from POS system data
 *
 * @module core/services/evaluation.service
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { withTransaction } from '@/src/core/db/transaction';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Pure Functions (exported for testing)
// ============================================================================

/**
 * Calculate the average of all score values in a scores object.
 * Returns 0 for empty scores.
 */
export function calculateAverageScores(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
}

/**
 * Validate that all score values are numbers between 1 and 5.
 * Returns false for empty scores.
 */
export function validateScores(scores: Record<string, unknown>): boolean {
  const values = Object.values(scores);
  if (values.length === 0) return false;
  return values.every(v => typeof v === 'number' && v >= 1 && v <= 5);
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CreateEvaluationInput {
  employee_id: string;
  evaluator_id: string;
  period_start: Date;
  period_end: Date;
  scores: Record<string, number>;
  automatic_metrics?: Record<string, number>;
  comments?: string;
  goals?: Array<{ goal: string; progress: number }>;
  created_by: string;
}

export interface EvaluationResult {
  id: string;
  tenant_id: string;
  employee_id: string;
  evaluator_id: string;
  period_start: Date;
  period_end: Date;
  scores: Record<string, number>;
  automatic_metrics: Record<string, number>;
  comments: string | null;
  employee_comments: string | null;
  goals: Array<{ goal: string; progress: number }> | null;
  status: string;
  completed_at: Date | null;
  created_at: Date;
}

export interface AverageScoreResult {
  employee_id: string;
  evaluation_count: number;
  average_score: number;
  category_averages: Record<string, number>;
}

// ============================================================================
// EvaluationService
// ============================================================================

export class EvaluationService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // Create Evaluation
  // ==========================================================================

  /**
   * Create a new performance evaluation in DRAFT status.
   * Validates employee and evaluator existence, period dates, and score ranges.
   */
  async create(
    tenantId: string,
    data: CreateEvaluationInput,
  ): Promise<Result<EvaluationResult, DomainError>> {
    // Validate period dates
    if (data.period_start > data.period_end) {
      return err(
        new ValidationError(
          'period_start must be before or equal to period_end',
          'period_start',
        ),
      );
    }

    // Validate scores
    if (!validateScores(data.scores)) {
      return err(
        new ValidationError(
          'Scores must be a non-empty object with numeric values between 1 and 5',
          'scores',
        ),
      );
    }

    // Validate employee exists
    const employee = await this.prisma.employees.findFirst({
      where: { id: data.employee_id, tenant_id: tenantId },
    });

    if (!employee) {
      return err(new NotFoundError('Employee', data.employee_id));
    }

    // Validate evaluator exists
    const evaluator = await this.prisma.employees.findFirst({
      where: { id: data.evaluator_id, tenant_id: tenantId },
    });

    if (!evaluator) {
      return err(new NotFoundError('Evaluator', data.evaluator_id));
    }

    const evaluationId = uuidv4();

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const evaluation = await tx.evaluations.create({
          data: {
            id: evaluationId,
            tenant_id: tenantId,
            employee_id: data.employee_id,
            evaluator_id: data.evaluator_id,
            period_start: data.period_start,
            period_end: data.period_end,
            scores: data.scores,
            automatic_metrics: data.automatic_metrics ?? {},
            comments: data.comments ?? null,
            employee_comments: null,
            goals: (data.goals ?? undefined) as any,
            status: 'DRAFT',
          },
        });

        // Emit EVALUATION_CREATED event
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            occurred_at: new Date(),
            type: 'EVALUATION_CREATED',
            entity_type: 'EVALUATION',
            entity_id: evaluationId,
            actor_id: data.created_by,
            actor_role_snapshot: 'ADMIN',
            terminal_id: 'system',
            payload: {
              evaluation_id: evaluationId,
              employee_id: data.employee_id,
              evaluator_id: data.evaluator_id,
              period_start: data.period_start.toISOString(),
              period_end: data.period_end.toISOString(),
              scores: data.scores,
            },
          },
        });

        return evaluation;
      },
      { maxRetries: 3 },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId },
        'Failed to create evaluation',
      );
      return err(
        new DomainError('Failed to create evaluation', 'EVALUATION_CREATION_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { evaluationId, tenantId },
      'Evaluation created successfully',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Complete Evaluation
  // ==========================================================================

  /**
   * Move an evaluation from DRAFT to COMPLETED status.
   */
  async complete(
    tenantId: string,
    evaluationId: string,
  ): Promise<Result<EvaluationResult, DomainError>> {
    const evaluation = await this.prisma.evaluations.findFirst({
      where: { id: evaluationId, tenant_id: tenantId },
    });

    if (!evaluation) {
      return err(new NotFoundError('Evaluation', evaluationId));
    }

    if (evaluation.status !== 'DRAFT') {
      return err(
        new ValidationError(
          'Only DRAFT evaluations can be completed',
          'status',
        ),
      );
    }

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.evaluations.update({
          where: { id: evaluationId },
          data: {
            status: 'COMPLETED',
            completed_at: new Date(),
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, evaluationId },
        'Failed to complete evaluation',
      );
      return err(
        new DomainError('Failed to complete evaluation', 'EVALUATION_COMPLETE_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { evaluationId, tenantId },
      'Evaluation completed',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Add Employee Comments
  // ==========================================================================

  /**
   * Allow an employee to add their own comments to an evaluation.
   */
  async addEmployeeComments(
    tenantId: string,
    evaluationId: string,
    comments: string,
  ): Promise<Result<EvaluationResult, DomainError>> {
    const evaluation = await this.prisma.evaluations.findFirst({
      where: { id: evaluationId, tenant_id: tenantId },
    });

    if (!evaluation) {
      return err(new NotFoundError('Evaluation', evaluationId));
    }

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.evaluations.update({
          where: { id: evaluationId },
          data: {
            employee_comments: comments,
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, evaluationId },
        'Failed to add employee comments',
      );
      return err(
        new DomainError('Failed to add employee comments', 'EMPLOYEE_COMMENTS_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { evaluationId, tenantId },
      'Employee comments added',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Review Evaluation
  // ==========================================================================

  /**
   * Move an evaluation from COMPLETED to REVIEWED status.
   */
  async review(
    tenantId: string,
    evaluationId: string,
  ): Promise<Result<EvaluationResult, DomainError>> {
    const evaluation = await this.prisma.evaluations.findFirst({
      where: { id: evaluationId, tenant_id: tenantId },
    });

    if (!evaluation) {
      return err(new NotFoundError('Evaluation', evaluationId));
    }

    if (evaluation.status !== 'COMPLETED') {
      return err(
        new ValidationError(
          'Only COMPLETED evaluations can be reviewed',
          'status',
        ),
      );
    }

    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const updated = await tx.evaluations.update({
          where: { id: evaluationId },
          data: {
            status: 'REVIEWED',
          },
        });

        return updated;
      },
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, tenantId, evaluationId },
        'Failed to review evaluation',
      );
      return err(
        new DomainError('Failed to review evaluation', 'EVALUATION_REVIEW_FAILED', {
          originalError: txResult.error.message,
        }),
      );
    }

    pinoLogger.info(
      { evaluationId, tenantId },
      'Evaluation reviewed',
    );

    return ok(this.mapToResult(txResult.data));
  }

  // ==========================================================================
  // Get by ID
  // ==========================================================================

  /**
   * Get a single evaluation by ID, scoped to tenant.
   */
  async getById(
    tenantId: string,
    evaluationId: string,
  ): Promise<Result<EvaluationResult, DomainError>> {
    const evaluation = await this.prisma.evaluations.findFirst({
      where: {
        id: evaluationId,
        tenant_id: tenantId,
      },
    });

    if (!evaluation) {
      return err(new NotFoundError('Evaluation', evaluationId));
    }

    return ok(this.mapToResult(evaluation));
  }

  // ==========================================================================
  // List by Employee
  // ==========================================================================

  /**
   * List all evaluations for an employee, ordered by period_end descending.
   */
  async listByEmployee(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<EvaluationResult[], DomainError>> {
    try {
      const evaluations = await this.prisma.evaluations.findMany({
        where: {
          tenant_id: tenantId,
          employee_id: employeeId,
        },
        orderBy: { period_end: 'desc' },
      });

      return ok(evaluations.map((e) => this.mapToResult(e)));
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to list evaluations');
      return err(
        new DomainError('Failed to list evaluations', 'EVALUATION_LIST_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Get Average Score
  // ==========================================================================

  /**
   * Calculate the average score across all evaluations for an employee.
   * Returns per-category averages and overall average.
   */
  async getAverageScore(
    tenantId: string,
    employeeId: string,
  ): Promise<Result<AverageScoreResult, DomainError>> {
    try {
      const evaluations = await this.prisma.evaluations.findMany({
        where: {
          tenant_id: tenantId,
          employee_id: employeeId,
        },
      });

      if (evaluations.length === 0) {
        return ok({
          employee_id: employeeId,
          evaluation_count: 0,
          average_score: 0,
          category_averages: {},
        });
      }

      // Accumulate scores across all evaluations per category
      const categoryTotals: Record<string, { sum: number; count: number }> = {};

      for (const evaluation of evaluations) {
        const scores = evaluation.scores as Record<string, number>;
        for (const [category, score] of Object.entries(scores)) {
          if (!categoryTotals[category]) {
            categoryTotals[category] = { sum: 0, count: 0 };
          }
          categoryTotals[category].sum += score;
          categoryTotals[category].count += 1;
        }
      }

      // Calculate per-category averages
      const category_averages: Record<string, number> = {};
      for (const [category, { sum, count }] of Object.entries(categoryTotals)) {
        category_averages[category] = Math.round((sum / count) * 100) / 100;
      }

      // Calculate overall average from category averages
      const catValues = Object.values(category_averages);
      const average_score = catValues.length > 0
        ? Math.round((catValues.reduce((s, v) => s + v, 0) / catValues.length) * 100) / 100
        : 0;

      return ok({
        employee_id: employeeId,
        evaluation_count: evaluations.length,
        average_score,
        category_averages,
      });
    } catch (error) {
      pinoLogger.error({ error, tenantId, employeeId }, 'Failed to calculate average score');
      return err(
        new DomainError('Failed to calculate average score', 'AVERAGE_SCORE_FAILED', {
          originalError: (error as Error).message,
        }),
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private mapToResult(evaluation: any): EvaluationResult {
    return {
      id: evaluation.id,
      tenant_id: evaluation.tenant_id,
      employee_id: evaluation.employee_id,
      evaluator_id: evaluation.evaluator_id,
      period_start: evaluation.period_start,
      period_end: evaluation.period_end,
      scores: evaluation.scores as Record<string, number>,
      automatic_metrics: (evaluation.automatic_metrics ?? {}) as Record<string, number>,
      comments: evaluation.comments,
      employee_comments: evaluation.employee_comments,
      goals: evaluation.goals as Array<{ goal: string; progress: number }> | null,
      status: evaluation.status,
      completed_at: evaluation.completed_at,
      created_at: evaluation.created_at,
    };
  }
}
