# Design Document: Saga Pattern for Complex Flows

## Overview

This design implements the Saga Pattern for PARK POS to provide transactional guarantees across complex multi-step business flows in an offline-first, event-sourced environment. The implementation follows the orchestration-based saga pattern where a central orchestrator coordinates the execution of saga steps and manages compensating transactions on failure.

The design integrates seamlessly with the existing Event Sourcing architecture, using the established event schema, Outbox Pattern for reliable publishing, and IndexedDB/PostgreSQL dual-storage model. Sagas will emit standard PARK POS events for each step, ensuring full auditability and compatibility with existing projections and reducers.

### Key Design Decisions

1. **Orchestration over Choreography**: We use orchestration (centralized coordinator) rather than choreography (distributed coordination) because:
   - Simpler to reason about and debug
   - Explicit rollback logic in one place
   - Better for offline-first scenarios where distributed coordination is challenging
   - Easier to add new saga types

2. **Event-Based State Persistence**: Saga state is persisted through events rather than mutable state tables because:
   - Consistent with Event Sourcing principles
   - Full audit trail of saga execution
   - Enables saga replay and debugging
   - Works naturally with existing sync infrastructure

3. **Dual Storage Model**: Saga logs stored in both IndexedDB (local) and PostgreSQL (server) because:
   - Supports offline execution
   - Provides server-side visibility for monitoring
   - Enables cross-terminal saga coordination
   - Maintains consistency with existing architecture

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Complete Sale│  │  Void Sale   │  │Apply Promotion│      │
│  │   Handler    │  │   Handler    │  │   Handler     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘      │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            │                                  │
└────────────────────────────┼──────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────┐
│                     Saga Orchestration Layer                  │
│                            │                                  │
│                   ┌────────▼────────┐                         │
│                   │ SagaOrchestrator│                         │
│                   └────────┬────────┘                         │
│                            │                                  │
│         ┌──────────────────┼──────────────────┐              │
│         │                  │                  │              │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌─────▼──────┐       │
│  │CompleteSale │  │   VoidSale      │  │ApplyPromo  │       │
│  │    Saga     │  │    Saga         │  │   Saga     │       │
│  └──────┬──────┘  └────────┬────────┘  └─────┬──────┘       │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────┐
│         │         Saga Persistence Layer      │              │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼──────┐       │
│  │              SagaLog Repository                    │       │
│  └──────┬─────────────────────────────────────┬──────┘       │
│         │                                     │              │
│  ┌──────▼──────┐                      ┌───────▼──────┐       │
│  │  IndexedDB  │                      │  PostgreSQL  │       │
│  │ (saga_logs) │                      │ (saga_logs)  │       │
│  └─────────────┘                      └──────────────┘       │
└──────────────────────────────────────────────────────────────┘

          │                                     │
┌─────────┼─────────────────────────────────────┼──────────────┐
│         │         Event Sourcing Layer        │              │
│         │                                     │              │
│  ┌──────▼──────────────────────────────────────▼──────┐      │
│  │           Event Bus & Outbox Pattern               │      │
│  └──────┬─────────────────────────────────────┬──────┘      │
│         │                                     │             │
│  ┌──────▼──────┐                      ┌───────▼──────┐      │
│  │  IndexedDB  │                      │  PostgreSQL  │      │
│  │   (events)  │                      │   (events)   │      │
│  └─────────────┘                      └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Saga Initiation**: Application layer calls saga orchestrator with saga type and parameters
2. **Step Execution**: Orchestrator executes each saga step sequentially
3. **Event Emission**: Each successful step emits standard PARK POS events
4. **State Persistence**: Saga state persisted to saga_logs after each step
5. **Failure Handling**: On failure, orchestrator executes compensating transactions in reverse order
6. **Completion**: Saga marked as completed or failed in saga_logs

## Components and Interfaces

### 1. SagaOrchestrator

The central coordinator responsible for executing sagas and managing their lifecycle.

```typescript
interface SagaOrchestrator {
  /**
   * Execute a saga with the given definition and context
   * @returns SagaResult indicating success or failure
   */
  execute<TContext>(
    sagaDefinition: SagaDefinition<TContext>,
    context: TContext
  ): Promise<SagaResult>;

  /**
   * Resume an in-progress saga from its last persisted state
   * @returns SagaResult indicating success or failure
   */
  resume(sagaId: string): Promise<SagaResult>;

  /**
   * Get the current status of a saga
   */
  getStatus(sagaId: string): Promise<SagaStatus>;
}

interface SagaDefinition<TContext> {
  sagaType: string;
  steps: SagaStep<TContext>[];
  timeout?: number; // milliseconds
  retryPolicy?: RetryPolicy;
}

interface SagaStep<TContext> {
  name: string;
  do: (context: TContext) => Promise<StepResult>;
  undo: (context: TContext) => Promise<void>;
  retryable?: boolean;
}

interface StepResult {
  success: boolean;
  data?: unknown;
  error?: SagaError;
}

interface SagaResult {
  sagaId: string;
  status: 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  completedSteps: string[];
  failedStep?: string;
  error?: SagaError;
}

interface SagaError {
  code: string;
  message: string;
  transient: boolean; // true if error is retryable
  details?: Record<string, unknown>;
}

interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}
```

### 2. SagaLog Repository

Manages persistence of saga execution state.

```typescript
interface SagaLogRepository {
  /**
   * Create a new saga log entry
   */
  create(log: SagaLogCreate): Promise<SagaLog>;

  /**
   * Update saga log with step completion
   */
  recordStepCompletion(
    sagaId: string,
    stepName: string,
    result: StepResult
  ): Promise<void>;

  /**
   * Update saga log with compensation
   */
  recordCompensation(
    sagaId: string,
    stepName: string,
    error?: Error
  ): Promise<void>;

  /**
   * Mark saga as completed
   */
  markCompleted(sagaId: string): Promise<void>;

  /**
   * Mark saga as failed
   */
  markFailed(sagaId: string, error: SagaError): Promise<void>;

  /**
   * Get saga log by ID
   */
  getById(sagaId: string): Promise<SagaLog | null>;

  /**
   * Find in-progress sagas (for recovery)
   */
  findInProgress(tenantId: string): Promise<SagaLog[]>;

  /**
   * Query saga logs with filters
   */
  query(filters: SagaLogFilters): Promise<SagaLog[]>;
}

interface SagaLogCreate {
  sagaId: string;
  tenantId: string;
  terminalId: string;
  sagaType: string;
  context: Record<string, unknown>;
  actorId?: string;
  correlationId: string;
}

interface SagaLog {
  sagaId: string;
  tenantId: string;
  terminalId: string;
  sagaType: string;
  status: SagaStatus;
  context: Record<string, unknown>;
  steps: SagaStepLog[];
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  error?: SagaError;
  actorId?: string;
  correlationId: string;
}

type SagaStatus = 
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'COMPENSATING'
  | 'COMPENSATED'
  | 'REQUIRES_MANUAL_INTERVENTION';

interface SagaStepLog {
  stepName: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  startedAt: string;
  completedAt?: string;
  attempts: number;
  result?: StepResult;
  compensatedAt?: string;
}

interface SagaLogFilters {
  tenantId: string;
  sagaType?: string;
  status?: SagaStatus;
  startedAfter?: string;
  startedBefore?: string;
  limit?: number;
}
```

### 3. Saga Definitions

#### CompleteSaleSaga

```typescript
interface CompleteSaleContext {
  tenantId: string;
  terminalId: string;
  actorId: string;
  orderId: string;
  checkId: string;
  paymentMethod: PaymentMethod;
  amountCents: number;
  couponId?: string;
}

const completeSaleSaga: SagaDefinition<CompleteSaleContext> = {
  sagaType: 'COMPLETE_SALE',
  timeout: 30000, // 30 seconds
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 5000,
  },
  steps: [
    {
      name: 'validate_payment',
      do: async (ctx) => validatePayment(ctx),
      undo: async (ctx) => refundPayment(ctx),
      retryable: true,
    },
    {
      name: 'reserve_coupon',
      do: async (ctx) => reserveCoupon(ctx),
      undo: async (ctx) => releaseCoupon(ctx),
      retryable: true,
    },
    {
      name: 'issue_invoice',
      do: async (ctx) => issueInvoice(ctx),
      undo: async (ctx) => voidInvoice(ctx),
      retryable: false, // Invoice generation is not retryable
    },
    {
      name: 'queue_print',
      do: async (ctx) => queuePrint(ctx),
      undo: async (ctx) => cancelPrint(ctx),
      retryable: true,
    },
  ],
};
```

#### VoidSaleSaga

```typescript
interface VoidSaleContext {
  tenantId: string;
  terminalId: string;
  actorId: string;
  orderId: string;
  invoiceId: string;
  reason: string;
  approvedBy: string;
}

const voidSaleSaga: SagaDefinition<VoidSaleContext> = {
  sagaType: 'VOID_SALE',
  timeout: 30000,
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 5000,
  },
  steps: [
    {
      name: 'validate_authorization',
      do: async (ctx) => validateAuthorization(ctx),
      undo: async () => {}, // No compensation needed
      retryable: false,
    },
    {
      name: 'void_invoice',
      do: async (ctx) => voidInvoice(ctx),
      undo: async (ctx) => restoreInvoice(ctx),
      retryable: false,
    },
    {
      name: 'refund_payment',
      do: async (ctx) => refundPayment(ctx),
      undo: async (ctx) => reverseRefund(ctx),
      retryable: true,
    },
    {
      name: 'release_coupon',
      do: async (ctx) => releaseCoupon(ctx),
      undo: async (ctx) => reserveCoupon(ctx),
      retryable: true,
    },
  ],
};
```

#### ApplyPromotionSaga

```typescript
interface ApplyPromotionContext {
  tenantId: string;
  terminalId: string;
  actorId: string;
  orderId: string;
  promotionId: string;
}

const applyPromotionSaga: SagaDefinition<ApplyPromotionContext> = {
  sagaType: 'APPLY_PROMOTION',
  timeout: 15000,
  retryPolicy: {
    maxAttempts: 3,
    backoffMs: 500,
    maxBackoffMs: 2000,
  },
  steps: [
    {
      name: 'validate_eligibility',
      do: async (ctx) => validatePromotionEligibility(ctx),
      undo: async () => {}, // No compensation needed
      retryable: false,
    },
    {
      name: 'reserve_promotion',
      do: async (ctx) => reservePromotion(ctx),
      undo: async (ctx) => releasePromotion(ctx),
      retryable: true,
    },
    {
      name: 'apply_discount',
      do: async (ctx) => applyDiscount(ctx),
      undo: async (ctx) => removeDiscount(ctx),
      retryable: false,
    },
    {
      name: 'send_notification',
      do: async (ctx) => sendPromotionNotification(ctx),
      undo: async () => {}, // Notification failure doesn't require compensation
      retryable: true,
    },
  ],
};
```

## Data Models

### Saga Log Schema (IndexedDB)

```typescript
interface SagaLogEntity {
  saga_id: string; // Primary key
  tenant_id: string;
  terminal_id: string;
  saga_type: string;
  status: SagaStatus;
  context: string; // JSON serialized
  steps: string; // JSON serialized SagaStepLog[]
  started_at: string; // ISO 8601
  completed_at?: string;
  failed_at?: string;
  error?: string; // JSON serialized SagaError
  actor_id?: string;
  correlation_id: string;
  synced: number; // 0 = not synced, 1 = synced
}

// Dexie schema
db.version(5).stores({
  saga_logs: 'saga_id, [tenant_id+status], [tenant_id+saga_type], [synced+tenant_id]',
});
```

### Saga Log Schema (PostgreSQL)

```sql
CREATE TABLE saga_logs (
  saga_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  terminal_id TEXT NOT NULL,
  saga_type TEXT NOT NULL,
  status TEXT NOT NULL,
  context JSONB NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error JSONB,
  actor_id UUID,
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT saga_logs_status_check 
    CHECK (status IN ('STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 
                      'COMPENSATING', 'COMPENSATED', 'REQUIRES_MANUAL_INTERVENTION'))
);

CREATE INDEX idx_saga_logs_tenant_status ON saga_logs(tenant_id, status);
CREATE INDEX idx_saga_logs_tenant_type ON saga_logs(tenant_id, saga_type);
CREATE INDEX idx_saga_logs_started_at ON saga_logs(started_at DESC);
CREATE INDEX idx_saga_logs_correlation ON saga_logs(correlation_id);
```

### Saga Events Schema

Saga execution emits standard PARK POS events with saga context:

```typescript
interface SagaEventPayload {
  saga_id: string;
  saga_type: string;
  step_name: string;
  step_status: 'STARTED' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  // ... step-specific payload
}

// Example: SAGA_STEP_COMPLETED event
const sagaStepCompletedEvent: ParkEvent = {
  event_id: newUUID(),
  tenant_id: ctx.tenantId,
  terminal_id: ctx.terminalId,
  terminal_sequence: getNextSequence(),
  occurred_at: new Date().toISOString(),
  aggregate_type: 'ORDER', // or relevant aggregate
  aggregate_id: ctx.orderId,
  correlation_id: ctx.correlationId,
  causation_id: null,
  actor_id: ctx.actorId,
  actor_role_snapshot: 'CASHIER',
  schema_version: 1,
  payload_version: 1,
  event_type: 'SAGA_STEP_COMPLETED',
  payload: {
    saga_id: sagaId,
    saga_type: 'COMPLETE_SALE',
    step_name: 'validate_payment',
    step_status: 'COMPLETED',
    // ... additional data
  },
};
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Sequential Step Execution

*For any* saga definition with multiple steps, when the saga is executed, each step should be executed in the order defined in the saga definition, and the next step should only execute after the previous step completes successfully.

**Validates: Requirements 1.1, 1.2**

### Property 2: Complete Compensation on Failure

*For any* saga execution that fails at step N, all completed steps (1 through N-1) should have their compensating transactions executed in reverse order (N-1 down to 1).

**Validates: Requirements 1.3**

### Property 3: Saga State Persistence

*For any* saga execution, the saga log should be updated before and after each step execution, ensuring that the current state is always persisted before proceeding.

**Validates: Requirements 1.4**

### Property 4: Saga Completion Status

*For any* saga execution, if all steps complete successfully, the saga status should be marked as 'COMPLETED', and if any step fails and rollback completes, the saga status should be marked as 'FAILED' or 'COMPENSATED'.

**Validates: Requirements 1.5, 1.6**

### Property 5: Timeout Enforcement

*For any* saga with a configured timeout, if the saga execution time exceeds the timeout, the saga should automatically begin rollback and be marked as failed.

**Validates: Requirements 1.7**

### Property 6: Saga Log Creation

*For any* saga execution, a saga log entry should be created when the saga starts, before any steps are executed.

**Validates: Requirements 2.1**

### Property 7: Step Outcome Recording

*For any* saga step execution or compensation, the outcome (success, failure, or compensation) should be recorded in the saga log with timestamp and attempt count.

**Validates: Requirements 2.2, 2.3**

### Property 8: Dual Storage Consistency

*For any* saga log created or updated, the changes should eventually appear in both IndexedDB (local) and PostgreSQL (server) storage.

**Validates: Requirements 2.4**

### Property 9: Saga Recovery

*For any* in-progress saga that exists in the saga log when the system restarts, the saga should be resumed from its last persisted step.

**Validates: Requirements 2.5**

### Property 10: Saga Query Correctness

*For any* saga log query with filters (tenant, type, status, date range), all returned results should match the specified filters.

**Validates: Requirements 2.6**

### Property 11: Event Emission for Saga Operations

*For any* saga step completion or compensation, the system should emit a standard PARK POS event with saga context (saga_id, step_name) included in the payload.

**Validates: Requirements 3.9, 7.1, 7.2, 7.3**

### Property 12: Offline Saga Execution

*For any* saga executed when the system is offline, the saga should execute entirely on the local terminal and queue all saga events for later synchronization.

**Validates: Requirements 6.1, 6.2**

### Property 13: Saga Event Synchronization

*For any* saga events queued while offline, when network connectivity returns, all events should be synchronized to the server in the order they were created.

**Validates: Requirements 6.3**

### Property 14: Outbox Pattern Integration

*For any* saga event emitted, the event should be published through the existing Outbox Pattern to ensure reliable delivery.

**Validates: Requirements 7.4**

### Property 15: Event Projection Compatibility

*For any* saga event emitted, the event should be processable by existing event projections and reducers without errors.

**Validates: Requirements 7.5**

### Property 16: Retry Behavior

*For any* saga step that fails with a transient error, the step should be retried up to the configured maximum attempts, and for permanent errors, rollback should begin immediately without retries.

**Validates: Requirements 8.1, 8.2**

### Property 17: Compensation Retry

*For any* compensating transaction that fails, the compensation should be retried up to the configured maximum attempts, and if all retries fail, the saga should be marked as requiring manual intervention.

**Validates: Requirements 8.3, 8.4**

### Property 18: Error Classification

*For any* error encountered during saga execution, the system should correctly classify it as either transient (retryable) or permanent (non-retryable) based on error type and code.

**Validates: Requirements 8.5**

## Error Handling

### Error Classification

The saga orchestrator classifies errors into two categories:

1. **Transient Errors** (retryable):
   - Network timeouts
   - Temporary service unavailability
   - Database connection errors
   - Rate limiting errors

2. **Permanent Errors** (non-retryable):
   - Validation failures
   - Insufficient funds
   - Authorization failures
   - Business rule violations

### Retry Strategy

```typescript
interface RetryStrategy {
  isRetryable(error: Error): boolean;
  shouldRetry(attempt: number, maxAttempts: number): boolean;
  getBackoffMs(attempt: number, baseMs: number, maxMs: number): number;
}

const defaultRetryStrategy: RetryStrategy = {
  isRetryable(error: Error): boolean {
    // Check error code or type
    if (error instanceof ValidationError) return false;
    if (error instanceof AuthorizationError) return false;
    if (error instanceof NetworkError) return true;
    if (error instanceof TimeoutError) return true;
    return false;
  },

  shouldRetry(attempt: number, maxAttempts: number): boolean {
    return attempt < maxAttempts;
  },

  getBackoffMs(attempt: number, baseMs: number, maxMs: number): number {
    const exponential = baseMs * Math.pow(2, attempt);
    const withJitter = exponential * (0.8 + Math.random() * 0.4);
    return Math.min(withJitter, maxMs);
  },
};
```

### Compensation Failure Handling

When a compensating transaction fails after all retries:

1. Saga status set to `REQUIRES_MANUAL_INTERVENTION`
2. Critical error logged with full context
3. Alert sent to monitoring system
4. Saga remains in database for manual review
5. Admin dashboard shows sagas requiring intervention

### Timeout Handling

```typescript
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError()), timeoutMs)
    ),
  ]);
}
```

## Testing Strategy

### Dual Testing Approach

The saga pattern implementation requires both unit tests and property-based tests:

- **Unit tests**: Verify specific saga scenarios, edge cases, and error conditions
- **Property tests**: Verify universal properties across all saga types and inputs

### Unit Testing Focus

Unit tests should cover:

1. **Specific Saga Scenarios**:
   - Complete Sale saga with all steps succeeding
   - Complete Sale saga failing at each step
   - Void Sale saga with authorization failure
   - Apply Promotion saga with eligibility failure

2. **Edge Cases**:
   - Saga with single step
   - Saga with no compensations needed
   - Saga timeout at different steps
   - Compensation failure requiring manual intervention

3. **Integration Points**:
   - Event emission through Outbox Pattern
   - Saga log persistence to IndexedDB and PostgreSQL
   - Event processing by existing reducers
   - Offline saga execution and sync

### Property-Based Testing Focus

Property tests should verify:

1. **Saga Execution Invariants**:
   - Sequential execution order (Property 1)
   - Complete compensation on failure (Property 2)
   - State persistence (Property 3)
   - Status correctness (Property 4)

2. **Saga Recovery Properties**:
   - Recovery from any step (Property 9)
   - Idempotent step execution
   - No duplicate compensations

3. **Event System Integration**:
   - Event emission (Property 11)
   - Event structure compliance (Property 15)
   - Outbox integration (Property 14)

4. **Error Handling Properties**:
   - Retry behavior (Property 16)
   - Compensation retry (Property 17)
   - Error classification (Property 18)

### Property Test Configuration

- Minimum 100 iterations per property test
- Each test tagged with: **Feature: saga-pattern, Property N: [property text]**
- Use fast-check or similar library for TypeScript
- Generate random saga definitions with varying:
  - Number of steps (1-10)
  - Step success/failure patterns
  - Error types (transient/permanent)
  - Timeout values

### Test Utilities

```typescript
// Test utility for creating mock saga steps
function createMockStep(
  name: string,
  shouldSucceed: boolean,
  isTransient: boolean = false
): SagaStep<any> {
  return {
    name,
    do: async () => {
      if (!shouldSucceed) {
        throw isTransient 
          ? new NetworkError('Transient failure')
          : new ValidationError('Permanent failure');
      }
      return { success: true };
    },
    undo: async () => {
      // Mock compensation
    },
    retryable: isTransient,
  };
}

// Test utility for verifying saga log state
async function verifySagaLog(
  sagaId: string,
  expectedStatus: SagaStatus,
  expectedStepCount: number
): Promise<void> {
  const log = await sagaLogRepo.getById(sagaId);
  expect(log).toBeDefined();
  expect(log!.status).toBe(expectedStatus);
  expect(log!.steps).toHaveLength(expectedStepCount);
}

// Test utility for simulating system restart
async function simulateRestart(): Promise<void> {
  // Clear in-memory state
  // Reload saga logs from persistence
  // Resume in-progress sagas
}
```

### Example Property Test

```typescript
import fc from 'fast-check';

describe('Saga Pattern Properties', () => {
  // Feature: saga-pattern, Property 1: Sequential Step Execution
  it('executes steps in sequential order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
        async (stepNames) => {
          const executionOrder: string[] = [];
          const steps = stepNames.map(name => ({
            name,
            do: async () => {
              executionOrder.push(name);
              return { success: true };
            },
            undo: async () => {},
          }));

          const saga: SagaDefinition<any> = {
            sagaType: 'TEST_SAGA',
            steps,
          };

          await orchestrator.execute(saga, {});

          // Verify execution order matches definition order
          expect(executionOrder).toEqual(stepNames);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: saga-pattern, Property 2: Complete Compensation on Failure
  it('compensates all completed steps in reverse order on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 1, max: 9 }),
        async (totalSteps, failAtStep) => {
          fc.pre(failAtStep < totalSteps); // Ensure failure is not at last step

          const compensationOrder: number[] = [];
          const steps = Array.from({ length: totalSteps }, (_, i) => ({
            name: `step_${i}`,
            do: async () => {
              if (i === failAtStep) {
                throw new Error('Step failed');
              }
              return { success: true };
            },
            undo: async () => {
              compensationOrder.push(i);
            },
          }));

          const saga: SagaDefinition<any> = {
            sagaType: 'TEST_SAGA',
            steps,
          };

          try {
            await orchestrator.execute(saga, {});
          } catch (error) {
            // Expected to fail
          }

          // Verify compensations executed in reverse order
          const expectedOrder = Array.from(
            { length: failAtStep },
            (_, i) => failAtStep - 1 - i
          );
          expect(compensationOrder).toEqual(expectedOrder);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```
