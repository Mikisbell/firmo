/**
 * GET /api/admin/analytics/history
 * Returns historical metrics for a date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import type { RealtimeMetrics } from '@/src/core/analytics/types';
import { asCentavos, type PaymentMethod, type Centavos } from '@/src/core/types/shared';
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
    log.info({ operation: 'get_history_analytics' }, 'Getting history analytics');
    
    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Faltan parámetros de fecha from/to' },
        { status: 400 }
      );
    }

    // Validate date format
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'La fecha from debe ser anterior a la fecha to' },
        { status: 400 }
      );
    }

    // Limit range to 90 days
    const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'El rango de fechas no puede exceder 90 días' },
        { status: 400 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey('analytics:history', from, to);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_history_analytics_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'History analytics retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get daily summaries if available, otherwise calculate from orders
    const dbStart = Date.now();
    const summaries = await prisma.daily_sales_summary.findMany({
      where: {
        tenant_id: TENANT_ID,
        business_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { business_date: 'asc' },
    });
    logPerformance('db_query_history', Date.now() - dbStart, { 
      count: summaries.length,
      days: daysDiff,
    });

    // Convert to RealtimeMetrics format
    const metricsData: Partial<RealtimeMetrics>[] = summaries.map(s => ({
      total_sales_cents: asCentavos(s.net_sales_cents),
      orders_count: s.orders_count,
      avg_ticket_cents: asCentavos(s.orders_count > 0 
        ? Math.round(s.net_sales_cents / s.orders_count) 
        : 0),
      sales_by_payment_method: (s.payments_breakdown as Record<PaymentMethod, Centavos>) || {
        CASH: asCentavos(0), YAPE: asCentavos(0), PLIN: asCentavos(0), CARD: asCentavos(0), TRANSFER: asCentavos(0),
      },
      business_date: s.business_date.toISOString().split('T')[0],
      last_updated: s.created_at.toISOString(),
    }));

    // Cache for 10 minutes (historical data doesn't change)
    await cache.set(cacheKey, metricsData, 600);

    // Record business metrics
    metrics.increment('analytics_history_requests_total', {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_history_analytics_success',
      from,
      to,
      daysCount: summaries.length,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'History analytics retrieved successfully');

    return NextResponse.json(metricsData);
  } catch (error) {
    log.error({
      operation: 'get_history_analytics_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get history analytics');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
