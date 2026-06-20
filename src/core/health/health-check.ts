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
  // 8s por defecto: margen para el cold-start de conexion DB en serverless.
  // Inyectable para poder probar el mecanismo de timeout sin esperar 8s en los tests.
  private readonly timeout: number;

  constructor(prisma?: PrismaClient, timeoutMs = 8000) {
    this.prisma = prisma || prismaSingleton;
    this.timeout = timeoutMs;
  }

  /**
   * Perform complete health check
   * Returns health status for all components
   */
  async check(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Probes independientes con allSettled: el fallo/timeout de UNO ya no enmascara
      // a los demas (antes Promise.all rechazaba al primero y marcaba todo down).
      const [databaseR, redisR, eventSourcingR] = await Promise.allSettled([
        this.checkDatabaseWithTimeout(),
        this.checkRedisWithTimeout(),
        this.checkEventSourcingWithTimeout(),
      ]);
      const settle = (r: PromiseSettledResult<ComponentHealth>, label: string): ComponentHealth =>
        r.status === 'fulfilled'
          ? r.value
          : { status: 'down', responseTime: 0, message: r.reason instanceof Error ? r.reason.message : `Fallo en ${label}` };
      const database = settle(databaseR, 'database');
      const redis = settle(redisR, 'redis');
      const eventSourcing = settle(eventSourcingR, 'eventSourcing');

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
      // Exponemos el error real (antes se ocultaba con un mensaje generico) para diagnostico.
      const failMsg = error instanceof Error ? error.message : 'Verificación de salud fallida';

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            responseTime: 0,
            message: failMsg,
          },
          redis: {
            status: 'down',
            responseTime: 0,
            message: failMsg,
          },
          eventSourcing: {
            status: 'down',
            responseTime: 0,
            message: failMsg,
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
      'Verificación de base de datos agotó el tiempo'
    );
  }

  /**
   * Check Redis connectivity with timeout
   */
  private async checkRedisWithTimeout(): Promise<ComponentHealth> {
    return this.withTimeout(
      this.checkRedis(),
      this.timeout,
      'Verificación de Redis agotó el tiempo'
    );
  }

  /**
   * Check event sourcing health with timeout
   */
  private async checkEventSourcingWithTimeout(): Promise<ComponentHealth> {
    return this.withTimeout(
      this.checkEventSourcing(),
      this.timeout,
      'Verificación de event sourcing agotó el tiempo'
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
        message: 'Conexión a base de datos exitosa',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('Database health check failed', error as Error);

      return {
        status: 'down',
        responseTime,
        message: error instanceof Error ? error.message : 'Conexión a base de datos fallida',
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
          message: 'Redis no configurado, usando caché en memoria',
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
          message: 'Conexión a Redis exitosa',
          details: {
            cacheType: cache.getType(),
          },
        };
      } else {
        return {
          status: 'degraded',
          responseTime,
          message: 'Discrepancia de lectura/escritura en Redis',
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
        message: 'Conexión a Redis fallida, usando respaldo',
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
          message: 'Event sourcing operacional',
          details: {
            recentEvents,
          },
        };
      } else {
        // No recent events - system might be idle or degraded
        return {
          status: 'degraded',
          responseTime,
          message: 'Sin eventos recientes (el sistema puede estar inactivo)',
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
        message: error instanceof Error ? error.message : 'Verificación de event sourcing fallida',
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
    // Redis es NO-critico: tiene fallback en memoria, su caida NO debe tumbar el
    // sistema a unhealthy (solo degrada). Criticos para operar: database y eventSourcing.
    const critical = [database, eventSourcing];
    if (critical.some((c) => c.status === 'down')) {
      return 'unhealthy';
    }

    // Cualquier componente down (ej. redis) o degraded -> degraded (HTTP 200).
    const all = [database, redis, eventSourcing];
    if (all.some((c) => c.status === 'down' || c.status === 'degraded')) {
      return 'degraded';
    }

    // Todos arriba
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
