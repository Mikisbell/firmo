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
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { DashboardService } from '@/src/core/services/dashboard.service';


export interface DashboardStats {
  salesToday: number;
  salesYesterday: number;
  deltaPercent: number;
  activeOrders: number;
  terminalsOnline: number;
  totalProducts: number;
  alerts: Alert[];
  recentActivity: Activity[];
  syncStatus: {
    synced: boolean;
    pendingEvents: number;
  };
  lastUpdated: string;
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  type: 'order' | 'product' | 'employee' | 'terminal';
  message: string;
  timestamp: string;
  icon: string;
}

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
    log.info({ operation: 'get_dashboard_stats' }, 'Getting dashboard stats');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    // Generate cache key with tenantId
    const cacheKey = generateCacheKey('dashboard:stats', tenantId, 'today');

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
    const yesterday = new Date(businessDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get all stats in parallel with tenantId from JWT
    const dbStart = Date.now();
    const [salesResult, salesYesterday, activeOrders, terminalsOnline, terminalsOffline, totalProducts, outOfStockProducts, pendingEvents] = await Promise.all([
      // Today's sales
      prisma.orders.aggregate({
        where: {
          tenant_id: tenantId,
          business_date: new Date(businessDate),
          order_status: 'CONFIRMED',
        },
        _sum: { total_cents: true },
      }).catch(() => ({ _sum: { total_cents: 0 } })),
      
      // Yesterday's sales
      prisma.orders.aggregate({
        where: {
          tenant_id: tenantId,
          business_date: yesterday,
          order_status: 'CONFIRMED',
        },
        _sum: { total_cents: true },
      }).catch(() => ({ _sum: { total_cents: 0 } })),
      
      // Active orders
      prisma.orders.count({
        where: {
          tenant_id: tenantId,
          order_status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }).catch(() => 0),
      
      // Terminals online (last 5 minutes)
      prisma.terminals.count({
        where: {
          tenant_id: tenantId,
          is_allowed: true,
          last_seen_at: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }).catch(() => 0),
      
      // Terminals offline (last seen > 2 hours ago)
      prisma.terminals.findMany({
        where: {
          tenant_id: tenantId,
          is_allowed: true,
          last_seen_at: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        select: { terminal_id: true, last_seen_at: true },
        take: 5,
      }).catch(() => []),
      
      // Total active products
      prisma.products.count({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
      }).catch(() => 0),
      
      // Out of stock products
      prisma.products.findMany({
        where: {
          tenant_id: tenantId,
          is_active: false,
        },
        select: { name: true },
        take: 3,
      }).catch(() => []),
      
      // Pending events (from outbox)
      prisma.event_outbox.count({
        where: {
          tenant_id: tenantId,
          published_at: null,
        },
      }).catch(() => 0),
    ]);
    logPerformance('db_query_dashboard_stats', Date.now() - dbStart);
    
    // Calculate delta
    const salesTodayValue = salesResult._sum?.total_cents || 0;
    const salesYesterdayValue = salesYesterday._sum?.total_cents || 0;
    const deltaPercent = salesYesterdayValue > 0 
      ? ((salesTodayValue - salesYesterdayValue) / salesYesterdayValue) * 100 
      : 0;
    
    // Build alerts
    const alerts: Alert[] = [];
    
    // Terminal offline alerts
    terminalsOffline.forEach(terminal => {
      if (!terminal.last_seen_at) return; // Skip if no last_seen_at
      const hoursOffline = Math.floor((Date.now() - new Date(terminal.last_seen_at).getTime()) / (1000 * 60 * 60));
      alerts.push({
        id: `terminal-${terminal.terminal_id}`,
        type: 'warning',
        message: `Terminal ${terminal.terminal_id} offline hace ${hoursOffline} horas`,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Out of stock alerts
    outOfStockProducts.forEach(product => {
      alerts.push({
        id: `stock-${product.name}`,
        type: 'warning',
        message: `${product.name} agotado`,
        timestamp: new Date().toISOString(),
      });
    });
    
    // Sync status alert
    if (pendingEvents > 10) {
      alerts.push({
        id: 'sync-pending',
        type: 'warning',
        message: `${pendingEvents} eventos pendientes de sincronizar`,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Recent activity - populated by DashboardService below
    let recentActivity: any[] = [];
    
    // E4: Enhanced KPIs
    let enhancedKPIs: any = {};
    try {
      const dashboardService = new DashboardService(prisma);
      const [kpiResult, activityResult] = await Promise.all([
        dashboardService.getDailyKPIs(tenantId, new Date(businessDate)),
        dashboardService.getRecentActivity(tenantId, 5),
      ]);
      if (kpiResult.success) {
        enhancedKPIs = {
          ordersCountToday: kpiResult.data.ordersCount,
          avgTicketCents: kpiResult.data.avgTicketCents,
          topProducts: kpiResult.data.topProducts,
          paymentBreakdown: kpiResult.data.paymentBreakdown,
          hourlySales: kpiResult.data.hourlySales,
        };
      }
      if (activityResult.success) {
        recentActivity = activityResult.data;
      }
    } catch {
      // Non-critical — continue with existing stats
    }

    const stats: DashboardStats = {
      salesToday: salesTodayValue,
      salesYesterday: salesYesterdayValue,
      deltaPercent: Math.round(deltaPercent * 10) / 10,
      activeOrders,
      terminalsOnline,
      totalProducts,
      alerts: alerts.slice(0, 5), // Max 5 alerts
      recentActivity,
      syncStatus: {
        synced: pendingEvents === 0,
        pendingEvents,
      },
      lastUpdated: new Date().toISOString(),
      ...enhancedKPIs,
    };

    // Cache for 30 seconds (dashboard needs fresh data)
    await cache.set(cacheKey, stats, { ttl: 30, tags: ['dashboard'] });

    // Record business metrics with tenantId from JWT
    metrics.increment('dashboard_stats_requests_total', {
      tenant_id: tenantId,
    });
    metrics.set('dashboard_sales_today', stats.salesToday, {
      tenant_id: tenantId,
    });
    metrics.set('dashboard_active_orders', stats.activeOrders, {
      tenant_id: tenantId,
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
