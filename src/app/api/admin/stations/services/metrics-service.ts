// src/app/api/admin/stations/services/metrics-service.ts
// Metrics calculation service for KDS stations
// Created: 22 Enero 2026

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface StationMetrics {
  stationId: string;
  stationCode: string;
  activeOrders: number;
  avgTime: number;
  efficiency: number;
  load: number;
  estimatedTime: number;
  lastUpdated: string;
}

/**
 * Calculate real-time metrics for a KDS station
 * 
 * Metrics calculated:
 * - activeOrders: Count of orders with items in PENDING or COOKING status
 * - avgTime: Average preparation time in minutes (last 24h completed orders)
 * - efficiency: Percentage of orders completed within estimated_time
 * - load: Percentage of capacity used (max 15 orders)
 * 
 * @param stationCode - Station code (e.g., 'PARRILLA', 'COCINA', 'BAR')
 * @returns StationMetrics object
 */
export async function calculateStationMetrics(
  stationCode: string
): Promise<StationMetrics> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get station info
  const station = await prisma.stations.findFirst({
    where: { code: stationCode },
    select: {
      id: true,
      code: true,
      estimated_time: true,
      tenant_id: true,
    },
  });

  if (!station) {
    throw new Error(`Station not found: ${stationCode}`);
  }

  // Calculate active orders
  // Count orders that have items for this station in PENDING or COOKING status
  const activeOrdersResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT o.id) as count
    FROM orders o
    WHERE o.tenant_id = ${station.tenant_id}::uuid
      AND o.order_status != 'CANCELLED'
      AND o.fulfillment_status IN ('COOKING', 'READY')
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(o.items::jsonb) as item
        WHERE item->>'station' = ${stationCode}
          AND item->>'status' IN ('PENDING', 'COOKING')
      )
  `;

  const activeOrders = Number(activeOrdersResult[0]?.count || 0);

  // Calculate average time (last 24 hours, completed orders)
  const completedOrdersResult = await prisma.$queryRaw<
    Array<{
      created_at: Date;
      updated_at: Date;
    }>
  >`
    SELECT o.created_at, o.updated_at
    FROM orders o
    WHERE o.tenant_id = ${station.tenant_id}::uuid
      AND o.fulfillment_status = 'DELIVERED'
      AND o.updated_at >= ${yesterday}
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(o.items::jsonb) as item
        WHERE item->>'station' = ${stationCode}
          AND item->>'status' = 'DONE'
      )
  `;

  let avgTime = 0;
  if (completedOrdersResult.length > 0) {
    const totalTime = completedOrdersResult.reduce((sum, order) => {
      const prepTime =
        (order.updated_at.getTime() - order.created_at.getTime()) / 60000; // Convert to minutes
      return sum + prepTime;
    }, 0);
    avgTime = totalTime / completedOrdersResult.length;
  }

  // Calculate efficiency (% within estimated time)
  let efficiency = 0;
  if (completedOrdersResult.length > 0) {
    const onTimeCount = completedOrdersResult.filter((order) => {
      const prepTime =
        (order.updated_at.getTime() - order.created_at.getTime()) / 60000;
      return prepTime <= station.estimated_time;
    }).length;
    efficiency = (onTimeCount / completedOrdersResult.length) * 100;
  }

  // Calculate load (% of capacity, assuming max 15 orders)
  const MAX_CAPACITY = 15;
  const load = (activeOrders / MAX_CAPACITY) * 100;

  return {
    stationId: station.id,
    stationCode: station.code,
    activeOrders,
    avgTime: Math.round(avgTime * 10) / 10, // Round to 1 decimal
    efficiency: Math.round(efficiency),
    load: Math.round(load),
    estimatedTime: station.estimated_time,
    lastUpdated: now.toISOString(),
  };
}

/**
 * Calculate metrics for all active stations
 * 
 * @param tenantId - Tenant ID
 * @returns Array of StationMetrics
 */
export async function calculateAllStationsMetrics(
  tenantId: string
): Promise<StationMetrics[]> {
  const stations = await prisma.stations.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
    },
    select: {
      code: true,
    },
  });

  const metricsPromises = stations.map((station) =>
    calculateStationMetrics(station.code)
  );

  return Promise.all(metricsPromises);
}

/**
 * Calculate global statistics across all stations
 * 
 * @param tenantId - Tenant ID
 * @returns Global statistics
 */
export async function calculateGlobalStatistics(tenantId: string): Promise<{
  activeStations: number;
  totalActiveOrders: number;
  avgTime: number;
  globalEfficiency: number;
}> {
  const allMetrics = await calculateAllStationsMetrics(tenantId);

  const activeStations = allMetrics.length;
  const totalActiveOrders = allMetrics.reduce(
    (sum, m) => sum + m.activeOrders,
    0
  );

  // Weighted average time (by active orders)
  let avgTime = 0;
  if (totalActiveOrders > 0) {
    const weightedSum = allMetrics.reduce(
      (sum, m) => sum + m.avgTime * m.activeOrders,
      0
    );
    avgTime = weightedSum / totalActiveOrders;
  }

  // Weighted average efficiency (by active orders)
  let globalEfficiency = 0;
  if (totalActiveOrders > 0) {
    const weightedSum = allMetrics.reduce(
      (sum, m) => sum + m.efficiency * m.activeOrders,
      0
    );
    globalEfficiency = weightedSum / totalActiveOrders;
  }

  return {
    activeStations,
    totalActiveOrders,
    avgTime: Math.round(avgTime * 10) / 10,
    globalEfficiency: Math.round(globalEfficiency),
  };
}
