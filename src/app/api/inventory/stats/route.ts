// src/app/api/inventory/stats/route.ts
// API para estadísticas del dashboard de inventario
// Task 14.1 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

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
 * - tenant_id: string (requerido)
 * - location_id: string (opcional)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<StatsResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    
    const tenantId = searchParams.get('tenant_id');
    const locationId = searchParams.get('location_id');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Se requiere tenant_id' },
        { status: 400 }
      );
    }

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
    console.error('Error fetching inventory stats:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
