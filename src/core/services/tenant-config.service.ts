/**
 * Tenant Configuration Service
 * 
 * Manages tenant configuration with caching support.
 * 
 * Cache Integration: Task 9.8
 * - Cache tenant configuration with 5-minute TTL (300s)
 * - Invalidate on configuration updates
 * - Use cache-aside pattern
 */

import prisma from '@/src/core/db/prisma';
import { cache, generateCacheKey, DEFAULT_TTLS } from '@/src/core/cache/cache-service';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';

// ============ TYPES ============

export interface TenantConfiguration {
  tenant_id: string;
  legal_name: string;
  ruc: string | null;
  address_text: string | null;
  logo_url: string | null;
  timezone: string;
  currency: string;
  receipt_footer_text: string | null;
  kds_audio_enabled: boolean;
  kds_audio_volume: number;
  default_delivery_fee_cents: number;
  require_payment_verification: boolean;
  allow_cod: boolean;
  default_payment_expectation: string;
  enable_tips: boolean;
  tips_on_invoice: boolean;
  allow_offline_coupon: boolean;
  max_offline_coupons_per_order: number;
  require_manager_for_offline: boolean;
  onboarding_status: string;
  updated_at: Date;
}

export interface UpdateTenantConfigInput {
  legal_name?: string;
  ruc?: string | null;
  address_text?: string | null;
  logo_url?: string | null;
  timezone?: string;
  currency?: string;
  receipt_footer_text?: string | null;
  kds_audio_enabled?: boolean;
  kds_audio_volume?: number;
  default_delivery_fee_cents?: number;
  require_payment_verification?: boolean;
  allow_cod?: boolean;
  default_payment_expectation?: string;
  enable_tips?: boolean;
  tips_on_invoice?: boolean;
  allow_offline_coupon?: boolean;
  max_offline_coupons_per_order?: number;
  require_manager_for_offline?: boolean;
  onboarding_status?: string;
}

// ============ SERVICE FUNCTIONS ============

/**
 * Get tenant configuration with caching
 * 
 * Cache Strategy:
 * - TTL: 5 minutes (300 seconds)
 * - Cache key: tenant:{tenantId}:config
 * - Tags: tenant:{tenantId}, tenant-config
 * 
 * @param tenantId - Tenant identifier
 * @returns Tenant configuration or null if not found
 */
export async function getTenantConfiguration(tenantId: string): Promise<TenantConfiguration | null> {
  const startTime = Date.now();
  
  // Generate cache key
  const cacheKey = generateCacheKey('tenant', tenantId, 'config');
  
  try {
    // Try cache first (cache-aside pattern)
    const cached = await cache.get<TenantConfiguration>(cacheKey);
    
    if (cached) {
      metrics.increment('cache.hit', { resource: 'tenant-config', backend: cache.getType() });
      metrics.timing('tenant_config.get', Date.now() - startTime, { source: 'cache' });
      
      logger.debug('Tenant configuration retrieved from cache', {
        tenantId,
        cacheKey,
      });
      
      return cached;
    }
    
    metrics.increment('cache.miss', { resource: 'tenant-config', backend: cache.getType() });
    
    // Cache miss - fetch from database
    const config = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    
    if (!config) {
      logger.warn('Tenant configuration not found', { tenantId });
      return null;
    }
    
    // Store in cache with 5-minute TTL
    await cache.set(cacheKey, config, {
      ttl: DEFAULT_TTLS.tenants, // 300 seconds (5 minutes)
      tags: [`tenant:${tenantId}`, 'tenant-config'],
    });
    
    metrics.timing('tenant_config.get', Date.now() - startTime, { source: 'database' });
    
    logger.debug('Tenant configuration retrieved from database and cached', {
      tenantId,
      cacheKey,
    });
    
    return config;
    
  } catch (error) {
    logger.error('Failed to get tenant configuration', error as Error, { tenantId });
    metrics.increment('tenant_config.error', { operation: 'get' });
    throw error;
  }
}

/**
 * Update tenant configuration and invalidate cache
 * 
 * Cache Invalidation:
 * - Invalidates all caches with tag: tenant:{tenantId}
 * - Invalidates all caches with tag: tenant-config
 * 
 * @param tenantId - Tenant identifier
 * @param data - Configuration data to update
 * @returns Updated tenant configuration
 */
export async function updateTenantConfiguration(
  tenantId: string,
  data: UpdateTenantConfigInput
): Promise<TenantConfiguration> {
  const startTime = Date.now();
  
  try {
    // Update in database
    const updated = await prisma.tenant_settings.update({
      where: { tenant_id: tenantId },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
    
    // Invalidate cache using tag-based invalidation
    await cache.deleteByTag(`tenant:${tenantId}`);
    await cache.deleteByTag('tenant-config');
    
    metrics.increment('cache.invalidation', { resource: 'tenant-config', reason: 'update' });
    metrics.timing('tenant_config.update', Date.now() - startTime);
    
    logger.info('Tenant configuration updated and cache invalidated', {
      tenantId,
      updatedFields: Object.keys(data),
    });
    
    return updated;
    
  } catch (error) {
    logger.error('Failed to update tenant configuration', error as Error, { tenantId });
    metrics.increment('tenant_config.error', { operation: 'update' });
    throw error;
  }
}

/**
 * Get multiple tenant configurations (for cross-tenant admin)
 * 
 * Note: This function does not use caching as it's typically used
 * for admin dashboards where fresh data is preferred.
 * 
 * @param tenantIds - Array of tenant identifiers
 * @returns Array of tenant configurations
 */
export async function getTenantConfigurations(tenantIds: string[]): Promise<TenantConfiguration[]> {
  const startTime = Date.now();
  
  try {
    const configs = await prisma.tenant_settings.findMany({
      where: {
        tenant_id: { in: tenantIds },
      },
      orderBy: { legal_name: 'asc' },
    });
    
    metrics.timing('tenant_config.get_multiple', Date.now() - startTime, {
      count: configs.length.toString(),
    });
    
    return configs;
    
  } catch (error) {
    logger.error('Failed to get tenant configurations', error as Error, {
      tenantCount: tenantIds.length,
    });
    metrics.increment('tenant_config.error', { operation: 'get_multiple' });
    throw error;
  }
}

/**
 * Invalidate tenant configuration cache
 * 
 * Useful for manual cache invalidation or bulk operations.
 * 
 * @param tenantId - Tenant identifier
 */
export async function invalidateTenantConfigCache(tenantId: string): Promise<void> {
  try {
    await cache.deleteByTag(`tenant:${tenantId}`);
    await cache.deleteByTag('tenant-config');
    
    metrics.increment('cache.invalidation', { resource: 'tenant-config', reason: 'manual' });
    
    logger.info('Tenant configuration cache invalidated', { tenantId });
    
  } catch (error) {
    logger.error('Failed to invalidate tenant configuration cache', error as Error, { tenantId });
    // Don't throw - cache invalidation failure should not break the application
  }
}
