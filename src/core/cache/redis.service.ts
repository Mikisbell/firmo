/**
 * Redis Cache Service
 * High-performance caching with Redis
 * 
 * Features:
 * - Get/Set with TTL
 * - Pattern-based invalidation
 * - JSON serialization
 * - Error handling
 * - Connection pooling
 */

import Redis from 'ioredis';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { metricsHelpers } from '@/src/core/observability/metrics';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Redis client instance
 * Falls back to in-memory cache if Redis is not available
 */
let redis: Redis | null = null;
let inMemoryCache: Map<string, { value: any; expiresAt: number }> | null = null;

// Initialize Redis connection
try {
  if (!isTest) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          pinoLogger.error({ times }, 'Redis connection failed, falling back to in-memory cache');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', (error) => {
      pinoLogger.error({ error: error.message }, 'Redis error, using in-memory cache');
      redis = null;
      inMemoryCache = new Map();
    });

    redis.on('connect', () => {
      pinoLogger.info('Redis connected successfully');
    });

    // Try to connect
    redis.connect().catch(() => {
      pinoLogger.warn('Redis not available, using in-memory cache');
      redis = null;
      inMemoryCache = new Map();
    });
  } else {
    // Use in-memory cache for tests
    inMemoryCache = new Map();
  }
} catch (error) {
  pinoLogger.warn({ error }, 'Redis initialization failed, using in-memory cache');
  redis = null;
  inMemoryCache = new Map();
}

/**
 * Cache Service
 */
export class CacheService {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (redis) {
        const value = await redis.get(key);
        if (!value) {
          // Record cache miss
          metricsHelpers.recordCacheMiss(key);
          return null;
        }
        // Record cache hit
        metricsHelpers.recordCacheHit(key);
        return JSON.parse(value) as T;
      } else if (inMemoryCache) {
        const cached = inMemoryCache.get(key);
        if (!cached) {
          metricsHelpers.recordCacheMiss(key);
          return null;
        }
        if (Date.now() > cached.expiresAt) {
          inMemoryCache.delete(key);
          metricsHelpers.recordCacheMiss(key);
          return null;
        }
        metricsHelpers.recordCacheHit(key);
        return cached.value as T;
      }
      return null;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Cache get error');
      metricsHelpers.recordCacheMiss(key);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      
      if (redis) {
        await redis.setex(key, ttlSeconds, serialized);
      } else if (inMemoryCache) {
        inMemoryCache.set(key, {
          value,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }
    } catch (error) {
      pinoLogger.error({ error, key }, 'Cache set error');
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      if (redis) {
        await redis.del(key);
      } else if (inMemoryCache) {
        inMemoryCache.delete(key);
      }
    } catch (error) {
      pinoLogger.error({ error, key }, 'Cache delete error');
    }
  }

  /**
   * Invalidate all keys matching pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (redis) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          pinoLogger.info({ pattern, count: keys.length }, 'Cache invalidated');
        }
      } else if (inMemoryCache) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        const keysToDelete: string[] = [];
        
        for (const key of inMemoryCache.keys()) {
          if (regex.test(key)) {
            keysToDelete.push(key);
          }
        }
        
        keysToDelete.forEach((key) => inMemoryCache!.delete(key));
        pinoLogger.info({ pattern, count: keysToDelete.length }, 'Cache invalidated');
      }
    } catch (error) {
      pinoLogger.error({ error, pattern }, 'Cache invalidation error');
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      if (redis) {
        await redis.flushdb();
      } else if (inMemoryCache) {
        inMemoryCache.clear();
      }
      pinoLogger.info('Cache cleared');
    } catch (error) {
      pinoLogger.error({ error }, 'Cache clear error');
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return redis !== null || inMemoryCache !== null;
  }

  /**
   * Get cache type
   */
  getType(): 'redis' | 'memory' | 'none' {
    if (redis) return 'redis';
    if (inMemoryCache) return 'memory';
    return 'none';
  }
}

/**
 * Singleton cache instance
 */
export const cache = new CacheService();

/**
 * Helper to generate cache keys
 */
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Cache decorator for functions
 */
export function withCache<T>(
  keyGenerator: (...args: any[]) => string,
  ttlSeconds: number = 60
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args);
      
      // Try to get from cache
      const cached = await cache.get<T>(cacheKey);
      if (cached !== null) {
        pinoLogger.debug({ cacheKey }, 'Cache hit');
        return cached;
      }

      // Execute original method
      pinoLogger.debug({ cacheKey }, 'Cache miss');
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(cacheKey, result, ttlSeconds);

      return result;
    };

    return descriptor;
  };
}
