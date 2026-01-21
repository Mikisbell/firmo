/**
 * Saga Error Classification System
 * 
 * Classifies errors as transient (retryable) or permanent (non-retryable)
 * to enable intelligent retry behavior in saga execution.
 */

/**
 * Base error types for saga execution
 */

/** Validation errors - permanent, not retryable */
export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Authorization errors - permanent, not retryable */
export class AuthorizationError extends Error {
  constructor(message: string, public readonly requiredRole?: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/** Business rule violation errors - permanent, not retryable */
export class BusinessRuleError extends Error {
  constructor(message: string, public readonly rule?: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

/** Insufficient funds errors - permanent, not retryable */
export class InsufficientFundsError extends Error {
  constructor(message: string, public readonly required?: number, public readonly available?: number) {
    super(message);
    this.name = 'InsufficientFundsError';
  }
}

/** Network errors - transient, retryable */
export class NetworkError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** Timeout errors - transient, retryable */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs?: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Database connection errors - transient, retryable */
export class DatabaseError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/** Rate limiting errors - transient, retryable */
export class RateLimitError extends Error {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Service unavailable errors - transient, retryable */
export class ServiceUnavailableError extends Error {
  constructor(message: string, public readonly service?: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

/**
 * Error classification interface
 */
export interface ErrorClassifier {
  /**
   * Determine if an error is retryable (transient) or not (permanent)
   */
  isRetryable(error: Error): boolean;

  /**
   * Get error category for logging and monitoring
   */
  getCategory(error: Error): 'transient' | 'permanent' | 'unknown';
}

/**
 * Default error classifier implementation
 */
export class DefaultErrorClassifier implements ErrorClassifier {
  /**
   * Classify error as retryable or not
   */
  isRetryable(error: Error): boolean {
    // Transient errors (retryable)
    if (error instanceof NetworkError) return true;
    if (error instanceof TimeoutError) return true;
    if (error instanceof DatabaseError) return true;
    if (error instanceof RateLimitError) return true;
    if (error instanceof ServiceUnavailableError) return true;

    // Permanent errors (not retryable)
    if (error instanceof ValidationError) return false;
    if (error instanceof AuthorizationError) return false;
    if (error instanceof BusinessRuleError) return false;
    if (error instanceof InsufficientFundsError) return false;

    // Check error message for common patterns
    const message = error.message.toLowerCase();
    
    // Transient patterns
    if (message.includes('timeout')) return true;
    if (message.includes('network')) return true;
    if (message.includes('connection')) return true;
    if (message.includes('unavailable')) return true;
    if (message.includes('rate limit')) return true;
    if (message.includes('too many requests')) return true;
    
    // Permanent patterns
    if (message.includes('validation')) return false;
    if (message.includes('invalid')) return false;
    if (message.includes('unauthorized')) return false;
    if (message.includes('forbidden')) return false;
    if (message.includes('insufficient')) return false;
    if (message.includes('not found')) return false;

    // Default to non-retryable for safety
    return false;
  }

  /**
   * Get error category
   */
  getCategory(error: Error): 'transient' | 'permanent' | 'unknown' {
    // Transient errors
    if (error instanceof NetworkError) return 'transient';
    if (error instanceof TimeoutError) return 'transient';
    if (error instanceof DatabaseError) return 'transient';
    if (error instanceof RateLimitError) return 'transient';
    if (error instanceof ServiceUnavailableError) return 'transient';

    // Permanent errors
    if (error instanceof ValidationError) return 'permanent';
    if (error instanceof AuthorizationError) return 'permanent';
    if (error instanceof BusinessRuleError) return 'permanent';
    if (error instanceof InsufficientFundsError) return 'permanent';

    // Check message patterns
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || 
        message.includes('network') || 
        message.includes('connection') ||
        message.includes('unavailable') ||
        message.includes('rate limit')) {
      return 'transient';
    }
    
    if (message.includes('validation') || 
        message.includes('invalid') || 
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('insufficient')) {
      return 'permanent';
    }

    return 'unknown';
  }
}

/**
 * Singleton instance of error classifier
 */
export const errorClassifier = new DefaultErrorClassifier();
