/**
 * Property-Based Tests for Error Tracker
 * 
 * Tests universal properties that should hold for all error tracking operations.
 * Uses fast-check for property-based testing with randomized inputs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  MockSentryErrorTracker,
  type ErrorContext,
  type Breadcrumb,
  type UserContext,
} from '../error-tracker';
import { logger } from '../structured-logger';

// Mock the logger to prevent actual logging during tests
vi.mock('../structured-logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

describe('Error Tracker - Property-Based Tests', () => {
  let errorTracker: MockSentryErrorTracker;

  beforeEach(() => {
    errorTracker = new MockSentryErrorTracker();
    vi.clearAllMocks();
  });

  /**
   * Property 4: Error Capture Completeness
   * 
   * For any unhandled exception thrown in the application, the Error_Tracker
   * SHALL capture the exception with full context (tenantId, terminalId, userId, stack trace).
   * 
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 4: Error Capture Completeness', () => {
    it('should capture all exceptions with full context', () => {
      fc.assert(
        fc.property(
          // Generate random errors
          fc.record({
            name: fc.constantFrom('Error', 'TypeError', 'ReferenceError', 'RangeError'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          // Generate random context
          fc.record({
            tenantId: fc.uuid(),
            terminalId: fc.uuid(),
            userId: fc.uuid(),
            tags: fc.dictionary(fc.string(), fc.string()),
            extra: fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
          }),
          (errorData, context) => {
            // Create error with stack trace
            const error = new Error(errorData.message);
            error.name = errorData.name;
            Error.captureStackTrace(error);

            // Capture the exception
            errorTracker.captureException(error, context);

            // Verify logger.error was called
            expect(logger.error).toHaveBeenCalled();

            // Get the call arguments
            const calls = (logger.error as any).mock.calls;
            expect(calls.length).toBeGreaterThan(0);

            const [message, capturedError, capturedContext] = calls[calls.length - 1];

            // Verify message
            expect(message).toBe('Exception captured');

            // Verify error object
            expect(capturedError).toBeDefined();
            expect(capturedError.name).toBe(errorData.name);
            expect(capturedError.message).toBe(errorData.message);
            expect(capturedError.stack).toBeDefined();

            // Verify context is preserved
            expect(capturedContext).toBeDefined();
            expect(capturedContext.tenantId).toBe(context.tenantId);
            expect(capturedContext.terminalId).toBe(context.terminalId);
            expect(capturedContext.userId).toBe(context.userId);
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('should capture exceptions without context', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.constantFrom('Error', 'TypeError', 'ReferenceError'),
            message: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          (errorData) => {
            const error = new Error(errorData.message);
            error.name = errorData.name;
            Error.captureStackTrace(error);

            // Capture without context
            errorTracker.captureException(error);

            // Verify logger.error was called
            expect(logger.error).toHaveBeenCalled();

            const calls = (logger.error as any).mock.calls;
            const [message, capturedError] = calls[calls.length - 1];

            expect(message).toBe('Exception captured');
            expect(capturedError).toBeDefined();
            expect(capturedError.name).toBe(errorData.name);
            expect(capturedError.message).toBe(errorData.message);
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });

    it('should filter non-critical errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Validation failed: invalid input',
            'Request timeout after 3000ms',
            'Resource not found: 404',
            'Network timeout: 2s'
          ),
          (errorMessage) => {
            const error = new Error(errorMessage);

            // Clear previous calls
            vi.clearAllMocks();

            // Capture the exception
            errorTracker.captureException(error);

            // Verify logger.error was NOT called (filtered)
            expect(logger.error).not.toHaveBeenCalledWith(
              'Exception captured',
              expect.anything(),
              expect.anything()
            );

            // Verify logger.debug was called instead
            expect(logger.debug).toHaveBeenCalledWith(
              'Filtered non-critical error',
              expect.objectContaining({
                errorMessage,
              })
            );
          }
        ),
        {
          numRuns: 20,
          verbose: false,
        }
      );
    });
  });

  /**
   * Property 25: Error Context Preservation
   * 
   * For any error captured by the Error_Tracker, all context fields provided
   * at capture time SHALL be preserved and available in the error report.
   * 
   * Validates: Requirements 2.2
   */
  describe('Property 25: Error Context Preservation', () => {
    it('should preserve all context fields in error reports', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            tenantId: fc.uuid(),
            terminalId: fc.uuid(),
            userId: fc.uuid(),
            tags: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 50 }),
              { minKeys: 1, maxKeys: 5 }
            ),
            extra: fc.dictionary(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.integer({ min: 0, max: 10000 }),
                fc.boolean()
              ),
              { minKeys: 1, maxKeys: 5 }
            ),
          }),
          (errorMessage, context) => {
            const error = new Error(errorMessage);

            // Capture with context
            errorTracker.captureException(error, context);

            // Get the logged context
            const calls = (logger.error as any).mock.calls;
            const [, , capturedContext] = calls[calls.length - 1];

            // Verify all context fields are preserved
            expect(capturedContext.tenantId).toBe(context.tenantId);
            expect(capturedContext.terminalId).toBe(context.terminalId);
            expect(capturedContext.userId).toBe(context.userId);

            // Verify tags are preserved (may be filtered for sensitive data)
            if (context.tags) {
              expect(capturedContext.tags).toBeDefined();
            }

            // Verify extra data is preserved (may be filtered for sensitive data)
            if (context.extra) {
              expect(capturedContext.extra).toBeDefined();
            }
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('should preserve context across multiple error captures', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              message: fc.string({ minLength: 1, maxLength: 100 }),
              context: fc.record({
                tenantId: fc.uuid(),
                terminalId: fc.uuid(),
                userId: fc.uuid(),
              }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (errors) => {
            // Capture multiple errors
            errors.forEach(({ message, context }) => {
              const error = new Error(message);
              errorTracker.captureException(error, context);
            });

            // Verify all errors were captured with their contexts
            const calls = (logger.error as any).mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(errors.length);

            // Check last N calls match our errors
            const lastCalls = calls.slice(-errors.length);
            lastCalls.forEach((call: any, index: number) => {
              const [, capturedError, capturedContext] = call;
              const expectedError = errors[index];

              expect(capturedError.message).toBe(expectedError.message);
              expect(capturedContext.tenantId).toBe(expectedError.context.tenantId);
              expect(capturedContext.terminalId).toBe(expectedError.context.terminalId);
              expect(capturedContext.userId).toBe(expectedError.context.userId);
            });
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });
  });

  /**
   * Additional Property: Sensitive Data Filtering
   * 
   * For any error captured with sensitive data in context, the Error_Tracker
   * SHALL filter out sensitive fields (authorization, cookie, pin, password, token).
   */
  describe('Property: Sensitive Data Filtering', () => {
    it('should filter sensitive fields from error context', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            tenantId: fc.uuid(),
            authorization: fc.string(),
            cookie: fc.string(),
            pin: fc.string(),
            password: fc.string(),
            token: fc.string(),
            normalField: fc.string(),
          }),
          (errorMessage, context) => {
            const error = new Error(errorMessage);

            // Capture with sensitive context
            errorTracker.captureException(error, context as any);

            // Get the logged context
            const calls = (logger.error as any).mock.calls;
            const [, , capturedContext] = calls[calls.length - 1];

            // Verify sensitive fields are redacted
            expect(capturedContext.authorization).toBe('[REDACTED]');
            expect(capturedContext.cookie).toBe('[REDACTED]');
            expect(capturedContext.pin).toBe('[REDACTED]');
            expect(capturedContext.password).toBe('[REDACTED]');
            expect(capturedContext.token).toBe('[REDACTED]');

            // Verify normal fields are preserved
            expect(capturedContext.normalField).toBe(context.normalField);
            expect(capturedContext.tenantId).toBe(context.tenantId);
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });
  });

  /**
   * Additional Property: Breadcrumb Tracking
   * 
   * For any breadcrumb added, the Error_Tracker SHALL store it and include
   * it in subsequent error reports.
   */
  describe('Property: Breadcrumb Tracking', () => {
    it('should track breadcrumbs and include them in error reports', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              message: fc.string({ minLength: 1, maxLength: 100 }),
              category: fc.constantFrom('business', 'api', 'sync', 'payment', 'order'),
              level: fc.constantFrom('debug', 'info', 'warning', 'error'),
              data: fc.dictionary(fc.string(), fc.string()),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.string({ minLength: 1, maxLength: 100 }),
          (breadcrumbs, errorMessage) => {
            // Add breadcrumbs
            breadcrumbs.forEach((breadcrumb) => {
              errorTracker.addBreadcrumb(breadcrumb as Breadcrumb);
            });

            // Capture an error
            const error = new Error(errorMessage);
            errorTracker.captureException(error);

            // Get the logged context
            const calls = (logger.error as any).mock.calls;
            const [, , capturedContext] = calls[calls.length - 1];

            // Verify breadcrumbs are included (last 10)
            expect(capturedContext.breadcrumbs).toBeDefined();
            expect(Array.isArray(capturedContext.breadcrumbs)).toBe(true);
            expect(capturedContext.breadcrumbs.length).toBeGreaterThan(0);
            expect(capturedContext.breadcrumbs.length).toBeLessThanOrEqual(10);
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });
  });

  /**
   * Additional Property: User Context Tracking
   * 
   * For any user context set, the Error_Tracker SHALL include it in
   * subsequent error reports.
   */
  describe('Property: User Context Tracking', () => {
    it('should track user context and include it in error reports', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            username: fc.string({ minLength: 3, maxLength: 20 }),
          }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (user, errorMessage) => {
            // Set user context
            errorTracker.setUser(user as UserContext);

            // Capture an error
            const error = new Error(errorMessage);
            errorTracker.captureException(error);

            // Get the logged context
            const calls = (logger.error as any).mock.calls;
            const [, , capturedContext] = calls[calls.length - 1];

            // Verify user context is included
            expect(capturedContext.user).toBeDefined();
            expect(capturedContext.user.id).toBe(user.id);
          }
        ),
        {
          numRuns: 50,
          verbose: false,
        }
      );
    });
  });

  /**
   * Additional Property: Graceful Degradation
   * 
   * For any error in the error tracking system itself, the Error_Tracker
   * SHALL NOT throw exceptions and SHALL continue functioning.
   */
  describe('Property: Graceful Degradation', () => {
    it('should not throw when capturing malformed errors', () => {
      fc.assert(
        fc.property(
          fc.anything(),
          (malformedError) => {
            // This should not throw
            expect(() => {
              errorTracker.captureException(malformedError as any);
            }).not.toThrow();
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });

    it('should not throw when capturing messages with malformed context', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.constantFrom('info', 'warning', 'error'),
          fc.anything(),
          (message, level, malformedContext) => {
            // This should not throw
            expect(() => {
              errorTracker.captureMessage(message, level, malformedContext as any);
            }).not.toThrow();
          }
        ),
        {
          numRuns: 100,
          verbose: false,
        }
      );
    });
  });
});
