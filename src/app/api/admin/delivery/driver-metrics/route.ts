/**
 * GET /api/admin/delivery/driver-metrics - Métricas por motorizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { DeliveryMetricsService } from '@/src/core/delivery';
import { DriverMetricsQuerySchema } from '@/src/core/admin/schemas/delivery.schema';
import { ZodError } from 'zod';
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
    log.info({ operation: 'get_driver_metrics' }, 'Getting driver metrics');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = DriverMetricsQuerySchema.parse(queryParams);

    // Default: últimos 7 días
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const from = validatedQuery.dateFrom || weekAgo.toISOString().split('T')[0];
    const to = validatedQuery.dateTo || today.toISOString().split('T')[0];

    // Generate cache key
    const cacheKey = generateCacheKey('delivery:driver-metrics', from, to);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_driver_metrics_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Driver metrics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service
    const serviceStart = Date.now();
    const driverMetrics = await DeliveryMetricsService.getDriverMetrics(TENANT_ID, from, to);
    logPerformance('service_get_driver_metrics', Date.now() - serviceStart);

    const response = { 
      metrics: driverMetrics, 
      dateFrom: from, 
      dateTo: to 
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, response, 300);

    // Record business metrics
    metrics.increment('driver_metrics_requests_total', {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_driver_metrics_success',
      driversCount: driverMetrics.length,
      dateFrom: from,
      dateTo: to,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Driver metrics retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_driver_metrics_validation_error',
        errors: error.errors,
      }, 'Invalid query parameters');
      
      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'get_driver_metrics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get driver metrics');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
