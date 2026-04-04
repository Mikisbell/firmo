/**
 * GET /api/admin/analytics/by-location
 *
 * Returns per-location breakdown of sales metrics.
 * Query params:
 *   - period: 'today' | 'week' | 'month' (default: 'today')
 *   - location_id: UUID (optional — omit for all locations)
 *
 * All money values in centavos (integer).
 *
 * @module app/api/admin/analytics/by-location/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('analytics-by-location');

const querySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
  location_id: z.string().uuid().optional(),
});

interface LocationMetrics {
  locationId: string | null;
  locationName: string;
  metrics: {
    totalOrders: number;
    totalSales: number;
    avgTicket: number;
    topProducts: { name: string; qty: number; revenueCents: number }[];
    ordersByType: Record<string, number>;
  };
}

function getDateRange(period: 'today' | 'week' | 'month'): { gte: Date; lte: Date } {
  const now = new Date();
  const lte = new Date(now);
  lte.setHours(23, 59, 59, 999);

  const gte = new Date(now);
  gte.setHours(0, 0, 0, 0);

  if (period === 'week') {
    gte.setDate(gte.getDate() - 7);
  } else if (period === 'month') {
    gte.setDate(gte.getDate() - 30);
  }

  return { gte, lte };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parametros invalidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { period, location_id } = parsed.data;
    const dateRange = getDateRange(period);

    // Fetch all active locations for this tenant
    const allLocations = await prisma.locations.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    // Build location map for name resolution
    const locationMap = new Map(allLocations.map((l) => [l.id, l.name]));

    // Build order query filter
    const orderWhere: Record<string, unknown> = {
      tenant_id: tenantId,
      order_status: 'CONFIRMED',
      created_at: { gte: dateRange.gte, lte: dateRange.lte },
    };

    if (location_id) {
      orderWhere.location_id = location_id;
    }

    // Fetch orders with items
    const orders = await prisma.orders.findMany({
      where: orderWhere as any,
      select: {
        id: true,
        total_cents: true,
        order_type: true,
        location_id: true,
        items: true,
      },
    });

    // Group orders by location_id
    const byLocation = new Map<string | null, typeof orders>();
    for (const order of orders) {
      const locId = order.location_id ?? null;
      if (!byLocation.has(locId)) {
        byLocation.set(locId, []);
      }
      byLocation.get(locId)!.push(order);
    }

    // Build metrics per location
    const locations: LocationMetrics[] = [];

    for (const [locId, locOrders] of byLocation) {
      const totalOrders = locOrders.length;
      const totalSales = locOrders.reduce((sum, o) => sum + o.total_cents, 0);
      const avgTicket = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;

      // Orders by type
      const ordersByType: Record<string, number> = {};
      for (const o of locOrders) {
        const t = o.order_type || 'UNKNOWN';
        ordersByType[t] = (ordersByType[t] || 0) + 1;
      }

      // Top products
      const productMap: Record<string, { name: string; qty: number; revenueCents: number }> = {};
      for (const order of locOrders) {
        const items = (order.items as any[]) || [];
        for (const item of items) {
          const key = item.product_id || item.name || 'unknown';
          if (!productMap[key]) {
            productMap[key] = { name: item.name || key, qty: 0, revenueCents: 0 };
          }
          productMap[key].qty += item.qty || 1;
          productMap[key].revenueCents += (item.qty || 1) * (item.unit_price_cents || 0);
        }
      }
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 5);

      const locationName = locId
        ? locationMap.get(locId) || 'Sede desconocida'
        : 'Sin sede asignada';

      locations.push({
        locationId: locId,
        locationName,
        metrics: { totalOrders, totalSales, avgTicket, topProducts, ordersByType },
      });
    }

    // Sort: named locations first, "Sin sede asignada" last
    locations.sort((a, b) => {
      if (a.locationId === null) return 1;
      if (b.locationId === null) return -1;
      return a.locationName.localeCompare(b.locationName);
    });

    // Consolidated metrics across all locations
    const consolidatedOrders = orders.length;
    const consolidatedSales = orders.reduce((sum, o) => sum + o.total_cents, 0);
    const consolidatedAvgTicket =
      consolidatedOrders > 0 ? Math.round(consolidatedSales / consolidatedOrders) : 0;

    const consolidatedOrdersByType: Record<string, number> = {};
    for (const o of orders) {
      const t = o.order_type || 'UNKNOWN';
      consolidatedOrdersByType[t] = (consolidatedOrdersByType[t] || 0) + 1;
    }

    const consolidatedProductMap: Record<
      string,
      { name: string; qty: number; revenueCents: number }
    > = {};
    for (const order of orders) {
      const items = (order.items as any[]) || [];
      for (const item of items) {
        const key = item.product_id || item.name || 'unknown';
        if (!consolidatedProductMap[key]) {
          consolidatedProductMap[key] = { name: item.name || key, qty: 0, revenueCents: 0 };
        }
        consolidatedProductMap[key].qty += item.qty || 1;
        consolidatedProductMap[key].revenueCents +=
          (item.qty || 1) * (item.unit_price_cents || 0);
      }
    }
    const consolidatedTopProducts = Object.values(consolidatedProductMap)
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);

    const consolidated: LocationMetrics = {
      locationId: null,
      locationName: 'Todas las sedes',
      metrics: {
        totalOrders: consolidatedOrders,
        totalSales: consolidatedSales,
        avgTicket: consolidatedAvgTicket,
        topProducts: consolidatedTopProducts,
        ordersByType: consolidatedOrdersByType,
      },
    };

    return NextResponse.json({
      locations,
      consolidated,
      period,
      locationCount: allLocations.length,
    });
  } catch (error) {
    log.error('Error fetching location analytics', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno al obtener analiticas por sede' },
      { status: 500 },
    );
  }
}
