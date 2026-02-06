/**
 * Health Check API Endpoint
 * 
 * Provides system health status for monitoring and uptime checks.
 * Returns HTTP 200 if healthy, 503 if unhealthy.
 * 
 * @module api/health
 */

import { NextResponse } from 'next/server';
import { healthCheckService } from '@/src/core/health/health-check';
import { logger } from '@/src/core/observability/structured-logger';

/**
 * GET /api/health
 * 
 * Performs comprehensive health check of all system components.
 * 
 * Returns:
 * - 200 OK: System is healthy or degraded
 * - 503 Service Unavailable: System is unhealthy
 * 
 * Response includes:
 * - status: Overall system status (healthy, degraded, unhealthy)
 * - timestamp: ISO 8601 timestamp of health check
 * - components: Individual component health (database, redis, eventSourcing)
 * - responseTime: Total health check duration in milliseconds
 */
export async function GET() {
  try {
    // Perform health check
    const result = await healthCheckService.check();

    // Determine HTTP status code
    const statusCode = result.status === 'unhealthy' ? 503 : 200;

    // Log health check for monitoring
    if (result.status === 'unhealthy') {
      logger.warn('Health check returned unhealthy status', {
        status: result.status,
        responseTime: result.responseTime,
        databaseStatus: result.components.database.status,
        redisStatus: result.components.redis.status,
        eventSourcingStatus: result.components.eventSourcing.status,
      });
    }

    // Return health check result
    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    // Graceful degradation - return unhealthy status
    logger.error('Health check endpoint failed', error as Error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            responseTime: 0,
            message: 'Health check failed',
          },
          redis: {
            status: 'down',
            responseTime: 0,
            message: 'Health check failed',
          },
          eventSourcing: {
            status: 'down',
            responseTime: 0,
            message: 'Health check failed',
          },
        },
        responseTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  }
}

/**
 * HEAD /api/health
 * 
 * Lightweight health check that only returns status code.
 * Useful for uptime monitors that don't need response body.
 * 
 * Returns:
 * - 200 OK: System is healthy or degraded
 * - 503 Service Unavailable: System is unhealthy
 */
export async function HEAD() {
  try {
    const result = await healthCheckService.check();
    const statusCode = result.status === 'unhealthy' ? 503 : 200;

    return new NextResponse(null, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    logger.error('Health check HEAD endpoint failed', error as Error);

    return new NextResponse(null, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }
}
