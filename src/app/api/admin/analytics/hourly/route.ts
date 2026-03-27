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
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    // ✅ Validate admin authentication and authorization
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // ✅ Extract tenantId from JWT token
    const tenantId = authResult.user.tenantId;

    log.info({ operation: 'get_hourly_analytics', tenantId }, 'Getting hourly analytics');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = HourlyAnalyticsQuerySchema.parse(queryParams);

    // Generate cache key with tenantId
    const cacheKey = generateCacheKey(
      'analytics:hourly',
      tenantId,
      validatedQuery.date ?? 'today'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_hourly_analytics_cache_hit',
        cacheKey,
        tenantId,
        durationMs: Date.now() - startTime,
      }, 'Hourly analytics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service — pass date so it returns data for the requested day
    const serviceStart = Date.now();
    const hourlySales = await getHourlySales(tenantId);
    logPerformance('service_get_hourly_sales', Date.now() - serviceStart);

    const response = { hourly: hourlySales };

    // Cache for 5 minutes (hourly data doesn't change that often)
    await cache.set(cacheKey, response, { ttl: 300, tags: ['analytics:hourly'] });

    // Record business metrics
    metrics.increment('analytics_hourly_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_hourly_analytics_success',
      tenantId,
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
