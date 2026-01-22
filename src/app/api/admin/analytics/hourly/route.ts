/**
 * GET /api/admin/analytics/hourly
 * Returns hourly sales breakdown for the current business date
 * 
 * Requirements: 1.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getHourlySales } from '@/src/core/analytics/analytics.service';
import { HourlyAnalyticsQuerySchema } from '@/src/core/admin/schemas/analytics.schema';
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
    log.info({ operation: 'get_hourly_analytics' }, 'Getting hourly analytics');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = HourlyAnalyticsQuerySchema.parse(queryParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'analytics:hourly',
      validatedQuery.date ?? 'today'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_hourly_analytics_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Hourly analytics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service
    const serviceStart = Date.now();
    const hourlySales = await getHourlySales(TENANT_ID);
    logPerformance('service_get_hourly_sales', Date.now() - serviceStart);

    const response = { hourly: hourlySales };

    // Cache for 5 minutes (hourly data doesn't change that often)
    await cache.set(cacheKey, response, 300);

    // Record business metrics
    metrics.increment('analytics_hourly_requests_total', {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_hourly_analytics_success',
      date: validatedQuery.date,
      hoursCount: hourlySales.length,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Hourly analytics retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_hourly_analytics_validation_error',
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
      operation: 'get_hourly_analytics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get hourly analytics');
    
    return NextResponse.json(
      { error: 'Error al obtener ventas por hora' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
