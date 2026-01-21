/**
 * Request Logger Middleware
 * Logs all API requests with structured data
 * 
 * Features:
 * - Request ID generation
 * - Performance tracking
 * - Error logging
 * - User context
 * - Metrics collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRequestLogger } from '@/src/core/observability/logger-pino';
import { metricsHelpers } from '@/src/core/observability/metrics';
import { randomUUID } from 'crypto';

/**
 * Wrap an API handler with request logging
 * 
 * @param handler - The API route handler
 * @returns Wrapped handler with logging
 * 
 * @example
 * export const GET = withRequestLogging(async (request) => {
 *   // Your handler code
 * });
 */
export function withRequestLogging(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const requestId = randomUUID();
    const startTime = Date.now();
    
    // Extract user info from headers (set by middleware)
    const userId = request.headers.get('x-user-id') || undefined;
    const userRole = request.headers.get('x-user-role') || undefined;
    
    const pathname = new URL(request.url).pathname;
    const method = request.method;
    
    const log = createRequestLogger(requestId, userId, {
      userRole,
      method,
      url: request.url,
      pathname,
    });
    
    log.info({
      type: 'request_start',
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    }, 'Request started');
    
    try {
      const response = await handler(request);
      
      const duration = Date.now() - startTime;
      const status = response.status;
      
      // Record metrics
      metricsHelpers.recordHttpRequest(method, pathname, status, duration);
      
      log.info({
        type: 'request_complete',
        status,
        durationMs: duration,
      }, `Request completed in ${duration}ms`);
      
      // Add request ID to response headers
      response.headers.set('X-Request-ID', requestId);
      
      // Log slow requests
      if (duration > 1000) {
        log.warn({
          type: 'slow_request',
          durationMs: duration,
        }, `Slow request detected: ${duration}ms`);
      }
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metric
      metricsHelpers.recordApiError(pathname, error instanceof Error ? error.name : 'Unknown');
      
      log.error({
        type: 'request_error',
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : String(error),
        durationMs: duration,
      }, 'Request failed');
      
      throw error;
    }
  };
}

/**
 * Extract request context for logging
 */
export function getRequestContext(request: NextRequest) {
  return {
    method: request.method,
    url: request.url,
    pathname: new URL(request.url).pathname,
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    userId: request.headers.get('x-user-id'),
    userRole: request.headers.get('x-user-role'),
    tenantId: request.headers.get('x-tenant-id'),
  };
}
