/**
 * Stock Transfer API
 * Transferencia de inventario entre sucursales
 *
 * POST /api/admin/inventory/transfer
 * Body: { fromLocationId, toLocationId, inventoryCode, qty, reason? }
 *
 * Creates 2 inventory_log entries (OUT from source, IN to dest)
 * and updates stock on both locations.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/src/core/observability/logger';

interface TransferBody {
  fromLocationId: string;
  toLocationId: string;
  inventoryCode: string;
  qty: number;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const actorId = authResult.user.id;

  try {
    const body: TransferBody = await request.json();
    const { fromLocationId, toLocationId, inventoryCode, qty, reason } = body;

    // Validations
    if (!fromLocationId || !toLocationId || !inventoryCode || !qty) {
      return NextResponse.json(
        { error: 'fromLocationId, toLocationId, inventoryCode, and qty are required' },
        { status: 400 },
      );
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: 'Source and destination locations must be different' },
        { status: 400 },
      );
    }

    if (qty <= 0 || !Number.isInteger(qty)) {
      return NextResponse.json(
        { error: 'qty must be a positive integer' },
        { status: 400 },
      );
    }

    // Verify both locations belong to the tenant
    const [fromLocation, toLocation] = await Promise.all([
      prisma.locations.findFirst({
        where: { id: fromLocationId, tenant_id: tenantId },
      }),
      prisma.locations.findFirst({
        where: { id: toLocationId, tenant_id: tenantId },
      }),
    ]);

    if (!fromLocation) {
      return NextResponse.json({ error: 'Source location not found' }, { status: 404 });
    }
    if (!toLocation) {
      return NextResponse.json({ error: 'Destination location not found' }, { status: 404 });
    }

    // Verify source has enough stock
    const sourceInventory = await prisma.inventory.findFirst({
      where: {
        tenant_id: tenantId,
        code: inventoryCode,
        location_id: fromLocationId,
      },
    });

    if (!sourceInventory) {
      return NextResponse.json(
        { error: `Inventory item ${inventoryCode} not found at source location` },
        { status: 404 },
      );
    }

    const currentStock = Number(sourceInventory.stock);
    if (currentStock < qty) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${currentStock}, requested: ${qty}` },
        { status: 400 },
      );
    }

    // Execute transfer in a transaction
    const transferReason = reason || `Transferencia a ${toLocation.name}`;
    const transferId = uuidv4();
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Deduct from source
      const updatedSource = await tx.inventory.update({
        where: { id: sourceInventory.id },
        data: {
          stock: { decrement: qty },
          updated_at: now,
        },
      });

      // Upsert destination inventory
      const destInventory = await tx.inventory.findFirst({
        where: {
          tenant_id: tenantId,
          code: inventoryCode,
          location_id: toLocationId,
        },
      });

      let updatedDest;
      if (destInventory) {
        updatedDest = await tx.inventory.update({
          where: { id: destInventory.id },
          data: {
            stock: { increment: qty },
            updated_at: now,
          },
        });
      } else {
        updatedDest = await tx.inventory.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            code: inventoryCode,
            name: sourceInventory.name,
            unit: sourceInventory.unit,
            stock: qty,
            min_stock: sourceInventory.min_stock,
            location_id: toLocationId,
            created_at: now,
            updated_at: now,
          },
        });
      }

      // Create inventory_log entries
      await tx.inventory_log.createMany({
        data: [
          {
            id: uuidv4(),
            tenant_id: tenantId,
            inventory_id: sourceInventory.id,
            movement_type: 'OUT',
            quantity: -qty,
            reason: `TRANSFER_OUT: ${transferReason}`,
            reference_id: transferId,
            actor_id: actorId,
            created_at: now,
          },
          {
            id: uuidv4(),
            tenant_id: tenantId,
            inventory_id: updatedDest.id,
            movement_type: 'IN',
            quantity: qty,
            reason: `TRANSFER_IN: De ${fromLocation.name}`,
            reference_id: transferId,
            actor_id: actorId,
            created_at: now,
          },
        ],
      });

      return {
        fromStock: Number(updatedSource.stock),
        toStock: Number(updatedDest.stock),
      };
    });

    logger.info('STOCK_TRANSFER', 'Stock transfer completed', {
      transferId,
      tenantId,
      inventoryCode,
      qty,
      fromLocationId,
      toLocationId,
    });

    return NextResponse.json({
      success: true,
      fromStock: result.fromStock,
      toStock: result.toStock,
    });
  } catch (err) {
    logger.error(
      'STOCK_TRANSFER_ERROR',
      'Stock transfer failed',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { error: 'Error al procesar la transferencia' },
      { status: 500 },
    );
  }
}
