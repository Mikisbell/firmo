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
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_delivery_metrics' }, 'Getting delivery metrics');
    
    // Generate cache key
    const cacheKey = generateCacheKey('delivery:metrics', 'today');

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

    // Get metrics from service
    const serviceStart = Date.now();
    const deliveryMetrics = await DeliveryMetricsService.getTodayMetrics(TENANT_ID);
    logPerformance('service_get_delivery_metrics', Date.now() - serviceStart);

    // Cache for 2 minutes
    await cache.set(cacheKey, deliveryMetrics, 120);

    // Record business metrics
    metrics.increment('delivery_metrics_requests_total', {
      tenant_id: TENANT_ID,
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
