// src/app/api/inventory/stock/route.ts
// API para listar inventario con filtros y summary
// Task 1.1 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/src/core/observability/structured-logger';
import {
  type InventoryItem,
  type StockSummary,
  type StockResponse,
  calculateStatus,
  calculateExpiryUrgency,
} from '@/src/core/inventory/stock-types';
import { asCentavos } from '@/src/core/types/shared';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

/**
 * GET /api/inventory/stock
 *
 * Query params:
 * - search: string (busca en code o name)
 * - low_stock_only: boolean (solo items con stock bajo)
 * - location_id: string (filtrar por ubicación)
 *
 * tenant_id: extraído del JWT (nunca del cliente)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase();
    const lowStockOnly = searchParams.get('low_stock_only') === 'true';
    const locationId = searchParams.get('location_id');

    // Construir cláusula where
    const where: any = {
      tenant_id: tenantId,
    };

    if (locationId) {
      where.location_id = locationId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch inventory items
    const inventoryItems = await prisma.inventory.findMany({
      where,
      orderBy: [
        { code: 'asc' },
      ],
    });

    // Transform to response format
    const items: InventoryItem[] = inventoryItems.map((item) => {
      const stock = Number(item.stock);
      const minStock = Number(item.min_stock || 0);
      const costCents = item.cost_cents || 0;
      const status = calculateStatus(stock, minStock);
      
      // Calculate expiry urgency (FEFO - Task 11)
      const { urgency: expiryUrgency, daysUntilExpiry } = calculateExpiryUrgency(item.expiry_date);
      
      // Check if expiring within 7 days
      const isExpiring = expiryUrgency !== 'OK';

      return {
        id: item.id,
        code: item.code,
        name: item.name,
        stock,
        minStock,
        unit: item.unit,
        costCents: asCentavos(costCents),
        status,
        expiringLots: isExpiring ? 1 : 0,
        locationId: item.location_id,
        expiryDate: item.expiry_date?.toISOString().split('T')[0] || null,
        lotNumber: item.lot_number,
        expiryUrgency,
        daysUntilExpiry,
      };
    });

    // Filter low stock if requested
    const filteredItems = lowStockOnly
      ? items.filter((item) => item.status === 'LOW' || item.status === 'CRITICAL')
      : items;

    // Calculate summary
    const summary: StockSummary = {
      lowStockCount: items.filter((item) => 
        item.status === 'LOW' || item.status === 'CRITICAL'
      ).length,
      expiringCount: items.filter((item) => item.expiringLots > 0).length,
      totalValueCents: asCentavos(items.reduce((acc: number, item: InventoryItem) => 
        acc + Math.round(item.stock * (item.costCents as number)), 0
      )),
    };

    const response: StockResponse = {
      items: filteredItems,
      summary,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error al obtener stock de inventario', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
