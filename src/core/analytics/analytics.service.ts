/**
 * Analytics Service
 * Calcula métricas del negocio desde proyecciones de órdenes
 */

import prisma from '@/src/core/db/prisma';
import { getCurrentBusinessDate, getBusinessDate } from '@/src/core/utils/business-date';
import { unsafeCentavos, type Centavos } from '@/src/core/types/shared';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('analytics');
import type {
  RealtimeMetrics,
  StationMetrics,
  ComparisonMetrics,
  TopProduct,
  HourlySales,
  PaymentMethod,
} from './types';

const STATIONS = ['PARRILLA', 'COCINA', 'HORNO', 'BAR', 'FRIOS'] as const;
const MAX_STATION_CAPACITY = 15; // Max concurrent orders per station
// Cache TTL: 5 minutos para tests E2E (antes: 30 segundos)
// En tests E2E, los datos no cambian frecuentemente, podemos cachear por más tiempo
const CACHE_TTL_MS = process.env.NODE_ENV === 'test' ? 5 * 60 * 1000 : 30_000;

function getCacheKey(tenantId: string, shiftId?: string): string {
  return shiftId ? `realtime:${tenantId}:${shiftId}` : `realtime:${tenantId}:current`;
}

/**
 * Get cached metrics from database (works across serverless instances)
 */
async function getFromDbCache(tenantId: string, cacheKey: string): Promise<RealtimeMetrics | null> {
  try {
    const cached = await prisma.analytics_cache.findUnique({
      where: { 
        tenant_id_cache_key: {
          tenant_id: tenantId,
          cache_key: cacheKey,
        }
      },
    });
    
    if (cached && cached.expires_at && new Date(cached.expires_at) > new Date()) {
      return cached.metrics as unknown as RealtimeMetrics;
    }
    return null;
  } catch {
    // Cache miss or error - proceed to calculate
    return null;
  }
}

/**
 * Store metrics in database cache
 */
async function setDbCache(tenantId: string, cacheKey: string, data: RealtimeMetrics): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const metricsJson = JSON.parse(JSON.stringify(data)); // Ensure valid JSON
    
    await prisma.analytics_cache.upsert({
      where: { 
        tenant_id_cache_key: {
          tenant_id: tenantId,
          cache_key: cacheKey,
        }
      },
      create: {
        tenant_id: tenantId,
        cache_key: cacheKey,
        metrics: metricsJson,
        expires_at: expiresAt,
      },
      update: {
        metrics: metricsJson,
        expires_at: expiresAt,
      },
    });
  } catch (e) {
    // Non-critical - log and continue
    log.warn('Error al cachear métricas', { error: String(e) });
  }
}

export async function getRealtimeMetrics(
  tenantId: string,
  shiftId?: string
): Promise<RealtimeMetrics> {
  const cacheKey = getCacheKey(tenantId, shiftId);
  
  // Check DB cache first (works across serverless instances)
  const cached = await getFromDbCache(tenantId, cacheKey);
  if (cached) {
    return cached;
  }

  const businessDate = getCurrentBusinessDate();
  const targetShiftId = shiftId || await getCurrentShiftId(tenantId);

  // Convert business_date string to DateTime for Prisma
  const businessDateTime = new Date(`${businessDate}T00:00:00.000Z`);

  // Get paid orders for the shift/date
  const orders = await prisma.orders.findMany({
    where: {
      tenant_id: tenantId,
      business_date: businessDateTime,
      ...(targetShiftId ? { shift_id: targetShiftId } : {}),
      order_status: 'CLOSED',
    },
    select: {
      id: true,
      total_cents: true,
      checks: true,
      items: true,
      table_id: true,
      created_at: true,
      updated_at: true,
    },
  });

  // Calculate sales metrics
  let totalSalesCents = 0;
  const salesByMethod: Record<PaymentMethod, Centavos> = {
    CASH: unsafeCentavos(0),
    YAPE: unsafeCentavos(0),
    PLIN: unsafeCentavos(0),
    CARD: unsafeCentavos(0),
    TRANSFER: unsafeCentavos(0),
  };

  for (const order of orders) {
    const checks = order.checks as Array<{
      status: string;
      payments?: Array<{ method: string; amount_cents: number }>;
    }>;
    
    for (const check of checks) {
      if (check.status === 'PAID' && check.payments) {
        for (const payment of check.payments) {
          const method = payment.method as PaymentMethod;
          if (method in salesByMethod) {
            salesByMethod[method] = unsafeCentavos(salesByMethod[method] + payment.amount_cents);
            totalSalesCents += payment.amount_cents;
          }
        }
      }
    }
  }

  const ordersCount = orders.length;
  const avgTicketCents = ordersCount > 0 ? Math.round(totalSalesCents / ordersCount) : 0;

  // Table metrics
  const tables = await prisma.tables.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { status: true },
  });
  
  const tablesOccupied = tables.filter(t => t.status === 'OCCUPIED').length;
  const tablesFree = tables.filter(t => t.status === 'AVAILABLE').length;

  // Calculate turnover (orders per table)
  const uniqueTables = new Set(orders.filter(o => o.table_id).map(o => o.table_id));
  const tableTurnover = tablesOccupied > 0 
    ? Math.round((uniqueTables.size / tablesOccupied) * 10) / 10 
    : 0;

  // Service time (avg time from created to closed)
  let totalServiceMinutes = 0;
  for (const order of orders) {
    const diffMs = new Date(order.updated_at).getTime() - new Date(order.created_at).getTime();
    totalServiceMinutes += diffMs / 60000;
  }
  const avgServiceTimeMinutes = ordersCount > 0 
    ? Math.round(totalServiceMinutes / ordersCount) 
    : 0;

  // Orders per hour
  const hoursOpen = 8; // Assume 8 hour shift
  const ordersPerHour = Math.round((ordersCount / hoursOpen) * 10) / 10;

  // Station metrics
  const stations = await getStationMetrics(tenantId);

  const metrics: RealtimeMetrics = {
    total_sales_cents: unsafeCentavos(totalSalesCents),
    orders_count: ordersCount,
    avg_ticket_cents: unsafeCentavos(avgTicketCents),
    sales_by_payment_method: salesByMethod,
    tables_occupied: tablesOccupied,
    tables_free: tablesFree,
    table_turnover: tableTurnover,
    avg_service_time_minutes: avgServiceTimeMinutes,
    orders_per_hour: ordersPerHour,
    stations,
    shift_id: targetShiftId,
    business_date: businessDate,
    last_updated: new Date().toISOString(),
  };

  // Cache the result in DB (works across serverless instances)
  await setDbCache(tenantId, cacheKey, metrics);

  return metrics;
}

export async function getStationMetrics(tenantId: string): Promise<StationMetrics[]> {
  const businessDate = getCurrentBusinessDate();

  // Convert business_date string to DateTime for Prisma
  const businessDateTime = new Date(`${businessDate}T00:00:00.000Z`);

  // Fetch estimated_time per station for efficiency calculation
  const stationConfigs = await prisma.stations.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { code: true, estimated_time: true },
  });
  const estimatedTimeByStation: Record<string, number> = {};
  for (const sc of stationConfigs) {
    estimatedTimeByStation[sc.code] = sc.estimated_time;
  }

  // El universo de órdenes se preserva igual que antes: órdenes del business_date
  // actual cuyo fulfillment todavía está en cocina (COOKING / PARTIALLY_READY).
  // OJO (trap [[architecture/order-item-status-trap]]): el JSON `orders.items[].status`
  // queda CONGELADO en la creación (PENDING) y nunca refleja COOKING/READY. La verdad
  // VIVA del status del item y de sus timestamps de lifecycle vive en la proyección
  // `order_item_projections`, así que los items de cada estación se leen de ahí.
  const orders = await prisma.orders.findMany({
    where: {
      tenant_id: tenantId,
      business_date: businessDateTime,
      fulfillment_status: { in: ['COOKING', 'PARTIALLY_READY'] },
    },
    select: {
      id: true,
    },
  });

  const stationData: Record<string, {
    pending: number;
    prepTimes: number[];
    onTimeCount: number;
    completedCount: number;
    oldestMinutes: number | null;
  }> = {};

  // Initialize stations
  for (const station of STATIONS) {
    stationData[station] = { pending: 0, prepTimes: [], onTimeCount: 0, completedCount: 0, oldestMinutes: null };
  }

  const now = Date.now();

  // Sin órdenes activas no hay items que proyectar — evita un IN () vacío.
  if (orders.length === 0) {
    return STATIONS.map((station) => buildStationMetric(station, stationData[station]));
  }

  const orderIds = orders.map((o) => o.id);

  // Items VIVOS por estación, filtrados SIEMPRE por tenant (server-side) y acotados al
  // mismo universo de órdenes activas. Un solo findMany sobre la proyección (edge-safe,
  // sin pg/ioredis crudo). El índice [tenant_id, station, status] cubre este acceso.
  const liveItems = await prisma.order_item_projections.findMany({
    where: {
      tenant_id: tenantId,
      order_id: { in: orderIds },
    },
    select: {
      station: true,
      status: true,
      created_at: true,
      submitted_at: true,
      ready_at: true,
    },
  });

  for (const item of liveItems) {
    const station = item.station;
    if (!stationData[station]) continue;

    if (item.status === 'PENDING' || item.status === 'COOKING') {
      stationData[station].pending++;

      // Edad del item pending más antiguo, según created_at de la proyección.
      const ageMinutes = Math.round((now - new Date(item.created_at).getTime()) / 60000);
      if (stationData[station].oldestMinutes === null || ageMinutes > stationData[station].oldestMinutes) {
        stationData[station].oldestMinutes = ageMinutes;
      }
    }

    // Prep time y eficiencia de items completados (READY).
    // NOTA: order_item_projections NO tiene started_cooking_at; usamos submitted_at como
    // proxy del inicio de preparación -> prep = ready_at - submitted_at (solo items con
    // ambos timestamps presentes). Es la mejor señal viva disponible en la proyección.
    if (item.status === 'READY' && item.submitted_at && item.ready_at) {
      const prepTime = (new Date(item.ready_at).getTime() - new Date(item.submitted_at).getTime()) / 60000;
      stationData[station].prepTimes.push(prepTime);
      stationData[station].completedCount++;
      const estimated = estimatedTimeByStation[station] ?? 10;
      if (prepTime <= estimated) {
        stationData[station].onTimeCount++;
      }
    }
  }

  return STATIONS.map((station) => buildStationMetric(station, stationData[station]));
}

/**
 * Construye la métrica de salida de una estación a partir de sus contadores agregados.
 * Centraliza la forma del retorno (mismos campos que consume el endpoint/dashboard)
 * para no duplicar la lógica entre el camino normal y el early-return sin órdenes.
 */
function buildStationMetric(
  station: string,
  data: { pending: number; prepTimes: number[]; onTimeCount: number; completedCount: number; oldestMinutes: number | null }
): StationMetrics {
  const avgPrepTime = data.prepTimes.length > 0
    ? Math.round((data.prepTimes.reduce((a, b) => a + b, 0) / data.prepTimes.length) * 10) / 10
    : 0;
  const efficiency = data.completedCount > 0
    ? Math.round((data.onTimeCount / data.completedCount) * 100)
    : 100;
  const load = Math.min(100, Math.round((data.pending / MAX_STATION_CAPACITY) * 100));

  return {
    station,
    pending_items: data.pending,
    avg_prep_time_minutes: avgPrepTime,
    oldest_item_minutes: data.oldestMinutes,
    has_alert: data.pending > 10,
    efficiency,
    load,
  };
}

export async function getTopProducts(
  tenantId: string,
  limit: number = 5
): Promise<TopProduct[]> {
  const businessDate = getCurrentBusinessDate();

  // Convert business_date string to DateTime for Prisma
  const businessDateTime = new Date(`${businessDate}T00:00:00.000Z`);

  const orders = await prisma.orders.findMany({
    where: {
      tenant_id: tenantId,
      business_date: businessDateTime,
      order_status: 'CLOSED',
    },
    select: {
      items: true,
    },
  });

  // Aggregate by product
  const productMap = new Map<string, {
    sku: string;
    name: string;
    qty: number;
    revenue: number;
  }>();

  for (const order of orders) {
    const items = order.items as Array<{
      product_id: string;
      sku: string;
      name: string;
      qty: number;
      unit_price_cents: number;
    }>;

    for (const item of items) {
      const existing = productMap.get(item.product_id);
      if (existing) {
        existing.qty += item.qty;
        existing.revenue += item.qty * item.unit_price_cents;
      } else {
        productMap.set(item.product_id, {
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          revenue: item.qty * item.unit_price_cents,
        });
      }
    }
  }

  // Sort by qty, then by revenue
  const sorted = Array.from(productMap.entries())
    .sort((a, b) => {
      if (b[1].qty !== a[1].qty) return b[1].qty - a[1].qty;
      return b[1].revenue - a[1].revenue;
    })
    .slice(0, limit);

  return sorted.map(([productId, data]) => ({
    product_id: productId,
    sku: data.sku,
    name: data.name,
    qty_sold: data.qty,
    revenue_cents: unsafeCentavos(data.revenue),
  }));
}

export async function getComparison(tenantId: string): Promise<ComparisonMetrics> {
  const current = await getRealtimeMetrics(tenantId);
  
  // Get metrics from same day last week
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  lastWeekDate.setHours(6, 0, 0, 0); // Business date cutoff
  
  // Convert Date to business_date string format (YYYY-MM-DD)
  const lastWeekBusinessDate = getBusinessDate(lastWeekDate);
  
  // Convert business_date string to DateTime for Prisma
  const lastWeekBusinessDateTime = new Date(`${lastWeekBusinessDate}T00:00:00.000Z`);

  const previousOrders = await prisma.orders.findMany({
    where: {
      tenant_id: tenantId,
      business_date: lastWeekBusinessDateTime,
      order_status: 'CLOSED',
    },
    select: {
      total_cents: true,
      checks: true,
    },
  });

  // Calculate previous metrics
  let prevTotalSales = 0;
  for (const order of previousOrders) {
    const checks = order.checks as Array<{
      status: string;
      payments?: Array<{ amount_cents: number }>;
    }>;
    for (const check of checks) {
      if (check.status === 'PAID' && check.payments) {
        for (const payment of check.payments) {
          prevTotalSales += payment.amount_cents;
        }
      }
    }
  }

  const prevOrdersCount = previousOrders.length;
  const prevAvgTicket = prevOrdersCount > 0 ? Math.round(prevTotalSales / prevOrdersCount) : 0;

  // Build previous metrics (simplified)
  const previous: RealtimeMetrics = {
    ...current,
    total_sales_cents: unsafeCentavos(prevTotalSales),
    orders_count: prevOrdersCount,
    avg_ticket_cents: unsafeCentavos(prevAvgTicket),
  };

  // Calculate deltas
  const calcDelta = (curr: number, prev: number): number => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
  };

  return {
    current,
    previous,
    delta_percent: {
      total_sales: calcDelta(current.total_sales_cents, prevTotalSales),
      orders_count: calcDelta(current.orders_count, prevOrdersCount),
      avg_ticket: calcDelta(current.avg_ticket_cents, prevAvgTicket),
    },
  };
}

export async function getHourlySales(tenantId: string): Promise<HourlySales[]> {
  const businessDate = getCurrentBusinessDate();

  // Convert business_date string to DateTime for Prisma
  const businessDateTime = new Date(`${businessDate}T00:00:00.000Z`);

  const orders = await prisma.orders.findMany({
    where: {
      tenant_id: tenantId,
      business_date: businessDateTime,
      order_status: 'CLOSED',
    },
    select: {
      created_at: true,
      checks: true,
    },
  });

  // Initialize hours (typically 11am - 11pm for restaurant)
  const hourlyData: Record<number, { sales: number; count: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyData[h] = { sales: 0, count: 0 };
  }

  for (const order of orders) {
    const hour = new Date(order.created_at).getHours();
    hourlyData[hour].count++;

    const checks = order.checks as Array<{
      status: string;
      payments?: Array<{ amount_cents: number }>;
    }>;
    for (const check of checks) {
      if (check.status === 'PAID' && check.payments) {
        for (const payment of check.payments) {
          hourlyData[hour].sales += payment.amount_cents;
        }
      }
    }
  }

  return Object.entries(hourlyData)
    .filter(([, data]) => data.count > 0)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      sales_cents: unsafeCentavos(data.sales),
      orders_count: data.count,
    }));
}

export async function invalidateCache(tenantId: string): Promise<void> {
  try {
    // Delete all cache entries for this tenant
    await prisma.analytics_cache.deleteMany({
      where: {
        tenant_id: tenantId,
      },
    });
  } catch (e) {
    log.warn('Error al invalidar caché', { error: String(e) });
  }
}

async function getCurrentShiftId(tenantId: string): Promise<string | null> {
  const shift = await prisma.shifts.findFirst({
    where: {
      tenant_id: tenantId,
      status: 'OPEN',
    },
    select: { id: true },
    orderBy: { opened_at: 'desc' },
  });
  return shift?.id ?? null;
}
