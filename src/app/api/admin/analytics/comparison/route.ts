/**
 * GET /api/admin/analytics/comparison
 * Returns comparison metrics (current vs same day last week)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getComparison } from '@/src/core/analytics/analytics.service';
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

    log.info({ operation: 'get_comparison_analytics', tenantId }, 'Getting comparison analytics');
    
    // Generate cache key with tenantId
    const cacheKey = generateCacheKey('analytics:comparison', tenantId, 'today');

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_comparison_analytics_cache_hit',
        cacheKey,
        tenantId,
        durationMs: Date.now() - startTime,
      }, 'Comparison analytics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service
    const serviceStart = Date.now();
    const comparison = await getComparison(tenantId);
    logPerformance('service_get_comparison', Date.now() - serviceStart);

    // Cache for 5 minutes
    await cache.set(cacheKey, comparison, 300);

    // Record business metrics
    metrics.increment('analytics_comparison_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_comparison_analytics_success',
      tenantId,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Comparison analytics retrieved successfully');

    return NextResponse.json(comparison);
  } catch (error) {
    log.error({
      operation: 'get_comparison_analytics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get comparison analytics');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
