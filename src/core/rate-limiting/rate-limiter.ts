/**
 * Rate Limiter Service
 * 
 * Implementa rate limiting usando sliding window algorithm con Redis.
 * 
 * Features:
 * - Sliding window de 1 segundo
 * - Límite normal: 100 req/s por tenant
 * - Límite burst: 200 req/s
 * - Fallback a in-memory si Redis no disponible
 * - Métricas de rate limiting
 * 
 * @module core/rate-limiting/rate-limiter
 */

import Redis from 'ioredis';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { metricsHelpers } from '@/src/core/observability/metrics';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Configuración de rate limiting
 */
const RATE_LIMIT = 100; // requests por segundo (normal)
const BURST_LIMIT = 200; // requests por segundo (burst)
const WINDOW_SIZE_MS = 1000; // 1 segundo en milisegundos

/**
 * Resultado de verificación de rate limit
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // Segundos hasta que se puede reintentar
  currentCount: number;
  limit: number;
  limitType: 'normal' | 'burst';
}

/**
 * Redis client para rate limiting
 */
let redis: Redis | null = null;
let inMemoryStore: Map<string, Array<{ timestamp: number; id: string }>> | null = null;

// Inicializar Redis connection
try {
  if (!isTest && process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          pinoLogger.info({ times }, 'Rate limiter: Redis connection failed, falling back to in-memory');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (error) => {
      pinoLogger.info({ error: error.message }, 'Rate limiter: Redis error, using in-memory store');
      redis = null;
      inMemoryStore = new Map();
    });

    redis.on('connect', () => {
      pinoLogger.info('Rate limiter: Redis connected successfully');
    });

    // Intentar conectar
    redis.connect().catch(() => {
      pinoLogger.info('Rate limiter: Redis not available, using in-memory store (OK for MVP)');
      redis = null;
      inMemoryStore = new Map();
    });
  } else {
    // Usar in-memory store para tests o cuando REDIS_URL no está configurado
    inMemoryStore = new Map();
    if (!isTest && !process.env.REDIS_URL) {
      pinoLogger.info('Rate limiter: REDIS_URL not configured, using in-memory store (OK for MVP)');
    }
  }
} catch (error) {
  pinoLogger.info({ error }, 'Rate limiter: Redis initialization failed, using in-memory store (OK for MVP)');
  redis = null;
  inMemoryStore = new Map();
}

/**
 * Rate Limiter Service
 */
export class RateLimiterService {
  /**
   * Verifica si un tenant ha excedido el rate limit
   * 
   * Usa sliding window algorithm:
   * 1. Remover requests antiguos fuera de la ventana
   * 2. Contar requests en la ventana actual
   * 3. Agregar el request actual
   * 4. Verificar límites
   */
  async checkLimit(tenantId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;
    const key = `rate_limit:${tenantId}`;

    try {
      if (redis) {
        return await this.checkLimitRedis(redis, key, now, windowStart);
      } else if (inMemoryStore) {
        return await this.checkLimitMemory(key, now, windowStart);
      }

      // Si no hay store disponible, permitir el request
      pinoLogger.warn('Rate limiter: No store available, allowing request');
      return {
        allowed: true,
        currentCount: 0,
        limit: RATE_LIMIT,
        limitType: 'normal',
      };
    } catch (error) {
      pinoLogger.error({ error, tenantId }, 'Rate limiter: Error checking limit, allowing request');
      return {
        allowed: true,
        currentCount: 0,
        limit: RATE_LIMIT,
        limitType: 'normal',
      };
    }
  }

  /**
   * Verificar rate limit usando Redis (sorted set)
   */
  private async checkLimitRedis(
    redisClient: Redis,
    key: string,
    now: number,
    windowStart: number
  ): Promise<RateLimitResult> {
    const pipeline = redisClient.pipeline();

    // 1. Remover requests antiguos fuera de la ventana
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 2. Contar requests en la ventana actual
    pipeline.zcard(key);

    // 3. Agregar el request actual
    const requestId = `${now}:${Math.random()}`;
    pipeline.zadd(key, now, requestId);

    // 4. Expirar la key después de 2 segundos
    pipeline.expire(key, 2);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline failed');
    }

    // El resultado de zcard está en results[1][1]
    const count = (results[1][1] as number) || 0;

    // Verificar límites
    if (count >= BURST_LIMIT) {
      // Excedió burst limit
      metricsHelpers.recordRateLimitRejection(key, 'burst');
      pinoLogger.warn(
        { tenantId: key, count, limit: BURST_LIMIT },
        'Rate limit: Burst limit exceeded'
      );

      return {
        allowed: false,
        retryAfter: 1,
        currentCount: count,
        limit: BURST_LIMIT,
        limitType: 'burst',
      };
    }

    if (count >= RATE_LIMIT) {
      // Excedió rate limit normal
      metricsHelpers.recordRateLimitRejection(key, 'normal');
      pinoLogger.warn(
        { tenantId: key, count, limit: RATE_LIMIT },
        'Rate limit: Normal limit exceeded'
      );

      return {
        allowed: false,
        retryAfter: 1,
        currentCount: count,
        limit: RATE_LIMIT,
        limitType: 'normal',
      };
    }

    // Request permitido
    metricsHelpers.recordRateLimitAllowed(key);
    return {
      allowed: true,
      currentCount: count,
      limit: RATE_LIMIT,
      limitType: 'normal',
    };
  }

  /**
   * Verificar rate limit usando in-memory store
   */
  private async checkLimitMemory(
    key: string,
    now: number,
    windowStart: number
  ): Promise<RateLimitResult> {
    if (!inMemoryStore) {
      throw new Error('In-memory store not initialized');
    }

    // Obtener requests actuales
    let requests = inMemoryStore.get(key) || [];

    // 1. Remover requests antiguos fuera de la ventana
    requests = requests.filter((r) => r.timestamp > windowStart);

    // 2. Contar requests en la ventana actual
    const count = requests.length;

    // 3. Agregar el request actual
    const requestId = `${now}:${Math.random()}`;
    requests.push({ timestamp: now, id: requestId });

    // Actualizar store
    inMemoryStore.set(key, requests);

    // Verificar límites
    if (count >= BURST_LIMIT) {
      metricsHelpers.recordRateLimitRejection(key, 'burst');
      pinoLogger.warn(
        { tenantId: key, count, limit: BURST_LIMIT },
        'Rate limit: Burst limit exceeded (memory)'
      );

      return {
        allowed: false,
        retryAfter: 1,
        currentCount: count,
        limit: BURST_LIMIT,
        limitType: 'burst',
      };
    }

    if (count >= RATE_LIMIT) {
      metricsHelpers.recordRateLimitRejection(key, 'normal');
      pinoLogger.warn(
        { tenantId: key, count, limit: RATE_LIMIT },
        'Rate limit: Normal limit exceeded (memory)'
      );

      return {
        allowed: false,
        retryAfter: 1,
        currentCount: count,
        limit: RATE_LIMIT,
        limitType: 'normal',
      };
    }

    // Request permitido
    metricsHelpers.recordRateLimitAllowed(key);
    return {
      allowed: true,
      currentCount: count,
      limit: RATE_LIMIT,
      limitType: 'normal',
    };
  }

  /**
   * Obtener tipo de store usado
   */
  getStoreType(): 'redis' | 'memory' | 'none' {
    if (redis) return 'redis';
    if (inMemoryStore) return 'memory';
    return 'none';
  }

  /**
   * Limpiar store (solo para tests)
   */
  async clear(): Promise<void> {
    if (redis) {
      const keys = await redis.keys('rate_limit:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else if (inMemoryStore) {
      inMemoryStore.clear();
    }
  }
}

/**
 * Singleton rate limiter instance
 */
export const rateLimiter = new RateLimiterService();

/**
 * Cleanup job para in-memory store
 * Ejecutar cada 5 segundos para limpiar requests antiguos
 */
if (inMemoryStore && !isTest) {
  setInterval(() => {
    if (!inMemoryStore) return;

    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_MS;

    for (const [key, requests] of inMemoryStore.entries()) {
      const filtered = requests.filter((r) => r.timestamp > windowStart);
      
      if (filtered.length === 0) {
        inMemoryStore.delete(key);
      } else if (filtered.length < requests.length) {
        inMemoryStore.set(key, filtered);
      }
    }
  }, 5000);
}
