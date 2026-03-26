/**
 * Sales Reports API
 * Requirements: 9.2, 9.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { ReportsQuerySchema } from '@/src/core/admin/schemas/reports.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';


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
    log.info({ operation: 'get_reports' }, 'Getting reports');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = ReportsQuerySchema.parse(queryParams);
    const period = validatedQuery.period ?? 'daily';

    // Generate cache key with tenantId
    const cacheKey = generateCacheKey('reports', tenantId, period);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_reports_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Reports retrieved from cache');
      return NextResponse.json(cached);
    }
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default: // daily
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    // Get orders in period with tenantId from JWT
    const dbStart = Date.now();
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: startDate },
        order_status: 'CONFIRMED',
      },
      select: {
        total_cents: true,
        discount_cents: true,
        checks: true,
      },
    });
    logPerformance('db_query_reports', Date.now() - dbStart, {
      ordersCount: orders.length,
      period,
    });
    
    // Calculate totals
    let salesNet = 0;
    let discounts = 0;
    let tips = 0;
    const paymentTotals: Record<string, number> = {};
    
    for (const order of orders) {
      salesNet += order.total_cents;
      discounts += order.discount_cents;
      
      // Parse checks for payment methods and tips
      const checks = order.checks as Array<{ payments?: Array<{ method: string; amount_cents: number }>; tip_cents?: number }>;
      if (Array.isArray(checks)) {
        for (const check of checks) {
          tips += check.tip_cents || 0;
          if (check.payments) {
            for (const payment of check.payments) {
              paymentTotals[payment.method] = (paymentTotals[payment.method] || 0) + payment.amount_cents;
            }
          }
        }
      }
    }

    const response = {
      period,
      sales_net: salesNet,
      discounts,
      tips,
      order_count: orders.length,
      by_payment_method: Object.entries(paymentTotals).map(([method, total]) => ({ method, total })),
    };

    // Cache for 5 minutes with tag for proper invalidation
    await cache.set(cacheKey, response, { ttl: 300, tags: ['reports'] });

    // Record business metrics with tenantId from JWT
    metrics.increment('reports_requests_total', {
      tenant_id: tenantId,
      period,
    });

    log.info({
      operation: 'get_reports_success',
      period,
      ordersCount: orders.length,
      salesNet,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Reports retrieved successfully');
    
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_reports_validation_error',
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
      operation: 'get_reports_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get reports');
    
    return NextResponse.json({ error: 'Error al obtener reporte' }, { status: 500 });
  }
}

export const GET = withRequestLogging(handleGET);
