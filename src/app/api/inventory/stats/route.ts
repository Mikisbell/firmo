// src/app/api/inventory/stats/route.ts
// API para estadísticas del dashboard de inventario
// Task 14.1 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

interface StatsResponse {
  lowStockCount: number;
  pendingReceipts: number;
  pendingCounts: number;
  todayWaste: number;
}

/**
 * GET /api/inventory/stats
 *
 * Query params:
 * - location_id: string (opcional)
 *
 * tenant_id: extraído del JWT (nunca del cliente)
 */
export async function GET(
  request: NextRequest
) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    // Count items with low stock (stock < min_stock)
    // Need to fetch and filter since Prisma doesn't support field comparison in where
    const allInventory = await prisma.inventory.findMany({
      where: {
        tenant_id: tenantId,
        ...(locationId && { location_id: locationId }),
        min_stock: { not: null },
      },
      select: {
        stock: true,
        min_stock: true,
      },
    });
    
    const lowStockCount = allInventory.filter(
      item => item.min_stock && Number(item.stock) < Number(item.min_stock)
    ).length;

    // Count pending receipts (status = DRAFT)
    const pendingReceipts = await prisma.goods_receipts.count({
      where: {
        tenant_id: tenantId,
        ...(locationId && { location_id: locationId }),
        status: 'DRAFT',
      },
    });

    // Count pending inventory counts (status = IN_PROGRESS)
    const pendingCounts = await prisma.inventory_counts.count({
      where: {
        tenant_id: tenantId,
        ...(locationId && { location_id: locationId }),
        status: 'IN_PROGRESS',
      },
    });

    // Count today's waste records
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayWaste = await prisma.waste_logs.count({
      where: {
        tenant_id: tenantId,
        ...(locationId && { location_id: locationId }),
        created_at: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return NextResponse.json({
      lowStockCount,
      pendingReceipts,
      pendingCounts,
      todayWaste,
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de inventario', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
