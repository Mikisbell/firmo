/**
 * Result Pattern - Enterprise Error Handling
 * 
 * This implements the Result Pattern for type-safe error handling,
 * replacing thrown exceptions with explicit result types.
 * 
 * Benefits:
 * - Explicit error types in function signatures
 * - Type-safe error handling
 * - Better performance (no stack trace generation)
 * - Easier to test and compose
 * 
 * @module core/result
 */

export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Create a successful result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Map a successful result to a new value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * FlatMap (chain) operations on results
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.data);
  }
  return result;
}

/**
 * Unwrap a result or throw the error
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwrap a result or return a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.success) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Match a result with handlers for both cases
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (data: T) => U;
    err: (error: E) => U;
  }
): U {
  if (result.success) {
    return handlers.ok(result.data);
  }
  return handlers.err(result.error);
}

/**
 * Combine multiple results into one
 * Returns the first error if any, or array of all success values
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const data: T[] = [];
  
  for (const result of results) {
    if (!result.success) {
      return result;
    }
    data.push(result.data);
  }
  
  return ok(data);
}

/**
 * Try to execute a function and wrap the result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  onError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    const mappedError = onError ? onError(error) : (error as E);
    return err(mappedError);
  }
}

/**
 * Try to execute an async function and wrap the result
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => E
): AsyncResult<T, E> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    const mappedError = onError ? onError(error) : (error as E);
    return err(mappedError);
  }
}

// Domain-specific error types
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly field?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(
    resource: string,
    identifier?: string,
    context?: Record<string, unknown>
  ) {
    super(
      `${resource} not found${identifier ? `: ${identifier}` : ''}`,
      'NOT_FOUND',
      context
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    public readonly conflictingField?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT', context);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(
    message = 'Unauthorized',
    context?: Record<string, unknown>
  ) {
    super(message, 'UNAUTHORIZED', context);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends DomainError {
  constructor(
    message = 'Forbidden',
    context?: Record<string, unknown>
  ) {
    super(message, 'FORBIDDEN', context);
    this.name = 'ForbiddenError';
  }
}
