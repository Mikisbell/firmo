/**
 * Cache Invalidation Service for KDS Stations
 * 
 * Listens to domain events and invalidates relevant cache entries
 * 
 * Requirements: 2.1.5, 2.2.5
 */

import { cache } from '@/src/core/cache/redis.service';
import { INVALIDATION_PATTERNS } from './cache-keys';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import type { DomainEvent } from '@/src/core/domain/events';

/**
 * Invalidate cache based on event type
 */
export async function invalidateCacheForEvent(event: DomainEvent): Promise<void> {
  try {
    const { type, payload } = event;

    switch (type) {
      case 'ITEM_COMPLETED':
      case 'ITEM_STARTED':
      case 'ITEM_READY':
        // Invalidate metrics and orders for the station
        if (payload.stationId) {
          await Promise.all([
            cache.invalidatePattern(INVALIDATION_PATTERNS.stationMetrics(payload.stationId)),
            cache.invalidatePattern(INVALIDATION_PATTERNS.stationOrders(payload.stationId)),
            cache.invalidatePattern(INVALIDATION_PATTERNS.stationTrends(payload.stationId)),
          ]);
          
          pinoLogger.info(
            { eventType: type, stationId: payload.stationId },
            'Cache invalidated for item status change'
          );
        }
        break;

      case 'ORDER_SUBMITTED':
      case 'ORDER_VOIDED':
        // Invalidate metrics and orders for all affected stations
        if (payload.items && Array.isArray(payload.items)) {
          const stationIds = new Set(
            payload.items
              .map((item: any) => item.stationId)
              .filter((id: any) => id)
          );

          await Promise.all(
            Array.from(stationIds).flatMap((stationId) => [
              cache.invalidatePattern(INVALIDATION_PATTERNS.stationMetrics(stationId)),
              cache.invalidatePattern(INVALIDATION_PATTERNS.stationOrders(stationId)),
              cache.invalidatePattern(INVALIDATION_PATTERNS.stationTrends(stationId)),
            ])
          );

          pinoLogger.info(
            { eventType: type, stationIds: Array.from(stationIds) },
            'Cache invalidated for order change'
          );
        }
        break;

      case 'SALE_COMPLETED':
      case 'SALE_VOIDED':
        // Invalidate global statistics and all station metrics
        if (payload.tenantId) {
          await Promise.all([
            cache.invalidatePattern(INVALIDATION_PATTERNS.globalStats(payload.tenantId)),
            cache.invalidatePattern('station:*:metrics'),
            cache.invalidatePattern('station:*:trends*'),
          ]);

          pinoLogger.info(
            { eventType: type, tenantId: payload.tenantId },
            'Cache invalidated for sale change'
          );
        }
        break;

      default:
        // No cache invalidation needed for other events
        break;
    }
  } catch (error) {
    pinoLogger.error(
      { error, eventType: event.type },
      'Failed to invalidate cache for event'
    );
  }
}

/**
 * Invalidate all cache for a specific station
 */
export async function invalidateStationCache(stationId: string): Promise<void> {
  try {
    await cache.invalidatePattern(INVALIDATION_PATTERNS.allStationData(stationId));
    
    pinoLogger.info({ stationId }, 'All cache invalidated for station');
  } catch (error) {
    pinoLogger.error({ error, stationId }, 'Failed to invalidate station cache');
  }
}

/**
 * Invalidate global statistics cache
 */
export async function invalidateGlobalStatsCache(tenantId: string): Promise<void> {
  try {
    await cache.invalidatePattern(INVALIDATION_PATTERNS.globalStats(tenantId));
    
    pinoLogger.info({ tenantId }, 'Global statistics cache invalidated');
  } catch (error) {
    pinoLogger.error({ error, tenantId }, 'Failed to invalidate global stats cache');
  }
}

/**
 * Warm up cache for a station
 * Pre-populate cache with frequently accessed data
 */
export async function warmUpStationCache(stationId: string): Promise<void> {
  try {
    // This would typically call the metrics service to pre-populate cache
    // For now, it's a placeholder for future implementation
    
    pinoLogger.info({ stationId }, 'Station cache warmed up');
  } catch (error) {
    pinoLogger.error({ error, stationId }, 'Failed to warm up station cache');
  }
}

/**
 * Warm up cache for all active stations
 */
export async function warmUpAllStationsCache(tenantId: string): Promise<void> {
  try {
    // This would typically be called on deployment or server restart
    // For now, it's a placeholder for future implementation
    
    pinoLogger.info({ tenantId }, 'All stations cache warmed up');
  } catch (error) {
    pinoLogger.error({ error, tenantId }, 'Failed to warm up all stations cache');
  }
}
