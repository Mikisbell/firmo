/**
 * Saga Log Repository
 * 
 * Manages persistence of saga execution state with dual storage:
 * - IndexedDB for local/offline access
 * - PostgreSQL for server-side visibility and cross-terminal coordination
 */

import { db, type SagaLogEntity } from '@/src/core/db/schema';
import { logger } from '@/src/core/observability/logger';
import type { SagaLogEntry, SagaStepResult, SagaStatus } from './types';

export interface SagaLogCreate {
  sagaId: string;
  tenantId: string;
  sagaName: string;
  context: any;
}

export interface SagaLogFilters {
  tenantId: string;
  sagaName?: string;
  status?: SagaStatus;
  startedAfter?: Date;
  startedBefore?: Date;
  limit?: number;
}

export class SagaLogRepository {
  /**
   * Create a new saga log entry
   */
  async create(data: SagaLogCreate): Promise<SagaLogEntry> {
    const now = new Date();
    const entry: SagaLogEntry = {
      sagaId: data.sagaId,
      tenantId: data.tenantId,
      sagaName: data.sagaName,
      status: 'PENDING',
      context: data.context,
      steps: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Write to IndexedDB immediately
    const entity = this.toEntity(entry);
    await db.saga_logs.add(entity);

    logger.info('SAGA_LOG_CREATED', 'Saga log created', {
      sagaId: entry.sagaId,
      sagaName: entry.sagaName,
      tenantId: entry.tenantId,
    });

    // TODO: Sync to PostgreSQL via API when online
    // This will be handled by a background sync worker similar to event sync

    return entry;
  }

  /**
   * Update saga log with step completion
   */
  async recordStepCompletion(
    sagaId: string,
    stepName: string,
    result: SagaStepResult
  ): Promise<void> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      throw new Error(`Saga log not found: ${sagaId}`);
    }

    const entry = this.fromEntity(entity);
    entry.steps.push(result);
    entry.status = 'IN_PROGRESS';
    entry.updatedAt = new Date();

    await db.saga_logs.put(this.toEntity(entry));

    logger.debug('SAGA_STEP_COMPLETED', 'Saga step completed', {
      sagaId,
      stepName,
      status: result.status,
    });
  }

  /**
   * Update saga log with compensation
   */
  async recordCompensation(
    sagaId: string,
    stepName: string,
    error?: Error
  ): Promise<void> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      throw new Error(`Saga log not found: ${sagaId}`);
    }

    const entry = this.fromEntity(entity);
    
    // Find the step and mark it as compensated
    const step = entry.steps.find(s => s.stepName === stepName);
    if (step) {
      step.status = 'COMPENSATED';
    }

    entry.status = 'COMPENSATING';
    entry.updatedAt = new Date();
    if (error) {
      entry.error = error.message;
    }

    await db.saga_logs.put(this.toEntity(entry));

    logger.debug('SAGA_STEP_COMPENSATED', 'Saga step compensated', {
      sagaId,
      stepName,
      error: error?.message,
    });
  }

  /**
   * Mark saga as completed
   */
  async markCompleted(sagaId: string): Promise<void> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      throw new Error(`Saga log not found: ${sagaId}`);
    }

    const entry = this.fromEntity(entity);
    entry.status = 'COMPLETED';
    entry.completedAt = new Date();
    entry.updatedAt = new Date();

    await db.saga_logs.put(this.toEntity(entry));

    logger.info('SAGA_COMPLETED', 'Saga completed successfully', {
      sagaId,
      sagaName: entry.sagaName,
      stepCount: entry.steps.length,
    });
  }

  /**
   * Mark saga as failed
   */
  async markFailed(sagaId: string, error: Error): Promise<void> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      throw new Error(`Saga log not found: ${sagaId}`);
    }

    const entry = this.fromEntity(entity);
    entry.status = 'FAILED';
    entry.completedAt = new Date();
    entry.updatedAt = new Date();
    entry.error = error.message;

    await db.saga_logs.put(this.toEntity(entry));

    logger.error('SAGA_FAILED', 'Saga failed', error, {
      sagaId,
      sagaName: entry.sagaName,
    });
  }

  /**
   * Mark saga as compensated (rollback completed)
   */
  async markCompensated(sagaId: string): Promise<void> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      throw new Error(`Saga log not found: ${sagaId}`);
    }

    const entry = this.fromEntity(entity);
    entry.status = 'COMPENSATED';
    entry.completedAt = new Date();
    entry.updatedAt = new Date();

    await db.saga_logs.put(this.toEntity(entry));

    logger.info('SAGA_COMPENSATED', 'Saga compensated successfully', {
      sagaId,
      sagaName: entry.sagaName,
    });
  }

  /**
   * Get saga log by ID
   */
  async getById(sagaId: string): Promise<SagaLogEntry | null> {
    const entity = await db.saga_logs.get(sagaId);
    if (!entity) {
      return null;
    }
    return this.fromEntity(entity);
  }

  /**
   * Find in-progress sagas (for recovery)
   */
  async findInProgress(tenantId: string): Promise<SagaLogEntry[]> {
    const entities = await db.saga_logs
      .where('[tenant_id+status]')
      .equals([tenantId, 'IN_PROGRESS'])
      .toArray();

    return entities.map(e => this.fromEntity(e));
  }

  /**
   * Query saga logs with filters
   */
  async query(filters: SagaLogFilters): Promise<SagaLogEntry[]> {
    let collection = db.saga_logs.where('tenant_id').equals(filters.tenantId);

    // Apply status filter if provided
    if (filters.status) {
      collection = db.saga_logs
        .where('[tenant_id+status]')
        .equals([filters.tenantId, filters.status]);
    }

    let entities = await collection.toArray();

    // Apply saga name filter
    if (filters.sagaName) {
      entities = entities.filter(e => e.saga_name === filters.sagaName);
    }

    // Apply date range filters
    if (filters.startedAfter) {
      const afterIso = filters.startedAfter.toISOString();
      entities = entities.filter(e => e.started_at >= afterIso);
    }
    if (filters.startedBefore) {
      const beforeIso = filters.startedBefore.toISOString();
      entities = entities.filter(e => e.started_at <= beforeIso);
    }

    // Apply limit
    if (filters.limit) {
      entities = entities.slice(0, filters.limit);
    }

    return entities.map(e => this.fromEntity(e));
  }

  /**
   * Convert SagaLogEntry to SagaLogEntity for storage
   */
  private toEntity(entry: SagaLogEntry): SagaLogEntity {
    return {
      saga_id: entry.sagaId,
      tenant_id: entry.tenantId,
      saga_name: entry.sagaName,
      status: entry.status,
      context: entry.context,
      steps: entry.steps,
      started_at: entry.startedAt.toISOString(),
      completed_at: entry.completedAt?.toISOString(),
      error: entry.error,
      created_at: entry.createdAt.toISOString(),
      updated_at: entry.updatedAt.toISOString(),
    };
  }

  /**
   * Convert SagaLogEntity to SagaLogEntry
   */
  private fromEntity(entity: SagaLogEntity): SagaLogEntry {
    return {
      sagaId: entity.saga_id,
      tenantId: entity.tenant_id,
      sagaName: entity.saga_name,
      status: entity.status as SagaStatus,
      context: entity.context,
      steps: entity.steps,
      startedAt: new Date(entity.started_at),
      completedAt: entity.completed_at ? new Date(entity.completed_at) : undefined,
      error: entity.error,
      createdAt: new Date(entity.created_at),
      updatedAt: new Date(entity.updated_at),
    };
  }
}

// Singleton instance
export const sagaLogRepository = new SagaLogRepository();
