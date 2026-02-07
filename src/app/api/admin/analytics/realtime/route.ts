/**
 * GET /api/admin/analytics/realtime
 * Returns real-time metrics for the current shift/business date
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getRealtimeMetrics } from '@/src/core/analytics/analytics.service';
import { RealtimeAnalyticsQuerySchema } from '@/src/core/admin/schemas/analytics.schema';
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

    log.info({ operation: 'get_realtime_analytics', tenantId }, 'Getting realtime analytics');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = RealtimeAnalyticsQuerySchema.parse(queryParams);

    // Generate cache key with tenantId
    const cacheKey = generateCacheKey(
      'analytics:realtime',
      tenantId,
      validatedQuery.shift_id ?? 'current'
    );

    // Try to get from cache (short TTL for realtime data)
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_realtime_analytics_cache_hit',
        cacheKey,
        tenantId,
        durationMs: Date.now() - startTime,
      }, 'Realtime analytics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service
    const serviceStart = Date.now();
    const analyticsMetrics = await getRealtimeMetrics(tenantId, validatedQuery.shift_id);
    logPerformance('service_get_realtime_metrics', Date.now() - serviceStart);

    // Cache for 10 seconds (realtime data changes frequently)
    await cache.set(cacheKey, analyticsMetrics, 10);

    // Record business metrics
    metrics.increment('analytics_realtime_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_realtime_analytics_success',
      tenantId,
      shiftId: validatedQuery.shift_id,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Realtime analytics retrieved successfully');

    return NextResponse.json(analyticsMetrics);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_realtime_analytics_validation_error',
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
      operation: 'get_realtime_analytics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get realtime analytics');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
