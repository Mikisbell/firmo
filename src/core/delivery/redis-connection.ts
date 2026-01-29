/**
 * Redis Connection Utility for Delivery Module
 * 
 * Provides Redis client for:
 * - Real-time location storage (TTL: 5 minutes)
 * - SSE connection management
 * - Push notification queues
 * - Real-time metrics
 * - Pending assignment queues
 * 
 * @module delivery/redis-connection
 */

import Redis from 'ioredis';
import { pinoLogger } from '@/src/core/observability/logger-pino';

/**
 * Redis client for delivery module
 * Separate instance from main cache for isolation
 */
let deliveryRedis: Redis | null = null;

/**
 * In-memory fallback for development/testing
 */
let inMemoryStore: Map<string, { value: string; expiresAt: number }> | null = null;

const isTest = process.env.NODE_ENV === 'test';

/**
 * Initialize Redis connection for delivery module
 */
function initializeDeliveryRedis(): void {
  try {
    if (!isTest && process.env.REDIS_URL) {
      deliveryRedis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) {
            pinoLogger.info({ times }, 'Delivery Redis connection failed, falling back to in-memory');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      deliveryRedis.on('error', (error) => {
        pinoLogger.warn({ error: error.message }, 'Delivery Redis error, using in-memory fallback');
        deliveryRedis = null;
        inMemoryStore = new Map();
      });

      deliveryRedis.on('connect', () => {
        pinoLogger.info('Delivery Redis connected successfully');
      });

      deliveryRedis.connect().catch(() => {
        pinoLogger.info('Delivery Redis not available, using in-memory fallback');
        deliveryRedis = null;
        inMemoryStore = new Map();
      });
    } else {
      inMemoryStore = new Map();
      if (!isTest && !process.env.REDIS_URL) {
        pinoLogger.info('REDIS_URL not configured, using in-memory fallback for delivery');
      }
    }
  } catch (error) {
    pinoLogger.warn({ error }, 'Delivery Redis initialization failed, using in-memory fallback');
    deliveryRedis = null;
    inMemoryStore = new Map();
  }
}

// Initialize on module load
initializeDeliveryRedis();

/**
 * Delivery Redis Service
 * Provides Redis operations with in-memory fallback
 */
export const deliveryRedisService = {
  /**
   * Set a key with TTL
   */
  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.setex(key, ttlSeconds, value);
      } else if (inMemoryStore) {
        const expiresAt = Date.now() + ttlSeconds * 1000;
        inMemoryStore.set(key, { value, expiresAt });
      }
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to set Redis key');
      throw error;
    }
  },

  /**
   * Get a key value
   */
  async get(key: string): Promise<string | null> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.get(key);
      } else if (inMemoryStore) {
        const entry = inMemoryStore.get(key);
        if (!entry) return null;
        
        // Check expiration
        if (Date.now() > entry.expiresAt) {
          inMemoryStore.delete(key);
          return null;
        }
        
        return entry.value;
      }
      return null;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to get Redis key');
      throw error;
    }
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.del(key);
      } else if (inMemoryStore) {
        inMemoryStore.delete(key);
      }
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to delete Redis key');
      throw error;
    }
  },

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.keys(pattern);
      } else if (inMemoryStore) {
        const allKeys = Array.from(inMemoryStore.keys());
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return allKeys.filter(key => regex.test(key));
      }
      return [];
    } catch (error) {
      pinoLogger.error({ error, pattern }, 'Failed to get Redis keys');
      throw error;
    }
  },

  /**
   * Publish a message to a channel (for SSE broadcasting)
   */
  async publish(channel: string, message: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.publish(channel, message);
      }
      // In-memory mode doesn't support pub/sub (single instance only)
    } catch (error) {
      pinoLogger.error({ error, channel }, 'Failed to publish Redis message');
      throw error;
    }
  },

  /**
   * Subscribe to a channel (for SSE broadcasting)
   */
  subscribe(channel: string, callback: (message: string) => void): void {
    try {
      if (deliveryRedis) {
        const subscriber = deliveryRedis.duplicate();
        subscriber.subscribe(channel);
        subscriber.on('message', (ch, msg) => {
          if (ch === channel) {
            callback(msg);
          }
        });
      }
      // In-memory mode doesn't support pub/sub
    } catch (error) {
      pinoLogger.error({ error, channel }, 'Failed to subscribe to Redis channel');
      throw error;
    }
  },

  /**
   * Push to a list (for queues)
   */
  async rpush(key: string, value: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.rpush(key, value);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        const list = existing ? JSON.parse(existing.value) : [];
        list.push(value);
        inMemoryStore.set(key, {
          value: JSON.stringify(list),
          expiresAt: Date.now() + 3600000, // 1 hour default
        });
      }
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to push to Redis list');
      throw error;
    }
  },

  /**
   * Pop from a list (for queues)
   */
  async lpop(key: string): Promise<string | null> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.lpop(key);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return null;
        
        const list = JSON.parse(existing.value);
        if (list.length === 0) return null;
        
        const value = list.shift();
        inMemoryStore.set(key, {
          value: JSON.stringify(list),
          expiresAt: existing.expiresAt,
        });
        
        return value;
      }
      return null;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to pop from Redis list');
      throw error;
    }
  },

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.llen(key);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return 0;
        
        const list = JSON.parse(existing.value);
        return list.length;
      }
      return 0;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to get Redis list length');
      throw error;
    }
  },

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return deliveryRedis !== null || inMemoryStore !== null;
  },

  /**
   * Get connection type
   */
  getType(): 'redis' | 'memory' | 'none' {
    if (deliveryRedis) return 'redis';
    if (inMemoryStore) return 'memory';
    return 'none';
  },

  /**
   * Get raw Redis client (for advanced operations)
   */
  getClient(): Redis | null {
    return deliveryRedis;
  },
};
