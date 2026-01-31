/**
 * Saga Recovery Service
 * 
 * Handles recovery of in-progress sagas after system restart or crash.
 * Resumes sagas from their last persisted state.
 */

import { logger } from '@/src/core/observability/logger';
import { metricsHelpers } from '@/src/core/observability/metrics';
import { sagaLogRepository } from './repository';
import { SagaOrchestrator } from './orchestrator';
import type { SagaDefinition, SagaLogEntry } from './types';

export interface SagaRegistry {
  [sagaName: string]: SagaDefinition<any>;
}

export class SagaRecoveryService {
  private orchestrator: SagaOrchestrator;
  private sagaRegistry: SagaRegistry;

  constructor(orchestrator: SagaOrchestrator, sagaRegistry: SagaRegistry = {}) {
    this.orchestrator = orchestrator;
    this.sagaRegistry = sagaRegistry;
  }

  /**
   * Register a saga definition for recovery
   */
  registerSaga<TContext>(definition: SagaDefinition<TContext>): void {
    this.sagaRegistry[definition.name] = definition;
  }

  /**
   * Recover all in-progress sagas for a tenant
   * Called on system startup or reconnection
   */
  async recoverInProgressSagas(tenantId: string): Promise<void> {
    try {
      const inProgressSagas = await sagaLogRepository.findInProgress(tenantId);

      if (inProgressSagas.length === 0) {
        logger.info('SAGA_RECOVERY_NONE', 'No in-progress sagas to recover', {
          tenantId,
        });
        return;
      }

      logger.info('SAGA_RECOVERY_STARTED', 'Starting saga recovery', {
        tenantId,
        sagaCount: inProgressSagas.length,
      });

      // Recover each saga
      const results = await Promise.allSettled(
        inProgressSagas.map(sagaLog => this.resumeSaga(sagaLog))
      );

      // Count successes and failures
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('SAGA_RECOVERY_COMPLETED', 'Saga recovery completed', {
        tenantId,
        total: inProgressSagas.length,
        succeeded,
        failed,
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('SAGA_RECOVERY_FAILED', 'Saga recovery failed', err, {
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Resume a single saga from its persisted state
   */
  async resumeSaga(sagaLog: SagaLogEntry): Promise<void> {
    const { sagaId, sagaName, context, steps } = sagaLog;

    logger.info('SAGA_RESUME_STARTED', 'Resuming saga', {
      sagaId,
      sagaName,
      completedSteps: steps.filter(s => s.status === 'COMPLETED').length,
      totalSteps: steps.length,
    });

    // Get saga definition from registry
    const definition = this.sagaRegistry[sagaName];
    if (!definition) {
      // Track failed recovery attempt
      metricsHelpers.recordSagaRecoveryAttempt(sagaName, context.tenantId, false);

      logger.error('SAGA_RESUME_FAILED', 'Saga definition not found in registry', new Error('Saga definition not found'), {
        sagaId,
        sagaName,
      });
      throw new Error(`Saga definition not found: ${sagaName}`);
    }

    // Find the last completed step index
    const lastCompletedIndex = steps.findIndex((s, idx) => {
      // Find last completed by checking from end
      return steps.slice(idx + 1).every(step => step.status !== 'COMPLETED');
    });

    // Create a modified definition that starts from the next step
    const resumeDefinition: SagaDefinition<any> = {
      ...definition,
      steps: definition.steps.slice(lastCompletedIndex + 1),
    };

    // If all steps were completed, mark saga as completed
    if (resumeDefinition.steps.length === 0) {
      await sagaLogRepository.markCompleted(sagaId);
      
      // Track successful recovery (saga was already completed)
      metricsHelpers.recordSagaRecoveryAttempt(sagaName, context.tenantId, true);

      logger.info('SAGA_RESUME_COMPLETED', 'Saga was already completed', {
        sagaId,
        sagaName,
      });
      return;
    }

    // Resume execution from the next step
    try {
      const result = await this.orchestrator.execute(resumeDefinition, {
        ...context,
        sagaId, // Preserve original saga ID
      });

      // Track successful recovery
      metricsHelpers.recordSagaRecoveryAttempt(sagaName, context.tenantId, true);

      if (result.status === 'COMPLETED') {
        logger.info('SAGA_RESUME_SUCCESS', 'Saga resumed and completed successfully', {
          sagaId,
          sagaName,
        });
      } else {
        logger.warn('SAGA_RESUME_PARTIAL', 'Saga resumed but did not complete', {
          sagaId,
          sagaName,
          status: result.status,
        });
      }
    } catch (error) {
      // Track failed recovery attempt
      metricsHelpers.recordSagaRecoveryAttempt(sagaName, context.tenantId, false);

      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('SAGA_RESUME_ERROR', 'Error resuming saga', err, {
        sagaId,
        sagaName,
      });
      throw error;
    }
  }
}

