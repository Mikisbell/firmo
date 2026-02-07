/**
 * GET /api/admin/delivery/metrics - Métricas de delivery de hoy
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { DeliveryMetricsService } from '@/src/core/delivery';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    log.info({ operation: 'get_delivery_metrics' }, 'Getting delivery metrics');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    // Generate cache key with tenantId
    const cacheKey = generateCacheKey('delivery:metrics', tenantId, 'today');

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_delivery_metrics_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Delivery metrics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service with tenantId from JWT
    const serviceStart = Date.now();
    const deliveryMetrics = await DeliveryMetricsService.getTodayMetrics(tenantId);
    logPerformance('service_get_delivery_metrics', Date.now() - serviceStart);

    // Cache for 2 minutes
    await cache.set(cacheKey, deliveryMetrics, 120);

    // Record business metrics with tenantId from JWT
    metrics.increment('delivery_metrics_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_delivery_metrics_success',
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Delivery metrics retrieved successfully');

    return NextResponse.json(deliveryMetrics);
  } catch (error) {
    log.error({
      operation: 'get_delivery_metrics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get delivery metrics');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
