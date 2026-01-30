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
   * Add member to a set
   */
  async sadd(key: string, member: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.sadd(key, member);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        const set = existing ? new Set(JSON.parse(existing.value)) : new Set();
        set.add(member);
        inMemoryStore.set(key, {
          value: JSON.stringify(Array.from(set)),
          expiresAt: Date.now() + 3600000, // 1 hour default
        });
      }
    } catch (error) {
      pinoLogger.error({ error, key, member }, 'Failed to add to Redis set');
      throw error;
    }
  },

  /**
   * Remove member from a set
   */
  async srem(key: string, member: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.srem(key, member);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return;
        
        const set = new Set(JSON.parse(existing.value));
        set.delete(member);
        inMemoryStore.set(key, {
          value: JSON.stringify(Array.from(set)),
          expiresAt: existing.expiresAt,
        });
      }
    } catch (error) {
      pinoLogger.error({ error, key, member }, 'Failed to remove from Redis set');
      throw error;
    }
  },

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.expire(key, seconds);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (existing) {
          existing.expiresAt = Date.now() + seconds * 1000;
        }
      }
    } catch (error) {
      pinoLogger.error({ error, key, seconds }, 'Failed to set Redis expiration');
      throw error;
    }
  },

  /**
   * Increment a key value
   */
  async incr(key: string): Promise<number> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.incr(key);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        const currentValue = existing ? parseInt(existing.value, 10) : 0;
        const newValue = currentValue + 1;
        inMemoryStore.set(key, {
          value: newValue.toString(),
          expiresAt: existing?.expiresAt || Date.now() + 3600000,
        });
        return newValue;
      }
      return 0;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to increment Redis key');
      throw error;
    }
  },

  /**
   * Decrement a key value
   */
  async decr(key: string): Promise<number> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.decr(key);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        const currentValue = existing ? parseInt(existing.value, 10) : 0;
        const newValue = Math.max(0, currentValue - 1);
        inMemoryStore.set(key, {
          value: newValue.toString(),
          expiresAt: existing?.expiresAt || Date.now() + 3600000,
        });
        return newValue;
      }
      return 0;
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to decrement Redis key');
      throw error;
    }
  },

  /**
   * Increment a hash field
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.hincrby(key, field, increment);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        const hash = existing ? JSON.parse(existing.value) : {};
        const currentValue = hash[field] ? parseInt(hash[field], 10) : 0;
        const newValue = currentValue + increment;
        hash[field] = newValue.toString();
        inMemoryStore.set(key, {
          value: JSON.stringify(hash),
          expiresAt: existing?.expiresAt || Date.now() + 3600000,
        });
        return newValue;
      }
      return 0;
    } catch (error) {
      pinoLogger.error({ error, key, field, increment }, 'Failed to increment Redis hash field');
      throw error;
    }
  },

  /**
   * Get all fields and values from a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.hgetall(key);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return {};
        
        // Check expiration
        if (Date.now() > existing.expiresAt) {
          inMemoryStore.delete(key);
          return {};
        }
        
        return JSON.parse(existing.value);
      }
      return {};
    } catch (error) {
      pinoLogger.error({ error, key }, 'Failed to get Redis hash');
      throw error;
    }
  },

  /**
   * Get a range of elements from a list
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.lrange(key, start, stop);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return [];
        
        // Check expiration
        if (Date.now() > existing.expiresAt) {
          inMemoryStore.delete(key);
          return [];
        }
        
        const list = JSON.parse(existing.value);
        
        // Handle negative indices
        const actualStart = start < 0 ? Math.max(0, list.length + start) : start;
        const actualStop = stop < 0 ? list.length + stop + 1 : stop + 1;
        
        return list.slice(actualStart, actualStop);
      }
      return [];
    } catch (error) {
      pinoLogger.error({ error, key, start, stop }, 'Failed to get Redis list range');
      throw error;
    }
  },

  /**
   * Remove elements from a list
   */
  async lrem(key: string, count: number, value: string): Promise<number> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.lrem(key, count, value);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return 0;
        
        const list = JSON.parse(existing.value);
        let removed = 0;
        
        if (count > 0) {
          // Remove first N occurrences
          for (let i = 0; i < list.length && removed < count; i++) {
            if (list[i] === value) {
              list.splice(i, 1);
              removed++;
              i--;
            }
          }
        } else if (count < 0) {
          // Remove last N occurrences
          for (let i = list.length - 1; i >= 0 && removed < Math.abs(count); i--) {
            if (list[i] === value) {
              list.splice(i, 1);
              removed++;
            }
          }
        } else {
          // Remove all occurrences
          const originalLength = list.length;
          const filtered = list.filter((item: string) => item !== value);
          removed = originalLength - filtered.length;
          list.length = 0;
          list.push(...filtered);
        }
        
        inMemoryStore.set(key, {
          value: JSON.stringify(list),
          expiresAt: existing.expiresAt,
        });
        
        return removed;
      }
      return 0;
    } catch (error) {
      pinoLogger.error({ error, key, count, value }, 'Failed to remove from Redis list');
      throw error;
    }
  },

  /**
   * Get element from list by index
   */
  async lindex(key: string, index: number): Promise<string | null> {
    try {
      if (deliveryRedis) {
        return await deliveryRedis.lindex(key, index);
      } else if (inMemoryStore) {
        const existing = inMemoryStore.get(key);
        if (!existing) return null;
        
        // Check expiration
        if (Date.now() > existing.expiresAt) {
          inMemoryStore.delete(key);
          return null;
        }
        
        const list = JSON.parse(existing.value);
        
        // Handle negative indices
        const actualIndex = index < 0 ? list.length + index : index;
        
        if (actualIndex < 0 || actualIndex >= list.length) {
          return null;
        }
        
        return list[actualIndex];
      }
      return null;
    } catch (error) {
      pinoLogger.error({ error, key, index }, 'Failed to get Redis list element');
      throw error;
    }
  },

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      if (deliveryRedis) {
        await deliveryRedis.unsubscribe(channel);
      }
      // In-memory mode doesn't support pub/sub
    } catch (error) {
      pinoLogger.error({ error, channel }, 'Failed to unsubscribe from Redis channel');
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
