/**
 * Tenant Analytics and Monitoring
 * 
 * Tracks tenant health, usage patterns, and system metrics.
 * Provides dashboards and alerts for system administrators.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
 */

import { prisma } from '@/core/db/prisma';
import { randomUUID } from 'crypto';

/**
 * Daily metrics for a tenant
 */
export interface TenantMetrics {
  tenant_id: string;
  date: string;
  active_terminals: number;
  total_orders: number;
  total_events: number;
  total_revenue_cents: number;
  avg_order_value_cents: number;
  peak_orders_per_hour: number;
  sync_errors: number;
  api_errors: number;
  storage_mb: number;
}

/**
 * Health check result
 */
export interface HealthCheck {
  type: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

/**
 * Tenant health status
 */
export interface TenantHealthStatus {
  tenant_id: string;
  overall_status: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
  last_checked: Date;
}

/**
 * Count active terminals for a tenant on a given date
 * 
 * @param tenant_id - ID of the tenant
 * @param date - Date in YYYY-MM-DD format
 * @returns Number of active terminals
 */
async function countActiveTerminals(tenant_id: string, date: string): Promise<number> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  const count = await prisma.events.findMany({
    where: {
      tenant_id,
      occurred_at: {
        gte: dateObj,
        lt: nextDate,
      },
    },
    distinct: ['terminal_id'],
  });

  return count.length;
}

/**
 * Count orders for a tenant on a given date
 * 
 * @param tenant_id - ID of the tenant
 * @param date - Date in YYYY-MM-DD format
 * @returns Order count and peak orders per hour
 */
async function countOrders(
  tenant_id: string,
  date: string
): Promise<{ count: number; peak: number }> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  const orders = await prisma.orders.findMany({
    where: {
      tenant_id,
      created_at: {
        gte: dateObj,
        lt: nextDate,
      },
    },
  });

  // Calculate peak orders per hour
  const hourlyBuckets: Record<number, number> = {};
  for (const order of orders) {
    const hour = order.created_at.getHours();
    hourlyBuckets[hour] = (hourlyBuckets[hour] || 0) + 1;
  }

  const peak = Math.max(...Object.values(hourlyBuckets), 0);

  return {
    count: orders.length,
    peak,
  };
}

/**
 * Count events for a tenant on a given date
 * 
 * @param tenant_id - ID of the tenant
 * @param date - Date in YYYY-MM-DD format
 * @returns Number of events
 */
async function countEvents(tenant_id: string, date: string): Promise<number> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  return await prisma.events.count({
    where: {
      tenant_id,
      occurred_at: {
        gte: dateObj,
        lt: nextDate,
      },
    },
  });
}

/**
 * Calculate revenue for a tenant on a given date
 * 
 * @param tenant_id - ID of the tenant
 * @param date - Date in YYYY-MM-DD format
 * @returns Total and average revenue in cents
 */
async function calculateRevenue(
  tenant_id: string,
  date: string
): Promise<{ total: number; average: number }> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  const orders = await prisma.orders.findMany({
    where: {
      tenant_id,
      created_at: {
        gte: dateObj,
        lt: nextDate,
      },
      order_status: { in: ['COMPLETED', 'PAID'] },
    },
  });

  const total = orders.reduce((sum, order) => sum + (order.total_cents || 0), 0);
  const average = orders.length > 0 ? Math.floor(total / orders.length) : 0;

  return { total, average };
}

/**
 * Count errors for a tenant on a given date
 * 
 * @param tenant_id - ID of the tenant
 * @param date - Date in YYYY-MM-DD format
 * @returns Sync and API error counts
 */
async function countErrors(
  tenant_id: string,
  date: string
): Promise<{ sync: number; api: number }> {
  const dateObj = new Date(date);
  const nextDate = new Date(dateObj);
  nextDate.setDate(nextDate.getDate() + 1);

  const [syncErrors, apiErrors] = await Promise.all([
    prisma.sync_conflicts.count({
      where: {
        tenant_id,
        resolved_at: {
          gte: dateObj,
          lt: nextDate,
        },
      },
    }),
    prisma.admin_access_logs.count({
      where: {
        tenant_id,
        action: 'ERROR',
        created_at: {
          gte: dateObj,
          lt: nextDate,
        },
      },
    }),
  ]);

  return { sync: syncErrors, api: apiErrors };
}

/**
 * Calculate storage usage for a tenant
 * 
 * @param tenant_id - ID of the tenant
 * @returns Storage usage in MB
 */
async function calculateStorage(tenant_id: string): Promise<number> {
  // This is a simplified calculation
  // In production, you'd query actual storage metrics
  const usage = await prisma.tenant_usage.findUnique({
    where: { tenant_id },
  });

  return usage?.storage_mb || 0;
}

/**
 * Collect daily metrics for a tenant
 * 
 * Gathers metrics from various sources and stores them for analytics.
 * 
 * @param tenant_id - ID of the tenant
 * @returns Collected metrics
 */
export async function collectDailyMetrics(tenant_id: string): Promise<TenantMetrics> {
  const today = new Date().toISOString().split('T')[0];

  // Collect metrics from various sources
  const [terminals, orders, events, revenue, errors, storage] = await Promise.all([
    countActiveTerminals(tenant_id, today),
    countOrders(tenant_id, today),
    countEvents(tenant_id, today),
    calculateRevenue(tenant_id, today),
    countErrors(tenant_id, today),
    calculateStorage(tenant_id),
  ]);

  const metrics: TenantMetrics = {
    tenant_id,
    date: today,
    active_terminals: terminals,
    total_orders: orders.count,
    total_events: events,
    total_revenue_cents: revenue.total,
    avg_order_value_cents: revenue.average,
    peak_orders_per_hour: orders.peak,
    sync_errors: errors.sync,
    api_errors: errors.api,
    storage_mb: storage,
  };

  // Store metrics
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: { tenant_id, date: today },
    },
    create: metrics,
    update: metrics,
  });

  return metrics;
}

/**
 * Check tenant health
 * 
 * Performs various health checks and returns overall status.
 * 
 * @param tenant_id - ID of the tenant
 * @returns Health status
 */
export async function checkTenantHealth(tenant_id: string): Promise<TenantHealthStatus> {
  const checks: HealthCheck[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Check 1: Active terminals
  const terminals = await countActiveTerminals(tenant_id, today);
  checks.push({
    type: 'active_terminals',
    status: terminals > 0 ? 'pass' : 'warn',
    message: `${terminals} active terminals`,
  });

  // Check 2: Recent orders
  const recentOrders = await prisma.orders.count({
    where: {
      tenant_id,
      created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  checks.push({
    type: 'recent_orders',
    status: recentOrders > 0 ? 'pass' : 'warn',
    message: `${recentOrders} orders in last 24h`,
  });

  // Check 3: Sync errors
  const syncErrors = await prisma.sync_conflicts.count({
    where: {
      tenant_id,
      severity: 'BLOCKING',
      resolved_at: null,
    },
  });
  checks.push({
    type: 'sync_errors',
    status: syncErrors === 0 ? 'pass' : syncErrors < 5 ? 'warn' : 'fail',
    message: `${syncErrors} unresolved sync conflicts`,
  });

  // Check 4: Storage usage
  const usage = await prisma.tenant_usage.findUnique({ where: { tenant_id } });
  const quota = await prisma.tenant_quotas.findUnique({ where: { tenant_id } });
  const storagePercent = usage && quota ? (usage.storage_mb / quota.max_storage_mb) * 100 : 0;
  checks.push({
    type: 'storage_usage',
    status: storagePercent < 80 ? 'pass' : storagePercent < 95 ? 'warn' : 'fail',
    message: `${storagePercent.toFixed(1)}% storage used`,
  });

  // Determine overall status
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const overall_status = hasFail ? 'critical' : hasWarn ? 'warning' : 'healthy';

  // Store health check results
  for (const check of checks) {
    await prisma.tenant_health_checks.create({
      data: {
        id: randomUUID(),
        tenant_id,
        check_type: check.type,
        status: check.status,
        message: check.message,
        details: check.details,
      },
    });
  }

  return {
    tenant_id,
    overall_status,
    checks,
    last_checked: new Date(),
  };
}

/**
 * Get tenant metrics for a date range
 * 
 * @param tenant_id - ID of the tenant
 * @param start_date - Start date in YYYY-MM-DD format
 * @param end_date - End date in YYYY-MM-DD format
 * @returns Array of metrics for each day
 */
export async function getTenantMetricsRange(
  tenant_id: string,
  start_date: string,
  end_date: string
): Promise<TenantMetrics[]> {
  return await prisma.tenant_analytics.findMany({
    where: {
      tenant_id,
      date: {
        gte: start_date,
        lte: end_date,
      },
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Get recent health checks for a tenant
 * 
 * @param tenant_id - ID of the tenant
 * @param limit - Maximum number of checks to return
 * @returns Recent health checks
 */
export async function getRecentHealthChecks(
  tenant_id: string,
  limit: number = 10
) {
  return await prisma.tenant_health_checks.findMany({
    where: { tenant_id },
    orderBy: { checked_at: 'desc' },
    take: limit,
  });
}
