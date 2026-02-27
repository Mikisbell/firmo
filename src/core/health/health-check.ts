/**
 * PARK POS Health Check Service - Production Grade
 * 
 * Implements comprehensive health checking with:
 * - Database connectivity check (PostgreSQL via Prisma)
 * - Redis connectivity check (Upstash)
 * - Event sourcing health check
 * - Component response time tracking
 * - Overall system status calculation
 * - Graceful degradation (never blocks application)
 * 
 * @module core/health/health-check
 */

import { PrismaClient } from '@prisma/client';
import prismaSingleton from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { cache } from '@/src/core/cache/cache-service';

/**
 * Component health status
 */
export type ComponentStatus = 'up' | 'down' | 'degraded';

/**
 * Overall system health status
 */
export type SystemStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health details
 */
export interface ComponentHealth {
  status: ComponentStatus;
  responseTime: number; // milliseconds
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: SystemStatus;
  timestamp: string;
  components: {
    database: ComponentHealth;
    redis: ComponentHealth;
    eventSourcing: ComponentHealth;
  };
  responseTime: number; // milliseconds
}

/**
 * Health Check Service
 * 
 * Provides comprehensive health checking for all system components.
 * Designed to complete within 2 seconds and never throw errors.
 */
export class HealthCheckService {
  private prisma: PrismaClient;
  private readonly timeout = 2000; // 2 seconds max response time

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || prismaSingleton;
  }

  /**
   * Perform complete health check
   * Returns health status for all components
   */
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Run all health checks in parallel with timeout
      const [database, redis, eventSourcing] = await Promise.all([
        this.checkDatabaseWithTimeout(),
        this.checkRedisWithTimeout(),
        this.checkEventSourcingWithTimeout(),
      ]);

      const responseTime = Date.now() - startTime;

      // Calculate overall system status
      const status = this.calculateSystemStatus(database, redis, eventSourcing);

      const result: HealthCheckResult = {
        status,
        timestamp: new Date().toISOString(),
        components: {
          database,
          redis,
          eventSourcing,
        },
        responseTime,
      };

      // Log health check result
      logger.info('Health check completed', {
        status,
        responseTime,
        databaseStatus: database.status,
        redisStatus: redis.status,
        eventSourcingStatus: eventSourcing.status,
      });

      // Emit metrics
      metrics.gauge('health.status', this.statusToNumber(status));
      metrics.gauge('health.database.status', this.componentStatusToNumber(database.status));
      metrics.gauge('health.redis.status', this.componentStatusToNumber(redis.status));
      metrics.gauge('health.event_sourcing.status', this.componentStatusToNumber(eventSourcing.status));
      metrics.histogram('health.response_time', responseTime);

      return result;
    } catch (error) {
      // Graceful degradation - return unhealthy status
      logger.error('Health check failed', error as Error);

      const responseTime = Date.now() - startTime;

      return {
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
        responseTime,
      };
    }
  }

  /**
   * Check database connectivity with timeout
   */
  private async checkDatabaseWithTimeout(): Promise<ComponentHealth> {
    return this.withTimeout(
      this.checkDatabase(),
      this.timeout,
      'Database check timed out'
    );
  }

  /**
   * Check Redis connectivity with timeout
   */
  private async checkRedisWithTimeout(): Promise<ComponentHealth> {
    return this.withTimeout(
      this.checkRedis(),
      this.timeout,
      'Redis check timed out'
    );
  }

  /**
   * Check event sourcing health with timeout
   */
  private async checkEventSourcingWithTimeout(): Promise<ComponentHealth> {
    return this.withTimeout(
      this.checkEventSourcing(),
      this.timeout,
      'Event sourcing check timed out'
    );
  }

  /**
   * Check database connectivity
   * Performs a simple query to verify connection
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Simple query to check database connectivity
      await this.prisma.$queryRaw`SELECT 1 as health_check`;

      const responseTime = Date.now() - startTime;

      return {
        status: 'up',
        responseTime,
        message: 'Database connection successful',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Database health check failed', error as Error);

      return {
        status: 'down',
        responseTime,
        message: error instanceof Error ? error.message : 'Database connection failed',
        details: {
          error: error instanceof Error ? error.name : 'Unknown error',
        },
      };
    }
  }

  /**
   * Check Redis connectivity
   * Performs a simple get/set operation to verify connection
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Check if cache is available
      if (!cache.isAvailable()) {
        return {
          status: 'degraded',
          responseTime: Date.now() - startTime,
          message: 'Redis not configured, using in-memory cache',
          details: {
            cacheType: cache.getType(),
          },
        };
      }

      // Perform a simple get/set operation
      const testKey = 'health:check';
      const testValue = Date.now().toString();

      await cache.set(testKey, testValue, { ttl: 10 });
      const retrieved = await cache.get<string>(testKey);

      const responseTime = Date.now() - startTime;

      if (retrieved === testValue) {
        return {
          status: 'up',
          responseTime,
          message: 'Redis connection successful',
          details: {
            cacheType: cache.getType(),
          },
        };
      } else {
        return {
          status: 'degraded',
          responseTime,
          message: 'Redis read/write mismatch',
          details: {
            cacheType: cache.getType(),
            expected: testValue,
            received: retrieved,
          },
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Redis health check failed', error as Error);

      return {
        status: 'degraded',
        responseTime,
        message: 'Redis connection failed, using fallback',
        details: {
          error: error instanceof Error ? error.name : 'Unknown error',
          cacheType: cache.getType(),
        },
      };
    }
  }

  /**
   * Check event sourcing health
   * Verifies that event tables are accessible and recent events exist
   */
  private async checkEventSourcing(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // Check if events table is accessible
      const recentEvents = await this.prisma.events.count({
        where: {
          occurred_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      const responseTime = Date.now() - startTime;

      // Check if we have recent events (system is active)
      if (recentEvents > 0) {
        return {
          status: 'up',
          responseTime,
          message: 'Event sourcing operational',
          details: {
            recentEvents,
          },
        };
      } else {
        // No recent events - system might be idle or degraded
        return {
          status: 'degraded',
          responseTime,
          message: 'No recent events (system may be idle)',
          details: {
            recentEvents: 0,
          },
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Event sourcing health check failed', error as Error);

      return {
        status: 'down',
        responseTime,
        message: error instanceof Error ? error.message : 'Event sourcing check failed',
        details: {
          error: error instanceof Error ? error.name : 'Unknown error',
        },
      };
    }
  }

  /**
   * Calculate overall system status based on component health
   * 
   * Rules:
   * - healthy: All components are up
   * - degraded: At least one component is degraded, but none are down
   * - unhealthy: At least one component is down
   */
  private calculateSystemStatus(
    database: ComponentHealth,
    redis: ComponentHealth,
    eventSourcing: ComponentHealth
  ): SystemStatus {
    const components = [database, redis, eventSourcing];

    // If any component is down, system is unhealthy
    if (components.some((c) => c.status === 'down')) {
      return 'unhealthy';
    }

    // If any component is degraded, system is degraded
    if (components.some((c) => c.status === 'degraded')) {
      return 'degraded';
    }

    // All components are up
    return 'healthy';
  }

  /**
   * Execute a promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Convert system status to number for metrics
   */
  private statusToNumber(status: SystemStatus): number {
    switch (status) {
      case 'healthy':
        return 2;
      case 'degraded':
        return 1;
      case 'unhealthy':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Convert component status to number for metrics
   */
  private componentStatusToNumber(status: ComponentStatus): number {
    switch (status) {
      case 'up':
        return 2;
      case 'degraded':
        return 1;
      case 'down':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Close database connection
   * Should be called when shutting down the service
   */
  async close(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } catch (error) {
      logger.error('Failed to disconnect Prisma client', error as Error);
    }
  }
}

/**
 * Singleton health check service instance
 */
export const healthCheckService = new HealthCheckService();
