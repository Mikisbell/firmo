/**
 * PARK POS Structured Logger - Production Grade
 * 
 * Implements comprehensive structured logging with:
 * - Pino for high-performance JSON logging
 * - Logtail integration for production log aggregation
 * - Sensitive data redaction (PINs, tokens, payment details)
 * - Graceful degradation (never blocks application)
 * - Environment-aware formatting (JSON in prod, pretty in dev)
 * - Request correlation tracking
 * 
 * @module core/observability/structured-logger
 */

import pino from 'pino';
import { trace, context as otelContext } from '@opentelemetry/api';

/**
 * Log context interface
 * Contains metadata attached to log entries
 */
export interface LogContext {
  tenantId?: string;
  terminalId?: string;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  orderId?: string;
  eventType?: string;
  [key: string]: unknown;
}

/**
 * Logger interface
 * Defines the contract for all logger implementations
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  fatal(message: string, error: Error, context?: LogContext): void;
  child(context: LogContext): Logger;
}

/**
 * Sensitive field patterns to redact
 * These patterns match field names that contain sensitive data
 */
const SENSITIVE_PATTERNS = [
  /pin/i,
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /cookie/i,
  /credit.*card/i,
  /cvv/i,
  /ssn/i,
  /tax.*id/i,
];

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Redact sensitive data from an object
 * Recursively walks the object and replaces sensitive values with '[REDACTED]'
 */
function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Logtail transport configuration
 * Only used in production when LOGTAIL_SOURCE_TOKEN is set
 */
function getLogtailTransport() {
  const sourceToken = process.env.LOGTAIL_SOURCE_TOKEN;
  
  if (!sourceToken || process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  // Logtail transport configuration
  // Uses pino-logtail for seamless integration
  return {
    target: '@logtail/pino',
    options: {
      sourceToken,
    },
  };
}

/**
 * Get Pino transport configuration based on environment
 */
function getTransport() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  // In test, use minimal logging
  if (isTest) {
    return undefined;
  }

  // In development, use pretty printing
  if (isDevelopment) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  // In production, try Logtail first, fallback to JSON
  const logtailTransport = getLogtailTransport();
  return logtailTransport;
}

/**
 * Create base Pino logger instance
 */
function createPinoLogger(serviceName: string) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isTest = process.env.NODE_ENV === 'test';

  return pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    
    // Base fields included in every log
    base: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    },

    // Timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,

    // Inject OpenTelemetry trace context into every log entry
    mixin() {
      const span = trace.getSpan(otelContext.active());
      if (span) {
        const spanContext = span.spanContext();
        return {
          trace_id: spanContext.traceId,
          span_id: spanContext.spanId,
          trace_flags: spanContext.traceFlags,
        };
      }
      return {};
    },

    // Formatters
    formatters: {
      level: (label) => ({ level: label }),
      
      // Redact sensitive data from log objects
      log: (obj) => redactSensitiveData(obj),
    },

    // Transport configuration
    transport: getTransport(),

    // Disable in test to reduce noise
    enabled: !isTest || process.env.LOG_LEVEL === 'debug',
  });
}

/**
 * Structured Logger Implementation
 * 
 * Production-grade logger with:
 * - High-performance JSON logging via Pino
 * - Automatic sensitive data redaction
 * - Logtail integration for production
 * - Graceful error handling
 * - Child logger support for context inheritance
 */
export class StructuredLogger implements Logger {
  private pinoLogger: pino.Logger;
  private serviceName: string;
  private environment: string;

  constructor(serviceName: string = 'park-pos') {
    this.serviceName = serviceName;
    this.environment = process.env.NODE_ENV || 'development';
    
    try {
      this.pinoLogger = createPinoLogger(serviceName);
    } catch (error) {
      // Fallback to console if Pino initialization fails
      console.error('Failed to initialize Pino logger, falling back to console:', error);
      this.pinoLogger = this.createFallbackLogger();
    }
  }

  /**
   * Create a fallback logger using console
   * Used when Pino initialization fails
   */
  private createFallbackLogger(): any {
    const fallback = {
      debug: (obj: any, msg?: string) => console.debug(msg || '', obj),
      info: (obj: any, msg?: string) => console.log(msg || '', obj),
      warn: (obj: any, msg?: string) => console.warn(msg || '', obj),
      error: (obj: any, msg?: string) => console.error(msg || '', obj),
      fatal: (obj: any, msg?: string) => console.error('[FATAL]', msg || '', obj),
      child: (context: any) => fallback,
    };
    return fallback;
  }

  /**
   * Log at DEBUG level
   * Use for detailed diagnostic information
   */
  debug(message: string, context?: LogContext): void {
    try {
      this.pinoLogger.debug(context || {}, message);
    } catch (error) {
      // Graceful degradation - never throw
      console.debug(message, context);
    }
  }

  /**
   * Log at INFO level
   * Use for general informational messages
   */
  info(message: string, context?: LogContext): void {
    try {
      this.pinoLogger.info(context || {}, message);
    } catch (error) {
      // Graceful degradation - never throw
      console.log(message, context);
    }
  }

  /**
   * Log at WARN level
   * Use for warning messages that don't prevent operation
   */
  warn(message: string, context?: LogContext): void {
    try {
      this.pinoLogger.warn(context || {}, message);
    } catch (error) {
      // Graceful degradation - never throw
      console.warn(message, context);
    }
  }

  /**
   * Log at ERROR level
   * Use for error conditions that need attention
   */
  error(message: string, error: Error, context?: LogContext): void {
    try {
      this.pinoLogger.error(
        {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        message
      );
    } catch (err) {
      // Graceful degradation - never throw
      console.error(message, error, context);
    }
  }

  /**
   * Log at FATAL level
   * Use for critical errors that may cause system failure
   */
  fatal(message: string, error: Error, context?: LogContext): void {
    try {
      this.pinoLogger.fatal(
        {
          ...context,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        },
        message
      );
    } catch (err) {
      // Graceful degradation - never throw
      console.error('[FATAL]', message, error, context);
    }
  }

  /**
   * Create a child logger with preset context
   * Child loggers inherit parent context and add their own
   */
  child(context: LogContext): Logger {
    try {
      const childPinoLogger = this.pinoLogger.child(context);
      
      // Create a new StructuredLogger instance with the child logger
      const childLogger = new StructuredLogger(this.serviceName);
      childLogger.pinoLogger = childPinoLogger;
      
      return childLogger;
    } catch (error) {
      // Graceful degradation - return self if child creation fails
      console.error('Failed to create child logger:', error);
      return this;
    }
  }
}

/**
 * Singleton logger instance
 * Use this for application-wide logging
 */
export const logger = new StructuredLogger('park-pos');

/**
 * Create a logger for a specific service/module
 * Useful for creating domain-specific loggers
 */
export function createLogger(serviceName: string): Logger {
  return new StructuredLogger(serviceName);
}

/**
 * Create a request-scoped logger with correlation ID
 * Use this in API handlers to track requests across services
 */
export function createRequestLogger(
  requestId: string,
  additionalContext?: LogContext
): Logger {
  return logger.child({
    requestId,
    correlationId: requestId,
    ...additionalContext,
  });
}
