/**
 * Saga Pattern Types
 * 
 * Core types and interfaces for saga orchestration in PARK POS.
 * Integrates with Event Sourcing system for reliable distributed transactions.
 */

export type SagaStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'FAILED';

export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';

/**
 * Saga Step Definition
 * Each step has a forward action (do) and a compensating action (undo)
 */
export interface SagaStep<TContext = any, TResult = any> {
  name: string;
  do: (context: TContext) => Promise<TResult>;
  undo: (context: TContext, result?: TResult) => Promise<void>;
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number; // milliseconds
}

/**
 * Saga Definition
 * Defines a complete saga with all its steps
 */
export interface SagaDefinition<TContext = any> {
  name: string;
  steps: SagaStep<TContext>[];
  timeout?: number; // milliseconds
}

/**
 * Saga Execution Context
 * Shared context passed through all saga steps
 */
export interface SagaContext {
  sagaId: string;
  tenantId: string;
  terminalId?: string;
  userId?: string;
  startedAt: Date;
  [key: string]: any;
}

/**
 * Saga Step Result
 * Result of executing a single saga step
 */
export interface SagaStepResult {
  stepName: string;
  status: StepStatus;
  result?: any;
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
  attempts: number;
}

/**
 * Saga Execution Result
 * Final result of saga execution
 */
export interface SagaExecutionResult {
  sagaId: string;
  status: SagaStatus;
  steps: SagaStepResult[];
  startedAt: Date;
  completedAt?: Date;
  error?: Error;
}

/**
 * Saga Log Entry
 * Persistent record of saga execution for recovery
 */
export interface SagaLogEntry {
  sagaId: string;
  tenantId: string;
  sagaName: string;
  status: SagaStatus;
  context: SagaContext;
  steps: SagaStepResult[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Error types for saga execution
 */
export class SagaError extends Error {
  constructor(
    message: string,
    public readonly sagaId: string,
    public readonly stepName?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SagaError';
  }
}

export class SagaTimeoutError extends SagaError {
  constructor(sagaId: string, stepName?: string) {
    super(`Saga timeout${stepName ? ` at step ${stepName}` : ''}`, sagaId, stepName);
    this.name = 'SagaTimeoutError';
  }
}

export class SagaCompensationError extends SagaError {
  constructor(sagaId: string, stepName: string, originalError: Error) {
    super(`Compensation failed for step ${stepName}`, sagaId, stepName, originalError);
    this.name = 'SagaCompensationError';
  }
}
