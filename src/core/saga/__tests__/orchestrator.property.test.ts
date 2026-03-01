/**
 * Property-Based Tests for Saga Orchestrator
 * 
 * Tests universal correctness properties using fast-check
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

// Mock Dexie before imports
vi.mock('@/src/core/db/schema', () => {
  const sagaLogs = new Map<string, any>();

  return {
    db: {
      saga_logs: {
        add: vi.fn(async (entity: any) => {
          sagaLogs.set(entity.saga_id, entity);
          return entity.saga_id;
        }),
        get: vi.fn(async (sagaId: string) => {
          return sagaLogs.get(sagaId) || null;
        }),
        put: vi.fn(async (entity: any) => {
          sagaLogs.set(entity.saga_id, entity);
          return entity.saga_id;
        }),
        update: vi.fn(async (sagaId: string, changes: any) => {
          const existing = sagaLogs.get(sagaId);
          if (existing) {
            sagaLogs.set(sagaId, { ...existing, ...changes });
          }
          return 1;
        }),
        where: vi.fn((field: string) => ({
          equals: vi.fn((value: any) => ({
            toArray: vi.fn(async () => {
              const results: any[] = [];
              for (const [_, entity] of sagaLogs) {
                if (field === 'tenant_id' && entity.tenant_id === value) {
                  results.push(entity);
                } else if (field === '[tenant_id+status]') {
                  const [tenantId, status] = value;
                  if (entity.tenant_id === tenantId && entity.status === status) {
                    results.push(entity);
                  }
                }
              }
              return results;
            }),
          })),
        })),
        toArray: vi.fn(async () => Array.from(sagaLogs.values())),
        clear: vi.fn(async () => {
          sagaLogs.clear();
        }),
      },
    },
    clearLocalDatabase: vi.fn(async () => {
      sagaLogs.clear();
    }),
  };
});

import { SagaOrchestrator } from '../orchestrator';
import { SagaDefinition, SagaContext, SagaStep, SagaStepResult } from '../types';
import { sagaLogRepository } from '../repository';
import { SagaRecoveryService } from '../recovery';

describe('SagaOrchestrator - Property Tests', () => {
  beforeEach(async () => {
    // Clear mock database before each test
    const { db } = await import('@/src/core/db/schema');
    await db.saga_logs.clear();
  });

  /**
   * Property 1: Sequential Step Execution
   * 
   * For any saga with N steps, if all steps succeed,
   * they must execute in the exact order defined.
   */
  it('Property 1: Steps execute sequentially in defined order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // number of steps
        async (numSteps) => {
          const executionOrder: number[] = [];
          const orchestrator = new SagaOrchestrator();

          // Create steps that record execution order
          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: numSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                executionOrder.push(i);
                return { stepIndex: i };
              },
              undo: async () => {},
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId: 'test-saga-id',
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify sequential execution
          expect(result.status).toBe('COMPLETED');
          expect(executionOrder).toEqual(Array.from({ length: numSteps }, (_, i) => i));
          expect(result.steps).toHaveLength(numSteps);
          
          // Verify all steps completed
          result.steps.forEach((step, i) => {
            expect(step.status).toBe('COMPLETED');
            expect(step.stepName).toBe(`step-${i}`);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Complete Compensation on Failure
   * 
   * If step N fails, all completed steps (0 to N-1) must be compensated
   * in reverse order.
   */
  it('Property 2: Failed step triggers complete compensation in reverse order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }), // total steps
        fc.integer({ min: 1, max: 9 }),  // failing step index
        async (totalSteps, failAtStep) => {
          // Ensure failAtStep is within bounds
          const failIndex = Math.min(failAtStep, totalSteps - 1);
          
          const executionOrder: number[] = [];
          const compensationOrder: number[] = [];
          const orchestrator = new SagaOrchestrator();

          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: totalSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                executionOrder.push(i);
                if (i === failIndex) {
                  throw new Error(`Step ${i} failed`);
                }
                return { stepIndex: i };
              },
              undo: async (ctx, result) => {
                compensationOrder.push(i);
              },
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId: 'test-saga-id',
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify compensation occurred
          expect(result.status).toBe('COMPENSATED');
          
          // Verify execution stopped at failing step
          expect(executionOrder).toHaveLength(failIndex + 1);
          
          // Verify compensation in reverse order (excluding failed step)
          const expectedCompensation = Array.from(
            { length: failIndex },
            (_, i) => failIndex - 1 - i
          );
          expect(compensationOrder).toEqual(expectedCompensation);
          
          // Verify step statuses
          result.steps.forEach((step, i) => {
            if (i < failIndex) {
              expect(step.status).toBe('COMPENSATED');
            } else if (i === failIndex) {
              expect(step.status).toBe('FAILED');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Timeout Enforcement
   * 
   * If a step exceeds its timeout, it must fail with a timeout error
   * and trigger compensation.
   */
  it('Property 5: Step timeout triggers failure and compensation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 50, max: 200 }), // step delay (ms)
        fc.integer({ min: 10, max: 100 }),  // timeout (ms)
        async (stepDelay, timeout) => {
          const orchestrator = new SagaOrchestrator();
          const compensated: string[] = [];

          const steps: SagaStep<SagaContext>[] = [
            {
              name: 'fast-step',
              do: async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return { success: true };
              },
              undo: async () => {
                compensated.push('fast-step');
              },
            },
            {
              name: 'slow-step',
              do: async () => {
                await new Promise(resolve => setTimeout(resolve, stepDelay));
                return { success: true };
              },
              undo: async () => {
                compensated.push('slow-step');
              },
              timeout,
            },
          ];

          const definition: SagaDefinition<SagaContext> = {
            name: 'timeout-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId: 'timeout-test',
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // If step delay > timeout, should fail and compensate
          if (stepDelay > timeout) {
            expect(result.status).toBe('COMPENSATED');
            expect(result.steps[1].status).toBe('FAILED');
            expect(compensated).toContain('fast-step');
          } else {
            // Otherwise should complete successfully
            expect(result.status).toBe('COMPLETED');
            expect(result.steps.every(s => s.status === 'COMPLETED')).toBe(true);
          }
        }
      ),
      { numRuns: 50, timeout: 5000 } // Reduced runs for timeout tests
    );
  });

  /**
   * Property 3: Saga State Persistence
   * 
   * For any saga execution, the saga log must be persisted before
   * execution starts and updated after each step.
   */
  it('Property 3: Saga state is persisted throughout execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of steps
        async (numSteps) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `saga-${Date.now()}-${Math.random()}`;

          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: numSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                return { stepIndex: i };
              },
              undo: async () => {},
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'persistence-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          // Execute saga
          const result = await orchestrator.execute(definition, context);

          // Verify saga log was created
          const sagaLog = await sagaLogRepository.getById(sagaId);
          expect(sagaLog).toBeDefined();
          expect(sagaLog?.sagaId).toBe(sagaId);
          expect(sagaLog?.sagaName).toBe('persistence-test-saga');
          expect(sagaLog?.tenantId).toBe('test-tenant');

          // Verify final status matches result
          expect(sagaLog?.status).toBe(result.status);

          // Verify step results were recorded
          if (result.status === 'COMPLETED') {
            expect(sagaLog?.steps).toHaveLength(numSteps);
            sagaLog?.steps.forEach((step: SagaStepResult, i: number) => {
              expect(step.stepName).toBe(`step-${i}`);
              expect(step.status).toBe('COMPLETED');
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Saga Completion Status
   * 
   * A saga's final status must accurately reflect the outcome:
   * - COMPLETED if all steps succeed
   * - COMPENSATED if any step fails and compensation succeeds
   * - FAILED if compensation fails
   */
  it('Property 4: Saga completion status reflects execution outcome', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 8 }), // total steps
        fc.option(fc.integer({ min: 0, max: 7 }), { nil: null }), // optional failing step
        async (totalSteps, failAtStep) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `saga-${Date.now()}-${Math.random()}`;

          // Adjust failAtStep to be within bounds
          const failIndex = failAtStep !== null && failAtStep < totalSteps ? failAtStep : null;

          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: totalSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                if (failIndex !== null && i === failIndex) {
                  throw new Error(`Step ${i} failed`);
                }
                return { stepIndex: i };
              },
              undo: async (ctx, result) => {
                // Compensation always succeeds in this simplified test
              },
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'status-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify status based on execution outcome
          if (failIndex === null) {
            // No failure - should complete
            expect(result.status).toBe('COMPLETED');
          } else {
            // Step failed but compensation succeeded
            expect(result.status).toBe('COMPENSATED');
          }

          // Verify saga log status matches
          const sagaLog = await sagaLogRepository.getById(sagaId);
          expect(sagaLog?.status).toBe(result.status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Outbox Pattern Integration
   * 
   * For any saga event emitted, the event must be published through the
   * existing Outbox Pattern to ensure reliable delivery.
   */
  it('Property 14: Saga events are published through Outbox Pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of steps
        async (numSteps) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `outbox-test-${Date.now()}-${Math.random()}`;
          const publishedEvents: any[] = [];

          // Mock event bus to capture published events
          const mockEventBus = {
            publish: vi.fn((tenantId: string, event: any) => {
              publishedEvents.push({
                tenantId,
                event,
                timestamp: Date.now(),
              });
            }),
            subscribe: vi.fn(),
          };

          // Replace event bus temporarily
          const originalEventBus = (await import('@/src/core/infra/event-bus')).eventBus;
          vi.mocked(originalEventBus).publish = mockEventBus.publish;

          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: numSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                return { stepIndex: i };
              },
              undo: async () => {},
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'outbox-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify saga events were published
          expect(publishedEvents.length).toBeGreaterThan(0);

          // Verify event structure includes saga context
          publishedEvents.forEach(({ event }) => {
            expect(event).toHaveProperty('event_type');
            expect(event).toHaveProperty('payload');
            expect(event.payload).toHaveProperty('saga_id', sagaId);
            expect(event.payload).toHaveProperty('saga_type', 'outbox-test-saga');
          });

          // Verify expected event types were emitted
          const eventTypes = publishedEvents.map(e => e.event.event_type);
          expect(eventTypes).toContain('SAGA_STARTED');
          
          if (result.status === 'COMPLETED') {
            expect(eventTypes).toContain('SAGA_COMPLETED');
            // Should have SAGA_STEP_COMPLETED for each step
            const stepCompletedCount = eventTypes.filter(
              t => t === 'SAGA_STEP_COMPLETED'
            ).length;
            expect(stepCompletedCount).toBe(numSteps);
          } else if (result.status === 'COMPENSATED') {
            expect(eventTypes).toContain('SAGA_COMPENSATED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Event Projection Compatibility
   * 
   * For any saga event emitted, the event must be processable by existing
   * event projections and reducers without errors.
   */
  it('Property 15: Saga events are compatible with existing projections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // number of steps
        async (numSteps) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `projection-test-${Date.now()}-${Math.random()}`;
          const emittedEvents: any[] = [];

          // Mock event bus to capture events
          const mockEventBus = {
            publish: vi.fn((tenantId: string, event: any) => {
              emittedEvents.push(event);
            }),
            subscribe: vi.fn(),
          };

          const originalEventBus = (await import('@/src/core/infra/event-bus')).eventBus;
          vi.mocked(originalEventBus).publish = mockEventBus.publish;

          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: numSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                return { stepIndex: i, data: `result-${i}` };
              },
              undo: async () => {},
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'projection-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify all emitted events have required fields for projection compatibility
          emittedEvents.forEach((event) => {
            // Required fields for event projection
            expect(event).toHaveProperty('event_id');
            expect(event).toHaveProperty('tenant_id');
            expect(event).toHaveProperty('event_type');
            expect(event).toHaveProperty('payload');
            expect(event).toHaveProperty('occurred_at');
            expect(event).toHaveProperty('aggregate_type');
            expect(event).toHaveProperty('aggregate_id');
            expect(event).toHaveProperty('correlation_id');

            // Saga-specific fields
            expect(event.aggregate_type).toBe('SAGA');
            expect(event.aggregate_id).toBe(sagaId);
            expect(event.correlation_id).toBe(sagaId);

            // Payload must be serializable
            expect(() => JSON.stringify(event.payload)).not.toThrow();

            // Event type must be valid
            const validEventTypes = [
              'SAGA_STARTED',
              'SAGA_STEP_COMPLETED',
              'SAGA_STEP_FAILED',
              'SAGA_STEP_COMPENSATED',
              'SAGA_COMPLETED',
              'SAGA_COMPENSATED',
              'SAGA_FAILED',
            ];
            expect(validEventTypes).toContain(event.event_type);
          });

          // Verify event ordering is preserved
          const eventTypes = emittedEvents.map(e => e.event_type);
          expect(eventTypes[0]).toBe('SAGA_STARTED');
          expect(eventTypes[eventTypes.length - 1]).toMatch(
            /SAGA_COMPLETED|SAGA_COMPENSATED|SAGA_FAILED/
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Error Handling Property Tests
 */
describe('SagaOrchestrator - Error Handling Properties', () => {
  beforeEach(async () => {
    const { db } = await import('@/src/core/db/schema');
    await db.saga_logs.clear();
    
    // Mock sleep to avoid actual delays in tests
    vi.spyOn(SagaOrchestrator.prototype as any, 'sleep').mockImplementation(async () => {
      // No actual delay - return immediately
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Property 16: Retry Behavior
   * 
   * For any saga step that fails with a transient error, the step must be
   * retried up to the configured maximum attempts. For permanent errors,
   * rollback must begin immediately without retries.
   */
  it('Property 16: Transient errors are retried, permanent errors trigger immediate rollback', async () => {
    const { 
      NetworkError, 
      ValidationError, 
      TimeoutError, 
      AuthorizationError 
    } = await import('../errors');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('transient', 'permanent'), // error type
        fc.integer({ min: 1, max: 3 }), // max retries (reduced to avoid timeout)
        async (errorType, maxRetries) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `retry-test-${Date.now()}-${Math.random()}`;
          const attemptCounts: Record<string, number> = {};

          // Create error based on type
          const createError = () => {
            if (errorType === 'transient') {
              return Math.random() > 0.5 
                ? new NetworkError('Network timeout')
                : new TimeoutError('Request timeout');
            } else {
              return Math.random() > 0.5
                ? new ValidationError('Invalid input')
                : new AuthorizationError('Unauthorized');
            }
          };

          const steps: SagaStep<SagaContext>[] = [
            {
              name: 'success-step',
              do: async () => {
                attemptCounts['success-step'] = (attemptCounts['success-step'] || 0) + 1;
                return { success: true };
              },
              undo: async () => {},
            },
            {
              name: 'failing-step',
              do: async () => {
                attemptCounts['failing-step'] = (attemptCounts['failing-step'] || 0) + 1;
                throw createError();
              },
              undo: async () => {},
              retryable: true,
              maxRetries,
            },
          ];

          const definition: SagaDefinition<SagaContext> = {
            name: 'retry-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          const result = await orchestrator.execute(definition, context);

          // Verify behavior based on error type
          if (errorType === 'transient') {
            // Transient errors should be retried up to maxRetries
            expect(attemptCounts['failing-step']).toBe(maxRetries);
          } else {
            // Permanent errors should fail immediately (1 attempt only)
            expect(attemptCounts['failing-step']).toBe(1);
          }

          // Both should trigger compensation
          expect(result.status).toBe('COMPENSATED');
          expect(result.steps[1].status).toBe('FAILED');
        }
      ),
      { numRuns: 100 } // Sleep is mocked, no actual delays
    );
  });

  /**
   * Property 17: Compensation Retry
   * 
   * For any compensating transaction that fails, the compensation must be
   * retried up to the configured maximum attempts. If all retries fail,
   * the saga must be marked as requiring manual intervention.
   */
  it('Property 17: Compensation failures are retried, saga marked for intervention after all retries fail', async () => {
    const { NetworkError, ValidationError } = await import('../errors');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('transient', 'permanent'), // compensation error type
        async (compensationErrorType) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `compensation-retry-${Date.now()}-${Math.random()}`;
          const compensationAttempts: number[] = [];

          const steps: SagaStep<SagaContext>[] = [
            {
              name: 'step-1',
              do: async () => ({ success: true }),
              undo: async () => {
                compensationAttempts.push(Date.now());
                // Always fail compensation
                if (compensationErrorType === 'transient') {
                  throw new NetworkError('Compensation network error');
                } else {
                  throw new ValidationError('Compensation validation error');
                }
              },
            },
            {
              name: 'step-2',
              do: async () => {
                throw new Error('Step 2 fails to trigger compensation');
              },
              undo: async () => {},
            },
          ];

          const definition: SagaDefinition<SagaContext> = {
            name: 'compensation-retry-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          // Execute saga - should fail and attempt compensation
          try {
            await orchestrator.execute(definition, context);
          } catch (error) {
            // Expected to throw on compensation failure
          }

          // Verify compensation retry behavior
          if (compensationErrorType === 'transient') {
            // Transient errors should be retried (3 attempts)
            expect(compensationAttempts.length).toBe(3);
          } else {
            // Permanent errors should fail immediately (1 attempt)
            expect(compensationAttempts.length).toBe(1);
          }
        }
      ),
      { numRuns: 100 } // Sleep is mocked, no actual delays
    );
  });

  /**
   * Property 18: Error Classification
   * 
   * For any error encountered during saga execution, the system must
   * correctly classify it as either transient (retryable) or permanent
   * (non-retryable) based on error type and code.
   */
  it('Property 18: Errors are correctly classified as transient or permanent', async () => {
    const { 
      NetworkError, 
      TimeoutError, 
      DatabaseError,
      RateLimitError,
      ServiceUnavailableError,
      ValidationError, 
      AuthorizationError,
      BusinessRuleError,
      InsufficientFundsError,
      errorClassifier
    } = await import('../errors');

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'NetworkError',
          'TimeoutError',
          'DatabaseError',
          'RateLimitError',
          'ServiceUnavailableError',
          'ValidationError',
          'AuthorizationError',
          'BusinessRuleError',
          'InsufficientFundsError'
        ),
        async (errorType) => {
          // Create error instance
          let error: Error;
          let expectedRetryable: boolean;
          let expectedCategory: 'transient' | 'permanent';

          switch (errorType) {
            case 'NetworkError':
              error = new NetworkError('Network failure');
              expectedRetryable = true;
              expectedCategory = 'transient';
              break;
            case 'TimeoutError':
              error = new TimeoutError('Request timeout');
              expectedRetryable = true;
              expectedCategory = 'transient';
              break;
            case 'DatabaseError':
              error = new DatabaseError('Connection lost');
              expectedRetryable = true;
              expectedCategory = 'transient';
              break;
            case 'RateLimitError':
              error = new RateLimitError('Too many requests');
              expectedRetryable = true;
              expectedCategory = 'transient';
              break;
            case 'ServiceUnavailableError':
              error = new ServiceUnavailableError('Service down');
              expectedRetryable = true;
              expectedCategory = 'transient';
              break;
            case 'ValidationError':
              error = new ValidationError('Invalid input');
              expectedRetryable = false;
              expectedCategory = 'permanent';
              break;
            case 'AuthorizationError':
              error = new AuthorizationError('Unauthorized');
              expectedRetryable = false;
              expectedCategory = 'permanent';
              break;
            case 'BusinessRuleError':
              error = new BusinessRuleError('Rule violation');
              expectedRetryable = false;
              expectedCategory = 'permanent';
              break;
            case 'InsufficientFundsError':
              error = new InsufficientFundsError('Not enough funds');
              expectedRetryable = false;
              expectedCategory = 'permanent';
              break;
            default:
              throw new Error(`Unknown error type: ${errorType}`);
          }

          // Verify classification
          const isRetryable = errorClassifier.isRetryable(error);
          const category = errorClassifier.getCategory(error);

          expect(isRetryable).toBe(expectedRetryable);
          expect(category).toBe(expectedCategory);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Saga Event Integration Property Tests
 */
describe('SagaOrchestrator - Event Integration Properties', () => {
  beforeEach(async () => {
    const { db } = await import('@/src/core/db/schema');
    await db.saga_logs.clear();
  });

  /**
   * Property 11: Event Emission for Saga Operations
   * 
   * For any saga step completion or compensation, the system must emit
   * a standard PARK POS event with saga context (saga_id, step_name)
   * included in the payload.
   * 
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  it('Property 11: Saga operations emit events with correct saga context', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of steps
        fc.option(fc.integer({ min: 0, max: 4 }), { nil: null }), // optional failing step
        async (numSteps, failAtStep) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = `event-test-${Date.now()}-${Math.random()}`;
          const emittedEvents: any[] = [];

          // Mock event bus publish to capture events (same pattern as Property 10/15)
          const originalEventBus = (await import('@/src/core/infra/event-bus')).eventBus;
          vi.mocked(originalEventBus).publish = vi.fn((tenantId: string, event: any) => {
            emittedEvents.push(event);
          });

          // Adjust failAtStep to be within bounds
            const failIndex = failAtStep !== null && failAtStep < numSteps ? failAtStep : null;

            const steps: SagaStep<SagaContext>[] = Array.from(
              { length: numSteps },
              (_, i) => ({
                name: `step-${i}`,
                do: async (ctx) => {
                  if (failIndex !== null && i === failIndex) {
                    throw new Error(`Step ${i} failed`);
                  }
                  return { stepIndex: i };
                },
                undo: async () => {},
              })
            );

            const definition: SagaDefinition<SagaContext> = {
              name: 'event-test-saga',
              steps,
            };

            const context: SagaContext = {
              sagaId,
              tenantId: 'test-tenant',
              startedAt: new Date(),
            };

            // Execute saga
            await orchestrator.execute(definition, context);

            // Verify SAGA_STARTED event was emitted
            const startedEvent = emittedEvents.find(e => e.event_type === 'SAGA_STARTED');
            expect(startedEvent).toBeDefined();
            expect(startedEvent.aggregate_type).toBe('SAGA');
            expect(startedEvent.aggregate_id).toBe(sagaId);
            expect(startedEvent.payload.saga_id).toBe(sagaId);
            expect(startedEvent.payload.saga_type).toBe('event-test-saga');

            if (failIndex === null) {
              // All steps succeeded - verify SAGA_STEP_COMPLETED events
              const stepCompletedEvents = emittedEvents.filter(
                e => e.event_type === 'SAGA_STEP_COMPLETED'
              );
              expect(stepCompletedEvents).toHaveLength(numSteps);

              // Verify each step completion event has correct context
              stepCompletedEvents.forEach((event, i) => {
                expect(event.aggregate_type).toBe('SAGA');
                expect(event.aggregate_id).toBe(sagaId);
                expect(event.payload.saga_id).toBe(sagaId);
                expect(event.payload.saga_type).toBe('event-test-saga');
                expect(event.payload.step_name).toBe(`step-${i}`);
                expect(event.payload.step_index).toBe(i);
              });

              // Verify SAGA_COMPLETED event
              const completedEvent = emittedEvents.find(e => e.event_type === 'SAGA_COMPLETED');
              expect(completedEvent).toBeDefined();
              expect(completedEvent.payload.saga_id).toBe(sagaId);
              expect(completedEvent.payload.completed_steps).toHaveLength(numSteps);
            } else {
              // Step failed - verify SAGA_STEP_FAILED event
              const failedEvent = emittedEvents.find(e => e.event_type === 'SAGA_STEP_FAILED');
              expect(failedEvent).toBeDefined();
              expect(failedEvent.payload.saga_id).toBe(sagaId);
              expect(failedEvent.payload.step_name).toBe(`step-${failIndex}`);
              expect(failedEvent.payload.step_index).toBe(failIndex);

              // Verify SAGA_STEP_COMPENSATED events for completed steps
              const compensatedEvents = emittedEvents.filter(
                e => e.event_type === 'SAGA_STEP_COMPENSATED'
              );
              expect(compensatedEvents).toHaveLength(failIndex);

              compensatedEvents.forEach((event) => {
                expect(event.aggregate_type).toBe('SAGA');
                expect(event.aggregate_id).toBe(sagaId);
                expect(event.payload.saga_id).toBe(sagaId);
                expect(event.payload.saga_type).toBe('event-test-saga');
              });

              // Verify SAGA_COMPENSATED event
              const compensatedEvent = emittedEvents.find(e => e.event_type === 'SAGA_COMPENSATED');
              expect(compensatedEvent).toBeDefined();
              expect(compensatedEvent.payload.saga_id).toBe(sagaId);
              expect(compensatedEvent.payload.failed_step).toBe(`step-${failIndex}`);
            }

            // Verify all saga events have required fields
            const sagaEvents = emittedEvents.filter(e => 
              e.event_type.startsWith('SAGA_')
            );

            sagaEvents.forEach(event => {
              // Verify event structure
              expect(event.event_id).toBeDefined();
              expect(event.tenant_id).toBe('test-tenant');
              expect(event.terminal_id).toBe('saga-orchestrator');
              expect(event.occurred_at).toBeDefined();
              expect(event.aggregate_type).toBe('SAGA');
              expect(event.aggregate_id).toBe(sagaId);
              expect(event.correlation_id).toBe(sagaId);
              expect(event.schema_version).toBe(1);
              expect(event.payload_version).toBe(1);
              
              // Verify saga context in payload
              expect(event.payload.saga_id).toBe(sagaId);
              expect(event.payload.saga_type).toBe('event-test-saga');
            });

        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Outbox Pattern Integration
   * 
   * For any saga event emitted, the event must be published through the
   * existing event bus infrastructure, which ensures Outbox Pattern
   * integration for reliable delivery.
   * 
   * Validates: Requirements 7.4
   */
  it('Property 14: Saga events use Outbox Pattern for reliable publishing', async () => {
    const { v4: uuidv4 } = await import('uuid');

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // number of steps
        async (numSteps) => {
          const orchestrator = new SagaOrchestrator();
          const sagaId = uuidv4();
          const tenantId = uuidv4();
          const emittedEvents: any[] = [];

          // Mock event bus publish to capture events (same pattern as Property 11)
          const originalEventBus = (await import('@/src/core/infra/event-bus')).eventBus;
          vi.mocked(originalEventBus).publish = vi.fn((tid: string, event: any) => {
            emittedEvents.push(event);
          });

          const steps: SagaStep<SagaContext>[] = Array.from(
              { length: numSteps },
              (_, i) => ({
                name: `step-${i}`,
                do: async (ctx) => ({ stepIndex: i }),
                undo: async () => {},
              })
            );

            const definition: SagaDefinition<SagaContext> = {
              name: 'outbox-test-saga',
              steps,
            };

            const context: SagaContext = {
              sagaId,
              tenantId,
              startedAt: new Date(),
            };

            // Execute saga
            await orchestrator.execute(definition, context);

            // Verify all saga events were published through event bus
            const sagaEvents = emittedEvents.filter(e => 
              e.event_type.startsWith('SAGA_')
            );

            // Should have: SAGA_STARTED + N * SAGA_STEP_COMPLETED + SAGA_COMPLETED
            const expectedEventCount = 1 + numSteps + 1;
            expect(sagaEvents).toHaveLength(expectedEventCount);

            // Verify events have all required fields for Outbox Pattern
            sagaEvents.forEach(event => {
              // Required for event_outbox table
              expect(event.event_id).toBeDefined();
              expect(event.tenant_id).toBeDefined();
              expect(event.occurred_at).toBeDefined();
              expect(event.aggregate_type).toBeDefined();
              expect(event.aggregate_id).toBeDefined();
              expect(event.event_type).toBeDefined();
              expect(event.payload).toBeDefined();
              
              // Verify event_id is a valid UUID
              expect(event.event_id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
              );
              
              // Verify occurred_at is a valid ISO timestamp
              expect(() => new Date(event.occurred_at)).not.toThrow();
              
              // Verify payload is serializable (required for JSON storage)
              expect(() => JSON.stringify(event.payload)).not.toThrow();
              expect(() => JSON.parse(JSON.stringify(event.payload))).not.toThrow();
            });

        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Saga Recovery Property Tests
 */
describe('SagaRecoveryService - Property Tests', () => {
  /**
   * Property 9: Saga Recovery
   * 
   * For any in-progress saga that exists when the system restarts,
   * the saga must be resumed from its last persisted step.
   */
  it('Property 9: In-progress sagas are recovered and resumed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 3, max: 8 }), // total steps
        fc.integer({ min: 1, max: 6 }), // steps completed before "crash"
        async (totalSteps, completedSteps) => {
          // Ensure completedSteps < totalSteps
          const actualCompleted = Math.min(completedSteps, totalSteps - 1);

          const orchestrator = new SagaOrchestrator();
          const sagaId = `recovery-saga-${Date.now()}-${Math.random()}`;
          const executionOrder: string[] = [];

          // Create saga definition
          const steps: SagaStep<SagaContext>[] = Array.from(
            { length: totalSteps },
            (_, i) => ({
              name: `step-${i}`,
              do: async (ctx) => {
                executionOrder.push(`step-${i}`);
                return { stepIndex: i };
              },
              undo: async () => {},
            })
          );

          const definition: SagaDefinition<SagaContext> = {
            name: 'recovery-test-saga',
            steps,
          };

          const context: SagaContext = {
            sagaId,
            tenantId: 'test-tenant',
            startedAt: new Date(),
          };

          // Simulate partial execution (system "crashes" after N steps)
          const partialDefinition: SagaDefinition<SagaContext> = {
            ...definition,
            steps: steps.slice(0, actualCompleted),
          };

          // Execute partial saga
          await orchestrator.execute(partialDefinition, context);

          // Manually update saga status to IN_PROGRESS (simulating crash)
          const sagaLog = await sagaLogRepository.getById(sagaId);
          expect(sagaLog).toBeDefined();
          
          // Update status to IN_PROGRESS to simulate interrupted saga
          const { db } = await import('@/src/core/db/schema');
          await db.saga_logs.update(sagaId, {
            ...sagaLogRepository['toEntity'](sagaLog!),
            status: 'IN_PROGRESS',
          });

          // Clear execution order to track recovery
          executionOrder.length = 0;

          // Create recovery service and register saga
          const recoveryService = new SagaRecoveryService(orchestrator);
          recoveryService.registerSaga(definition);

          // Recover in-progress sagas
          await recoveryService.recoverInProgressSagas('test-tenant');

          // Verify remaining steps were executed
          const remainingSteps = totalSteps - actualCompleted;
          expect(executionOrder).toHaveLength(remainingSteps);

          // Verify steps executed in correct order
          for (let i = 0; i < remainingSteps; i++) {
            expect(executionOrder[i]).toBe(`step-${actualCompleted + i}`);
          }

          // Verify saga is now completed
          const finalLog = await sagaLogRepository.getById(sagaId);
          expect(finalLog?.status).toBe('COMPLETED');
          expect(finalLog?.steps).toHaveLength(totalSteps);
        }
      ),
      { numRuns: 50 }
    );
  });
});
