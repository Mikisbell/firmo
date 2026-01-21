/**
 * GET /api/admin/analytics/top-products
 * Returns top selling products for the current business date
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getTopProducts } from '@/src/core/analytics/analytics.service';
import { TopProductsQuerySchema } from '@/src/core/admin/schemas/analytics.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_top_products' }, 'Getting top products');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = TopProductsQuerySchema.parse(queryParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'analytics:top-products',
      validatedQuery.limit ?? 10,
      validatedQuery.date_from ?? 'all',
      validatedQuery.date_to ?? 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_top_products_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Top products retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get metrics from service
    const serviceStart = Date.now();
    const products = await getTopProducts(
      TENANT_ID, 
      validatedQuery.limit ?? 10,
      validatedQuery.date_from,
      validatedQuery.date_to
    );
    logPerformance('service_get_top_products', Date.now() - serviceStart);

    // Cache for 2 minutes
    await cache.set(cacheKey, products, 120);

    // Record business metrics
    metrics.increment('analytics_top_products_requests_total', {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_top_products_success',
      productsCount: products.length,
      limit: validatedQuery.limit,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Top products retrieved successfully');

    return NextResponse.json(products);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_top_products_validation_error',
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
      operation: 'get_top_products_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get top products');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
