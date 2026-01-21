/**
 * Saga Orchestrator
 * 
 * Coordinates saga execution with sequential step processing,
 * compensation on failure, timeout support, and event emission.
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/src/core/observability/logger';
import { metricsHelpers } from '@/src/core/observability/metrics';
import { sagaLogRepository } from './repository';
import { errorClassifier } from './errors';
import { eventBus } from '@/src/core/infra/event-bus';
import type { ParkEvent } from '@/src/core/domain/events';
import {
  SagaDefinition,
  SagaContext,
  SagaExecutionResult,
  SagaStepResult,
  SagaStatus,
  StepStatus,
  SagaError,
  SagaTimeoutError,
  SagaCompensationError,
} from './types';

export class SagaOrchestrator {
  /**
   * Emit a saga event through the event bus
   */
  private emitSagaEvent(
    tenantId: string,
    sagaId: string,
    sagaType: string,
    eventType: string,
    payload: Record<string, unknown>
  ): void {
    const event: ParkEvent = {
      // Identity
      event_id: uuidv4(),
      tenant_id: tenantId,
      
      // Terminal info (use saga orchestrator as terminal)
      terminal_id: 'saga-orchestrator',
      terminal_sequence: 0, // Saga events don't use terminal sequence
      
      // Time
      occurred_at: new Date().toISOString(),
      
      // Aggregate
      aggregate_type: 'SAGA' as const,
      aggregate_id: sagaId,
      
      // Tracing
      correlation_id: sagaId,
      causation_id: null,
      
      // Actor (system-generated)
      actor_id: null,
      actor_role_snapshot: null,
      
      // Version
      schema_version: 1,
      payload_version: 1,
      
      // Context
      shift_id: null,
      business_date: null,
      
      // Event-specific
      event_type: eventType as any,
      payload: {
        saga_id: sagaId,
        saga_type: sagaType,
        ...payload,
      } as any,
    };

    eventBus.publish(tenantId, event);
    
    logger.debug('SAGA_EVENT_EMITTED', 'Saga event emitted', {
      sagaId,
      eventType,
      tenantId,
    });
  }

  /**
   * Execute a saga with sequential step processing
   * 
   * @param definition - Saga definition with steps
   * @param context - Execution context
   * @returns Execution result with status and step results
   */
  async execute<TContext extends SagaContext>(
    definition: SagaDefinition<TContext>,
    context: TContext
  ): Promise<SagaExecutionResult> {
    const sagaId = context.sagaId || uuidv4();
    const startedAt = new Date();
    const steps: SagaStepResult[] = [];
    
    let currentStatus: SagaStatus = 'IN_PROGRESS';
    let sagaError: Error | undefined;

    // Track saga started
    metricsHelpers.recordSagaStarted(definition.name, context.tenantId);

    try {
      // Check if saga log already exists (for recovery scenarios)
      const existingLog = await sagaLogRepository.getById(sagaId);
      
      if (!existingLog) {
        // Create saga log entry before starting
        await sagaLogRepository.create({
          sagaId,
          tenantId: context.tenantId,
          sagaName: definition.name,
          context,
        });

        // Emit SAGA_STARTED event
        this.emitSagaEvent(
          context.tenantId,
          sagaId,
          definition.name,
          'SAGA_STARTED',
          {
            context: context as Record<string, unknown>,
            timeout_ms: definition.timeout,
          }
        );

        logger.info('SAGA_STARTED', 'Saga execution started', {
          sagaId,
          sagaName: definition.name,
          tenantId: context.tenantId,
        });
      } else {
        // Resuming existing saga
        logger.info('SAGA_RESUMED', 'Saga execution resumed', {
          sagaId,
          sagaName: definition.name,
          tenantId: context.tenantId,
          previousSteps: existingLog.steps.length,
        });
      }

      // Execute steps sequentially
      for (let i = 0; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        // Add sagaType to context for metrics
        const contextWithType = { ...context, sagaType: definition.name };
        const stepResult = await this.executeStep(step, contextWithType, sagaId, definition.timeout);
        steps.push(stepResult);

        // Persist step completion
        await sagaLogRepository.recordStepCompletion(sagaId, step.name, stepResult);

        if (stepResult.status === 'COMPLETED') {
          // Emit SAGA_STEP_COMPLETED event
          this.emitSagaEvent(
            context.tenantId,
            sagaId,
            definition.name,
            'SAGA_STEP_COMPLETED',
            {
              step_name: step.name,
              step_index: i,
              result: stepResult.result as Record<string, unknown>,
              attempts: stepResult.attempts,
            }
          );
        } else if (stepResult.status === 'FAILED') {
          // Emit SAGA_STEP_FAILED event
          this.emitSagaEvent(
            context.tenantId,
            sagaId,
            definition.name,
            'SAGA_STEP_FAILED',
            {
              step_name: step.name,
              step_index: i,
              error_code: stepResult.error?.name || 'UNKNOWN_ERROR',
              error_message: stepResult.error?.message || 'Unknown error',
              error_transient: errorClassifier.isRetryable(stepResult.error || new Error()),
              attempts: stepResult.attempts,
            }
          );

          // Step failed, trigger compensation
          currentStatus = 'COMPENSATING';
          sagaError = stepResult.error;
          
          logger.warn('SAGA_STEP_FAILED', 'Saga step failed, starting compensation', {
            sagaId,
            stepName: step.name,
            error: stepResult.error?.message,
          });
          
          const compensationStart = Date.now();
          await this.compensate(definition, context, steps, sagaId);
          const compensationDuration = Date.now() - compensationStart;
          
          currentStatus = 'COMPENSATED';
          await sagaLogRepository.markCompensated(sagaId);

          // Emit SAGA_COMPENSATED event
          const duration = Date.now() - startedAt.getTime();
          this.emitSagaEvent(
            context.tenantId,
            sagaId,
            definition.name,
            'SAGA_COMPENSATED',
            {
              failed_step: step.name,
              compensated_steps: steps
                .filter(s => s.status === 'COMPENSATED')
                .map(s => s.stepName),
              duration_ms: duration,
            }
          );
          
          // Track saga compensated
          metricsHelpers.recordSagaCompensated(definition.name, context.tenantId, duration, compensationDuration);
          
          break;
        }
      }

      // All steps completed successfully
      if (currentStatus === 'IN_PROGRESS') {
        currentStatus = 'COMPLETED';
        await sagaLogRepository.markCompleted(sagaId);

        // Emit SAGA_COMPLETED event
        const duration = Date.now() - startedAt.getTime();
        this.emitSagaEvent(
          context.tenantId,
          sagaId,
          definition.name,
          'SAGA_COMPLETED',
          {
            completed_steps: steps.map(s => s.stepName),
            duration_ms: duration,
          }
        );
        
        // Track saga completed
        metricsHelpers.recordSagaCompleted(definition.name, context.tenantId, duration);
        
        logger.info('SAGA_COMPLETED', 'Saga completed successfully', {
          sagaId,
          sagaName: definition.name,
          stepCount: steps.length,
        });
      }

    } catch (error) {
      currentStatus = 'FAILED';
      sagaError = error instanceof Error ? error : new Error(String(error));
      
      await sagaLogRepository.markFailed(sagaId, sagaError);

      // Emit SAGA_FAILED event
      const duration = Date.now() - startedAt.getTime();
      this.emitSagaEvent(
        context.tenantId,
        sagaId,
        definition.name,
        'SAGA_FAILED',
        {
          failed_step: steps[steps.length - 1]?.stepName || 'unknown',
          error_code: sagaError.name,
          error_message: sagaError.message,
          requires_manual_intervention: true,
          duration_ms: duration,
        }
      );
      
      // Track saga failed
      metricsHelpers.recordSagaFailed(definition.name, context.tenantId, duration, sagaError.constructor.name);
      
      logger.error('SAGA_FAILED', 'Saga execution failed', sagaError, {
        sagaId,
      });
    }

    return {
      sagaId,
      status: currentStatus,
      steps,
      startedAt,
      completedAt: new Date(),
      error: sagaError,
    };
  }

  /**
   * Execute a single saga step with timeout and retry support
   */
  private async executeStep<TContext>(
    step: any,
    context: TContext,
    sagaId: string,
    sagaTimeout?: number
  ): Promise<SagaStepResult> {
    const startedAt = new Date();
    const maxRetries = step.maxRetries || 1;
    const stepTimeout = step.timeout || sagaTimeout || 30000; // 30s default

    let attempts = 0;
    let lastError: Error | undefined;
    
    // Get saga type from context
    const sagaType = (context as any).sagaType || 'unknown';
    const tenantId = (context as SagaContext).tenantId;

    while (attempts < maxRetries) {
      attempts++;

      try {
        // Execute step with timeout
        const result = await this.executeWithTimeout(
          () => step.do(context),
          stepTimeout,
          sagaId,
          step.name
        );

        // Track step completed
        const duration = Date.now() - startedAt.getTime();
        metricsHelpers.recordSagaStepDuration(sagaType, step.name, tenantId, duration, 'completed');

        return {
          stepName: step.name,
          status: 'COMPLETED',
          result,
          startedAt,
          completedAt: new Date(),
          attempts,
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Classify error to determine if retryable
        const isRetryable = errorClassifier.isRetryable(lastError);
        const errorCategory = errorClassifier.getCategory(lastError);

        logger.debug('SAGA_STEP_ERROR', 'Saga step error occurred', {
          sagaId,
          stepName: step.name,
          attempt: attempts,
          maxRetries,
          isRetryable,
          errorCategory,
          error: lastError.message,
        });

        // Check if we should retry
        // Only retry if:
        // 1. Step is marked as retryable
        // 2. Error is classified as retryable (transient)
        // 3. We haven't exceeded max retries
        const shouldRetry = step.retryable && isRetryable && attempts < maxRetries;

        if (!shouldRetry) {
          logger.warn('SAGA_STEP_NO_RETRY', 'Saga step will not be retried', {
            sagaId,
            stepName: step.name,
            reason: !step.retryable ? 'step not retryable' : 
                    !isRetryable ? 'error not retryable' : 
                    'max retries exceeded',
            errorCategory,
          });
          break;
        }

        // Track step retry
        metricsHelpers.recordSagaStepRetry(sagaType, step.name, tenantId, lastError.constructor.name);

        // Exponential backoff with jitter
        const backoff = Math.min(1000 * Math.pow(2, attempts - 1), 10000);
        const jitter = Math.random() * 1000;
        const delayMs = backoff + jitter;

        logger.info('SAGA_STEP_RETRY', 'Retrying saga step', {
          sagaId,
          stepName: step.name,
          attempt: attempts,
          maxRetries,
          delayMs: Math.round(delayMs),
        });

        await this.sleep(delayMs);
      }
    }

    // Step failed after all retries - track step failed
    const duration = Date.now() - startedAt.getTime();
    metricsHelpers.recordSagaStepDuration(sagaType, step.name, tenantId, duration, 'failed');

    return {
      stepName: step.name,
      status: 'FAILED',
      error: lastError,
      startedAt,
      completedAt: new Date(),
      attempts,
    };
  }

  /**
   * Compensate completed steps in reverse order
   */
  private async compensate<TContext extends SagaContext>(
    definition: SagaDefinition<TContext>,
    context: TContext,
    completedSteps: SagaStepResult[],
    sagaId: string
  ): Promise<void> {
    // Get successfully completed steps in reverse order
    const stepsToCompensate = completedSteps
      .filter(s => s.status === 'COMPLETED')
      .reverse();

    for (let i = 0; i < stepsToCompensate.length; i++) {
      const stepResult = stepsToCompensate[i];
      const step = definition.steps.find(s => s.name === stepResult.stepName);
      if (!step) continue;

      try {
        // Execute compensation with retry
        const maxRetries = 3;
        let attempts = 0;
        let lastError: Error | undefined;

        while (attempts < maxRetries) {
          attempts++;

          try {
            await step.undo(context, stepResult.result);
            stepResult.status = 'COMPENSATED';
            
            // Record compensation in saga log
            await sagaLogRepository.recordCompensation(sagaId, step.name);

            // Emit SAGA_STEP_COMPENSATED event
            this.emitSagaEvent(
              context.tenantId,
              sagaId,
              definition.name,
              'SAGA_STEP_COMPENSATED',
              {
                step_name: step.name,
                step_index: definition.steps.indexOf(step),
                compensation_attempts: attempts,
              }
            );
            
            logger.debug('SAGA_STEP_COMPENSATED', 'Step compensated successfully', {
              sagaId,
              stepName: step.name,
              attempts,
            });
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Classify error to determine if retryable
            const isRetryable = errorClassifier.isRetryable(lastError);
            const errorCategory = errorClassifier.getCategory(lastError);

            logger.warn('SAGA_COMPENSATION_ERROR', 'Compensation error occurred', {
              sagaId,
              stepName: step.name,
              attempt: attempts,
              maxRetries,
              isRetryable,
              errorCategory,
              error: lastError.message,
            });

            // Only retry if error is retryable and we haven't exceeded max retries
            if (!isRetryable || attempts >= maxRetries) {
              throw new SagaCompensationError(
                sagaId,
                step.name,
                lastError
              );
            }

            // Exponential backoff
            const backoff = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
            await this.sleep(backoff);
          }
        }

      } catch (error) {
        // Log compensation failure but continue with other steps
        const compensationError = error instanceof Error ? error : new Error(String(error));
        logger.error('SAGA_COMPENSATION_FAILED', 'Compensation failed for step', compensationError, {
          sagaId,
          stepName: step.name,
        });
        throw error;
      }
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    sagaId: string,
    stepName: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      this.createTimeout(timeout, sagaId, stepName),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, sagaId: string, stepName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new SagaTimeoutError(sagaId, stepName));
      }, ms);
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
