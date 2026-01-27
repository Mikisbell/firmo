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
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

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
    const yesterday = new Date(businessDate);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get all stats in parallel
    const dbStart = Date.now();
    const [salesResult, salesYesterday, activeOrders, terminalsOnline, terminalsOffline, totalProducts, outOfStockProducts, pendingEvents] = await Promise.all([
      // Today's sales
      prisma.orders.aggregate({
        where: {
          tenant_id: TENANT_ID,
          business_date: new Date(businessDate),
          order_status: 'CONFIRMED',
        },
        _sum: { total_cents: true },
      }).catch(() => ({ _sum: { total_cents: 0 } })),
      
      // Yesterday's sales
      prisma.orders.aggregate({
        where: {
          tenant_id: TENANT_ID,
          business_date: yesterday,
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
      
      // Terminals offline (last seen > 2 hours ago)
      prisma.terminals.findMany({
        where: {
          tenant_id: TENANT_ID,
          is_allowed: true,
          last_seen_at: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        select: { terminal_id: true, last_seen_at: true },
        take: 5,
      }).catch(() => []),
      
      // Total active products
      prisma.products.count({
        where: {
          tenant_id: TENANT_ID,
          is_active: true,
        },
      }).catch(() => 0),
      
      // Out of stock products
      prisma.products.findMany({
        where: {
          tenant_id: TENANT_ID,
          is_active: false,
        },
        select: { name: true },
        take: 3,
      }).catch(() => []),
      
      // Pending events (from outbox)
      prisma.event_outbox.count({
        where: {
          tenant_id: TENANT_ID,
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
    
    // Recent activity (mock for now - would come from audit log)
    const recentActivity: Activity[] = [];
    
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
