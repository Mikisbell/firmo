// src/app/api/inventory/lots/[code]/route.ts
// API para obtener lotes disponibles de un insumo (FEFO)
// Task 11.2 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

const lotsQuerySchema = z.object({
  location_id: z.string().optional(),
});

export interface InventoryLot {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  costCents: number;
  receivedAt: string;
  daysUntilExpiry: number | null;
  isExpired: boolean;
}

export interface LotsResponse {
  lots: InventoryLot[];
  totalQuantity: number;
}

/**
 * GET /api/inventory/lots/:code
 * Retorna los lotes disponibles de un insumo, ordenados por FEFO
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const tenantId = authResult.user.tenantId;

    const parsed = lotsQuerySchema.safeParse({
      location_id: searchParams.get('location_id') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { location_id: locationId } = parsed.data;

    // Buscar el inventario principal
    const inventory = await prisma.inventory.findFirst({
      where: {
        tenant_id: tenantId,
        code: code,
        ...(locationId && { location_id: locationId }),
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: 'Inventario no encontrado' },
        { status: 404 }
      );
    }

    // Buscar lotes desde GoodsReceiptItem (entradas con lote)
    const receiptItems = await prisma.goods_receipt_items.findMany({
      where: {
        inventory_code: code,
        goods_receipts: {
          tenant_id: tenantId,
          status: 'CONFIRMED',
          ...(locationId && { location_id: locationId }),
        },
      },
      include: {
        goods_receipts: true,
      },
      orderBy: [
        { expiry_date: 'asc' }, // FEFO: primero los que vencen antes
      ],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transformar a formato de respuesta
    const lots: InventoryLot[] = receiptItems
      .filter(item => item.lot_number) // Solo items con lote
      .map(item => {
        const expiryDate = item.expiry_date;
        let daysUntilExpiry: number | null = null;
        let isExpired = false;

        if (expiryDate) {
          const expiry = new Date(expiryDate);
          expiry.setHours(0, 0, 0, 0);
          const diffTime = expiry.getTime() - today.getTime();
          daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          isExpired = daysUntilExpiry < 0;
        }

        // Calcular cantidad disponible (recibida - rechazada)
        const quantity = Number(item.quantity_received) - Number(item.quantity_rejected);

        return {
          id: item.id,
          lotNumber: item.lot_number!,
          expiryDate: expiryDate?.toISOString().split('T')[0] || null,
          quantity: quantity > 0 ? quantity : 0,
          costCents: item.unit_cost_cents,
          receivedAt: item.goods_receipts.received_at?.toISOString() || item.goods_receipts.created_at.toISOString(),
          daysUntilExpiry,
          isExpired,
        };
      })
      .filter(lot => lot.quantity > 0); // Solo lotes con stock disponible

    // Si no hay lotes específicos, crear uno "virtual" con el stock general
    if (lots.length === 0 && Number(inventory.stock) > 0) {
      lots.push({
        id: 'default',
        lotNumber: 'SIN LOTE',
        expiryDate: inventory.expiry_date?.toISOString().split('T')[0] || null,
        quantity: Number(inventory.stock),
        costCents: inventory.cost_cents || 0,
        receivedAt: inventory.updated_at.toISOString(),
        daysUntilExpiry: null,
        isExpired: false,
      });
    }

    const response: LotsResponse = {
      lots,
      totalQuantity: lots.reduce((sum, lot) => sum + lot.quantity, 0),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error al obtener lotes de inventario', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
