/**
 * Enhanced Logger with Pino
 * Production-grade structured logging with performance optimizations
 * 
 * Features:
 * - JSON structured logs
 * - Request ID tracking
 * - Performance monitoring
 * - Pretty printing in development
 * - Compatible with existing logger interface
 */

import pino from 'pino';
import type { LogContext } from './logger';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Base Pino logger instance
 * Disabled in development to avoid worker thread issues in Next.js
 */
const pinoLogger = isDevelopment
  ? {
      // Simple console logger for development
      debug: (obj: any, msg?: string) => {
        if (process.env.LOG_LEVEL === 'debug') {
          console.log('[DEBUG]', msg || '', obj);
        }
      },
      info: (obj: any, msg?: string) => console.log('[INFO]', msg || '', obj),
      warn: (obj: any, msg?: string) => console.warn('[WARN]', msg || '', obj),
      error: (obj: any, msg?: string) => console.error('[ERROR]', msg || '', obj),
      child: (context: any) => ({
        debug: (obj: any, msg?: string) => {
          if (process.env.LOG_LEVEL === 'debug') {
            console.log('[DEBUG]', msg || '', { ...context, ...obj });
          }
        },
        info: (obj: any, msg?: string) => console.log('[INFO]', msg || '', { ...context, ...obj }),
        warn: (obj: any, msg?: string) => console.warn('[WARN]', msg || '', { ...context, ...obj }),
        error: (obj: any, msg?: string) => console.error('[ERROR]', msg || '', { ...context, ...obj }),
      }),
    }
  : pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: undefined,
      formatters: {
        level: (label) => ({ level: label }),
      },
      base: {
        env: process.env.NODE_ENV,
        service: 'park-pos-admin',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });

/**
 * Enhanced logger compatible with existing interface
 */
export const enhancedLogger = {
  debug(event: string, message: string, context?: LogContext): void {
    pinoLogger.debug({ event, ...context }, message);
  },
  
  info(event: string, message: string, context?: LogContext): void {
    pinoLogger.info({ event, ...context }, message);
  },
  
  warn(event: string, message: string, context?: LogContext): void {
    pinoLogger.warn({ event, ...context }, message);
  },
  
  error(event: string, message: string, error?: Error, context?: LogContext): void {
    if (error) {
      pinoLogger.error(
        { 
          event, 
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          ...context 
        }, 
        message
      );
    } else {
      pinoLogger.error({ event, ...context }, message);
    }
  },
  
  /**
   * Create a child logger with preset context
   */
  child(baseContext: LogContext) {
    const childLogger = pinoLogger.child(baseContext);
    
    return {
      debug: (event: string, message: string, context?: LogContext) =>
        childLogger.debug({ event, ...context }, message),
      info: (event: string, message: string, context?: LogContext) =>
        childLogger.info({ event, ...context }, message),
      warn: (event: string, message: string, context?: LogContext) =>
        childLogger.warn({ event, ...context }, message),
      error: (event: string, message: string, error?: Error, context?: LogContext) => {
        if (error) {
          childLogger.error(
            { 
              event, 
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
              ...context 
            }, 
            message
          );
        } else {
          childLogger.error({ event, ...context }, message);
        }
      },
    };
  },
};

/**
 * Create a request logger with request ID
 */
export function createRequestLogger(
  requestId: string,
  userId?: string,
  additionalContext?: Record<string, any>
) {
  return pinoLogger.child({
    requestId,
    userId,
    ...additionalContext,
  });
}

/**
 * Log performance metrics
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  metadata?: Record<string, any>
) {
  pinoLogger.info({
    type: 'performance',
    operation,
    durationMs,
    ...metadata,
  }, `Performance: ${operation} took ${durationMs}ms`);
}

/**
 * Log audit event
 */
export function logAudit(
  action: string,
  resource: string,
  userId: string,
  metadata?: Record<string, any>
) {
  pinoLogger.info({
    type: 'audit',
    action,
    resource,
    userId,
    timestamp: new Date().toISOString(),
    ...metadata,
  }, `Audit: ${action} on ${resource} by ${userId}`);
}

// Export raw pino logger for advanced use cases
export { pinoLogger };
