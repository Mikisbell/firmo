/**
 * Cache Key Patterns for KDS Stations
 * 
 * Centralized cache key generation for consistent caching
 * 
 * Requirements: PR 3.4.6
 */

/**
 * Cache TTL values (in seconds)
 */
export const CACHE_TTL = {
  METRICS: 5 * 60, // 5 minutes
  ORDERS: 30, // 30 seconds
  ALERTS: 2 * 60, // 2 minutes
  TRENDS: 60 * 60, // 1 hour
  HEATMAP: 24 * 60 * 60, // 1 day
  COMPARISON: 15 * 60, // 15 minutes
} as const;

/**
 * Generate cache key for station metrics
 */
export function getMetricsCacheKey(stationId: string): string {
  return `station:${stationId}:metrics`;
}

/**
 * Generate cache key for station orders
 */
export function getOrdersCacheKey(stationId: string, page: number = 1): string {
  return `station:${stationId}:orders:page:${page}`;
}

/**
 * Generate cache key for station alerts
 */
export function getAlertsCacheKey(stationId?: string, severity?: string): string {
  if (stationId && severity) {
    return `station:${stationId}:alerts:${severity}`;
  }
  if (stationId) {
    return `station:${stationId}:alerts`;
  }
  return 'stations:alerts:all';
}

/**
 * Generate cache key for station trends
 */
export function getTrendsCacheKey(
  stationId: string,
  metric: string,
  period: string
): string {
  return `station:${stationId}:trends:${metric}:${period}`;
}

/**
 * Generate cache key for station heatmap
 */
export function getHeatmapCacheKey(
  stationId: string,
  days: number,
  metric: string
): string {
  return `station:${stationId}:heatmap:${days}d:${metric}`;
}

/**
 * Generate cache key for station comparison
 */
export function getComparisonCacheKey(
  stationIds: string[],
  period: string
): string {
  const sortedIds = [...stationIds].sort().join(',');
  return `stations:compare:${sortedIds}:${period}`;
}

/**
 * Generate cache key for global statistics
 */
export function getGlobalStatsCacheKey(tenantId: string): string {
  return `tenant:${tenantId}:stations:global-stats`;
}

/**
 * Cache invalidation patterns
 */
export const INVALIDATION_PATTERNS = {
  /**
   * Invalidate all metrics for a station
   */
  stationMetrics: (stationId: string) => `station:${stationId}:metrics*`,
  
  /**
   * Invalidate all orders for a station
   */
  stationOrders: (stationId: string) => `station:${stationId}:orders*`,
  
  /**
   * Invalidate all alerts for a station
   */
  stationAlerts: (stationId: string) => `station:${stationId}:alerts*`,
  
  /**
   * Invalidate all trends for a station
   */
  stationTrends: (stationId: string) => `station:${stationId}:trends*`,
  
  /**
   * Invalidate all heatmaps for a station
   */
  stationHeatmaps: (stationId: string) => `station:${stationId}:heatmap*`,
  
  /**
   * Invalidate all comparisons involving a station
   */
  stationComparisons: (stationId: string) => `stations:compare:*${stationId}*`,
  
  /**
   * Invalidate all station-related cache
   */
  allStationData: (stationId: string) => `station:${stationId}:*`,
  
  /**
   * Invalidate global statistics
   */
  globalStats: (tenantId: string) => `tenant:${tenantId}:stations:global-stats`,
  
  /**
   * Invalidate all alerts
   */
  allAlerts: () => 'stations:alerts:*',
} as const;
