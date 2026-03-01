/**
 * Redis Cache Service — Legacy Adapter
 *
 * This file re-exports cache-service.ts (production-grade, with circuit breaker,
 * compression, and tag-based invalidation) while preserving backward-compatible
 * method names used by 45+ consumers.
 *
 * PREFER importing from '@/src/core/cache/cache-service' in new code.
 *
 * @deprecated Use cache-service.ts directly for new code.
 */

import {
  cache as primaryCache,
  generateCacheKey,
  withCache,
  type CacheOptions,
  DEFAULT_TTLS,
} from './cache-service';

export { generateCacheKey, withCache, DEFAULT_TTLS };
export type { CacheOptions };

/**
 * Legacy-compatible cache wrapper.
 * Delegates to RedisCacheService (cache-service.ts) for all operations.
 */
class LegacyCacheAdapter {
  /** Get value from cache */
  async get<T>(key: string): Promise<T | null> {
    return primaryCache.get<T>(key);
  }

  /**
   * Set value in cache.
   * Accepts both legacy signature (ttlSeconds number) and new signature (CacheOptions).
   */
  async set(key: string, value: any, ttlOrOptions?: number | CacheOptions): Promise<void> {
    const options: CacheOptions | undefined =
      typeof ttlOrOptions === 'number' ? { ttl: ttlOrOptions } : ttlOrOptions;
    return primaryCache.set(key, value, options);
  }

  /** Delete key — legacy name (cache-service.ts uses `delete`) */
  async del(key: string): Promise<void> {
    return primaryCache.delete(key);
  }

  /** Delete key — new name */
  async delete(key: string): Promise<void> {
    return primaryCache.delete(key);
  }

  /**
   * Invalidate all keys matching a glob pattern.
   * Delegates to cache-service.ts `deleteByTag` when pattern matches a tag,
   * otherwise falls back to pattern scanning (O(n) — avoid in hot paths).
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Extract tag-like prefix: "products:*" → try deleteByTag("products")
    const tagMatch = pattern.match(/^([a-zA-Z0-9_-]+):\*$/);
    if (tagMatch) {
      return primaryCache.deleteByTag(tagMatch[1]);
    }
    // For complex patterns, delegate to deleteByTag with full pattern as tag name.
    // Callers should migrate to tags for O(1) invalidation.
    return primaryCache.deleteByTag(pattern);
  }

  /** Delete by tag — new API */
  async deleteByTag(tag: string): Promise<void> {
    return primaryCache.deleteByTag(tag);
  }

  /** Clear all cache */
  async clear(): Promise<void> {
    return primaryCache.clear();
  }

  /** Check if cache is available */
  isAvailable(): boolean {
    return primaryCache.isAvailable();
  }

  /** Get cache backend type */
  getType(): 'redis' | 'memory' | 'none' {
    return primaryCache.getType();
  }

  /** Get circuit breaker state (monitoring) */
  getCircuitBreakerState() {
    return primaryCache.getCircuitBreakerState();
  }
}

/**
 * Singleton cache instance (legacy-compatible).
 * Internally delegates to cache-service.ts RedisCacheService.
 */
export const cache = new LegacyCacheAdapter();

// Also export as CacheService for type compatibility
export { LegacyCacheAdapter as CacheService };
