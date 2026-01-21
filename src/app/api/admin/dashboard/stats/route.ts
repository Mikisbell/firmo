/**
 * Dashboard Stats API
 * Returns real-time metrics for admin dashboard
 * 
 * Requirements: 2.2, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { getBusinessDate } from '@/src/core/utils/business-date';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

export interface DashboardStats {
  salesToday: number;
  activeOrders: number;
  terminalsOnline: number;
  totalProducts: number;
  lastUpdated: string;
}

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_dashboard_stats' }, 'Getting dashboard stats');
    
    // Generate cache key
    const cacheKey = generateCacheKey('dashboard:stats', 'today');

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_dashboard_stats_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Dashboard stats retrieved from cache');
      return NextResponse.json(cached);
    }

    // Check if database is available
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      log.warn({ error: dbError }, 'Database connection error, returning defaults');
      return NextResponse.json({
        salesToday: 0,
        activeOrders: 0,
        terminalsOnline: 0,
        totalProducts: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
    
    const businessDate = getBusinessDate(new Date());
    
    // Get all stats in parallel
    const dbStart = Date.now();
    const [salesResult, activeOrders, terminalsOnline, totalProducts] = await Promise.all([
      // Today's sales
      prisma.orders.aggregate({
        where: {
          tenant_id: TENANT_ID,
          business_date: new Date(businessDate),
          order_status: 'CONFIRMED',
        },
        _sum: { total_cents: true },
      }).catch(() => ({ _sum: { total_cents: 0 } })),
      
      // Active orders
      prisma.orders.count({
        where: {
          tenant_id: TENANT_ID,
          order_status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }).catch(() => 0),
      
      // Terminals online (last 5 minutes)
      prisma.terminals.count({
        where: {
          tenant_id: TENANT_ID,
          is_allowed: true,
          last_seen_at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }).catch(() => 0),
      
      // Total active products
      prisma.products.count({
        where: {
          tenant_id: TENANT_ID,
          is_active: true,
        },
      }).catch(() => 0),
    ]);
    logPerformance('db_query_dashboard_stats', Date.now() - dbStart);
    
    const stats: DashboardStats = {
      salesToday: salesResult._sum?.total_cents || 0,
      activeOrders,
      terminalsOnline,
      totalProducts,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 30 seconds (dashboard needs fresh data)
    await cache.set(cacheKey, stats, 30);

    // Record business metrics
    metrics.increment('dashboard_stats_requests_total', {
      tenant_id: TENANT_ID,
    });
    metrics.set('dashboard_sales_today', stats.salesToday, {
      tenant_id: TENANT_ID,
    });
    metrics.set('dashboard_active_orders', stats.activeOrders, {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_dashboard_stats_success',
      stats,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Dashboard stats retrieved successfully');
    
    return NextResponse.json(stats);
  } catch (error) {
    log.error({
      operation: 'get_dashboard_stats_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get dashboard stats');
    
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
