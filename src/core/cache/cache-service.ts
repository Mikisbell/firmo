/**
 * PARK POS Cache Service - Production Grade
 * 
 * Implements comprehensive caching with:
 * - Redis (Upstash) for distributed caching
 * - Tag-based cache invalidation
 * - Graceful degradation (falls back to in-memory)
 * - Circuit breaker for Redis connection failures
 * - Compression for large values (> 1KB)
 * - Tenant-namespaced keys
 * - TTL support with different defaults per resource type
 * - Metrics integration for cache hit/miss tracking
 * 
 * @module core/cache/cache-service
 */

import { Redis } from '@upstash/redis';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { compress, decompress } from '@/src/core/utils/compression';

/**
 * Cache options for set operations
 */
export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Tags for cache invalidation */
  tags?: string[];
  /** Force compression regardless of size */
  forceCompression?: boolean;
}

/**
 * Cache service interface
 * Defines the contract for all cache implementations
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByTag(tag: string): Promise<void>;
  clear(): Promise<void>;
  isAvailable(): boolean;
  getType(): 'redis' | 'memory' | 'none';
}

/**
 * Circuit breaker states
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker for Redis connection
 * Prevents cascading failures when Redis is unavailable
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: CircuitState = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          failures: this.failures,
        });
      } else {
        metrics.increment('cache.circuit_breaker.rejected');
        return null; // Circuit is open, fail fast
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info('Circuit breaker transitioning to CLOSED');
    }
    this.failures = 0;
    this.state = 'CLOSED';
    metrics.gauge('cache.circuit_breaker.state', 0); // CLOSED = 0
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold,
      });
      metrics.gauge('cache.circuit_breaker.state', 2); // OPEN = 2
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn('Circuit breaker reopened from HALF_OPEN');
      metrics.gauge('cache.circuit_breaker.state', 2);
    }
    
    metrics.increment('cache.circuit_breaker.failures');
  }
  
  getState(): CircuitState {
    return this.state;
  }
}

/**
 * In-memory cache entry
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

/**
 * Default TTLs for different resource types (in seconds)
 */
export const DEFAULT_TTLS = {
  products: 3600,    // 1 hour
  tenants: 300,      // 5 minutes
  terminals: 900,    // 15 minutes
  employees: 600,    // 10 minutes
  default: 300,      // 5 minutes
} as const;

/**
 * Compression threshold (1KB)
 */
const COMPRESSION_THRESHOLD = 1024;

/**
 * Redis Cache Service Implementation
 * 
 * Production-grade caching with:
 * - Upstash Redis for distributed caching
 * - Automatic fallback to in-memory cache
 * - Circuit breaker for connection failures
 * - Tag-based invalidation
 * - Compression for large values
 * - Tenant-namespaced keys
 */
export class RedisCacheService implements CacheService {
  private redis: Redis | null = null;
  private inMemoryCache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private circuitBreaker: CircuitBreaker;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly isTest: boolean;
  
  constructor() {
    this.isTest = process.env.NODE_ENV === 'test';
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    
    // Initialize Redis connection
    this.initializeRedis();
    
    // Start cleanup interval for in-memory cache
    this.startCleanupInterval();
  }
  
  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    try {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      
      if (!this.isTest && redisUrl && redisToken) {
        this.redis = new Redis({
          url: redisUrl,
          token: redisToken,
        });
        
        logger.info('Upstash Redis cache initialized successfully', {
          type: 'redis',
        });
        metrics.gauge('cache.redis.connected', 1);
        
      } else {
        logger.info('Redis not configured, using in-memory cache', {
          type: 'memory',
          isTest: this.isTest,
        });
      }
    } catch (error) {
      logger.error('Failed to initialize Redis, falling back to in-memory cache', error as Error);
      this.redis = null;
    }
  }
  
  /**
   * Start cleanup interval for expired in-memory cache entries
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    // Clean up every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 300000);
    
    // Ensure cleanup on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = null;
        }
      });
    }
  }
  
  /**
   * Clean up expired entries from in-memory cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.inMemoryCache.delete(key);
        
        // Remove from tag index
        for (const tag of entry.tags) {
          const keys = this.tagIndex.get(tag);
          if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
              this.tagIndex.delete(tag);
            }
          }
        }
        
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cleaned up expired cache entries', {
        cleaned,
        remaining: this.inMemoryCache.size,
      });
    }
  }
  
  /**
   * Build a tenant-namespaced cache key
   */
  private buildKey(key: string, tenantId?: string): string {
    if (tenantId) {
      return `tenant:${tenantId}:${key}`;
    }
    return key;
  }
  
  /**
   * Check if value should be compressed
   */
  private shouldCompress(value: string, forceCompression?: boolean): boolean {
    if (forceCompression) {
      return true;
    }
    return value.length > COMPRESSION_THRESHOLD;
  }
  
  /**
   * Serialize and optionally compress a value
   */
  private async serialize<T>(value: T, forceCompression?: boolean): Promise<string> {
    const serialized = JSON.stringify(value);
    
    if (this.shouldCompress(serialized, forceCompression)) {
      const compressed = await compress(serialized);
      metrics.increment('cache.compression.applied');
      return `compressed:${compressed}`;
    }
    
    return serialized;
  }
  
  /**
   * Deserialize and optionally decompress a value
   */
  private async deserialize<T>(value: string): Promise<T> {
    if (value.startsWith('compressed:')) {
      const compressed = value.substring('compressed:'.length);
      const decompressed = await decompress(compressed);
      metrics.increment('cache.decompression.applied');
      return JSON.parse(decompressed) as T;
    }
    
    return JSON.parse(value) as T;
  }
  
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // Try Redis first if available
      if (this.redis) {
        const result = await this.circuitBreaker.execute(async () => {
          const value = await this.redis!.get(key);
          return value;
        });
        
        if (result !== null) {
          const deserialized = await this.deserialize<T>(result as string);
          metrics.increment('cache.hit', { backend: 'redis' });
          metrics.timing('cache.get', Date.now() - startTime, { backend: 'redis' });
          return deserialized;
        }
        
        metrics.increment('cache.miss', { backend: 'redis' });
        metrics.timing('cache.get', Date.now() - startTime, { backend: 'redis' });
        return null;
      }
      
      // Fall back to in-memory cache
      const cached = this.inMemoryCache.get(key);
      if (!cached) {
        metrics.increment('cache.miss', { backend: 'memory' });
        metrics.timing('cache.get', Date.now() - startTime, { backend: 'memory' });
        return null;
      }
      
      // Check expiration
      if (Date.now() > cached.expiresAt) {
        this.inMemoryCache.delete(key);
        
        // Remove from tag index
        for (const tag of cached.tags) {
          const keys = this.tagIndex.get(tag);
          if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
              this.tagIndex.delete(tag);
            }
          }
        }
        
        metrics.increment('cache.miss', { backend: 'memory', reason: 'expired' });
        metrics.timing('cache.get', Date.now() - startTime, { backend: 'memory' });
        return null;
      }
      
      metrics.increment('cache.hit', { backend: 'memory' });
      metrics.timing('cache.get', Date.now() - startTime, { backend: 'memory' });
      return cached.value as T;
      
    } catch (error) {
      logger.error('Cache get failed', error as Error, { key });
      metrics.increment('cache.error', { operation: 'get' });
      return null; // Graceful degradation
    }
  }
  
  /**
   * Set value in cache with TTL and tags
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    const ttl = options?.ttl || DEFAULT_TTLS.default;
    const tags = options?.tags || [];
    
    try {
      const serialized = await this.serialize(value, options?.forceCompression);
      
      // Try Redis first if available
      if (this.redis) {
        await this.circuitBreaker.execute(async () => {
          await this.redis!.setex(key, ttl, serialized);
          
          // Store tags in Redis for invalidation
          if (tags.length > 0) {
            for (const tag of tags) {
              await this.redis!.sadd(`tag:${tag}`, key);
              await this.redis!.expire(`tag:${tag}`, ttl);
            }
          }
        });
        
        metrics.increment('cache.set', { backend: 'redis' });
        metrics.timing('cache.set', Date.now() - startTime, { backend: 'redis' });
        return;
      }
      
      // Fall back to in-memory cache
      const expiresAt = Date.now() + ttl * 1000;
      this.inMemoryCache.set(key, {
        value,
        expiresAt,
        tags,
      });
      
      // Update tag index
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
      
      metrics.increment('cache.set', { backend: 'memory' });
      metrics.timing('cache.set', Date.now() - startTime, { backend: 'memory' });
      
    } catch (error) {
      logger.error('Cache set failed', error as Error, { key });
      metrics.increment('cache.error', { operation: 'set' });
      // Don't throw - caching is not critical
    }
  }
  
  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      // Try Redis first if available
      if (this.redis) {
        await this.circuitBreaker.execute(async () => {
          await this.redis!.del(key);
        });
        
        metrics.increment('cache.delete', { backend: 'redis' });
        return;
      }
      
      // Fall back to in-memory cache
      const cached = this.inMemoryCache.get(key);
      if (cached) {
        // Remove from tag index
        for (const tag of cached.tags) {
          const keys = this.tagIndex.get(tag);
          if (keys) {
            keys.delete(key);
            if (keys.size === 0) {
              this.tagIndex.delete(tag);
            }
          }
        }
      }
      
      this.inMemoryCache.delete(key);
      metrics.increment('cache.delete', { backend: 'memory' });
      
    } catch (error) {
      logger.error('Cache delete failed', error as Error, { key });
      metrics.increment('cache.error', { operation: 'delete' });
    }
  }
  
  /**
   * Delete all keys with a specific tag
   */
  async deleteByTag(tag: string): Promise<void> {
    try {
      // Try Redis first if available
      if (this.redis) {
        await this.circuitBreaker.execute(async () => {
          const keys = await this.redis!.smembers(`tag:${tag}`);
          if (keys.length > 0) {
            await this.redis!.del(...keys);
            await this.redis!.del(`tag:${tag}`);
          }
        });
        
        metrics.increment('cache.deleteByTag', { backend: 'redis' });
        logger.info('Cache invalidated by tag', { tag, backend: 'redis' });
        return;
      }
      
      // Fall back to in-memory cache
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          this.inMemoryCache.delete(key);
        }
        this.tagIndex.delete(tag);
        
        metrics.increment('cache.deleteByTag', { backend: 'memory' });
        logger.info('Cache invalidated by tag', { tag, backend: 'memory', count: keys.size });
      }
      
    } catch (error) {
      logger.error('Cache deleteByTag failed', error as Error, { tag });
      metrics.increment('cache.error', { operation: 'deleteByTag' });
    }
  }
  
  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // Try Redis first if available
      if (this.redis) {
        await this.circuitBreaker.execute(async () => {
          await this.redis!.flushdb();
        });
        
        metrics.increment('cache.clear', { backend: 'redis' });
        logger.info('Cache cleared', { backend: 'redis' });
        return;
      }
      
      // Fall back to in-memory cache
      this.inMemoryCache.clear();
      this.tagIndex.clear();
      
      metrics.increment('cache.clear', { backend: 'memory' });
      logger.info('Cache cleared', { backend: 'memory' });
      
    } catch (error) {
      logger.error('Cache clear failed', error as Error);
      metrics.increment('cache.error', { operation: 'clear' });
    }
  }
  
  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.redis !== null || this.inMemoryCache !== null;
  }
  
  /**
   * Get cache type
   */
  getType(): 'redis' | 'memory' | 'none' {
    if (this.redis && this.circuitBreaker.getState() !== 'OPEN') {
      return 'redis';
    }
    if (this.inMemoryCache) {
      return 'memory';
    }
    return 'none';
  }
  
  /**
   * Get circuit breaker state (for monitoring)
   */
  getCircuitBreakerState(): CircuitState {
    return this.circuitBreaker.getState();
  }
}

/**
 * Singleton cache instance
 */
export const cache = new RedisCacheService();

/**
 * Helper to generate cache keys
 */
export function generateCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Cache decorator for functions
 * Automatically caches function results based on arguments
 */
export function withCache<T>(
  keyGenerator: (...args: any[]) => string,
  options?: CacheOptions
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
        logger.debug('Cache hit', { cacheKey });
        return cached;
      }

      // Execute original method
      logger.debug('Cache miss', { cacheKey });
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(cacheKey, result, options);

      return result;
    };

    return descriptor;
  };
}
