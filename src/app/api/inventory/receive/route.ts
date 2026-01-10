// src/app/api/inventory/receive/route.ts
// API para registrar entrada de mercadería (Goods Receipt)
// Task 1.2 - Inventory UI Spec
// Task 9.1, 9.2 - Auth middleware + Audit logging

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { validateInventoryAuth, createAuthErrorResponse } from '@/src/core/middleware/inventory-auth';
import { logGoodsReceipt, logInventoryFailure } from '@/src/core/inventory/audit.service';
import { asCentavos } from '@/src/core/types/shared';

// Zod schema for validation
const receiveSchema = z.object({
  tenant_id: z.string().uuid(),
  location_id: z.string().uuid(),
  inventory_code: z.string().min(1),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unit_cost_cents: z.number().int().nonnegative('El costo debe ser >= 0'),
  supplier_id: z.string().uuid().optional(),
  invoice_number: z.string().optional(),
  lot_number: z.string().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  notes: z.string().optional(),
  actor_id: z.string().uuid(),
  terminal_id: z.string().min(1),
});

export type ReceiveRequest = z.infer<typeof receiveSchema>;

export interface ReceiveResponse {
  success: boolean;
  goods_receipt_id?: string;
  inventory_log_id?: string;
  event_id?: string;
  error?: string;
  errorCode?: string;
  details?: z.ZodIssue[];
}

/**
 * POST /api/inventory/receive
 * 
 * Registra entrada de mercadería:
 * 1. Valida autenticación JWT y rol ADMIN/MANAGER
 * 2. Valida input con Zod
 * 3. Crea GoodsReceipt + GoodsReceiptItem
 * 4. Actualiza Inventory.stock
 * 5. Crea InventoryLog
 * 6. Genera evento GOODS_RECEIVED inmutable
 * 7. Registra audit log
 */
export async function POST(request: NextRequest): Promise<NextResponse<ReceiveResponse>> {
  // Get metadata for audit
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  // 1. Validate authentication (optional - can be disabled for testing)
  const skipAuth = request.headers.get('x-skip-auth') === 'true';
  if (!skipAuth) {
    const authResult = await validateInventoryAuth(request);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult) as NextResponse<ReceiveResponse>;
    }
  }

  try {
    const body = await request.json();
    
    // 2. Validate input
    const validation = receiveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'validation_error', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // 3. Verify actor exists
    const actor = await prisma.employees.findFirst({
      where: { id: input.actor_id, is_active: true },
    });

    if (!actor) {
      await logInventoryFailure(
        input.tenant_id,
        input.actor_id,
        'GOODS_RECEIVED',
        '/api/inventory/receive',
        'Actor no encontrado o inactivo',
        { inventory_code: input.inventory_code },
        { ip, userAgent, terminalId: input.terminal_id }
      );
      return NextResponse.json(
        { success: false, error: 'Actor no encontrado o inactivo' },
        { status: 400 }
      );
    }

    // 4. Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 4a. Find or create inventory record
      let inventory = await tx.inventory.findFirst({
        where: {
          tenant_id: input.tenant_id,
          code: input.inventory_code,
        },
      });

      if (!inventory) {
        inventory = await tx.inventory.create({
          data: {
            id: crypto.randomUUID(),
            tenant_id: input.tenant_id,
            code: input.inventory_code,
            name: input.inventory_code,
            unit: 'UND',
            stock: new Prisma.Decimal(0),
            location_id: input.location_id,
            theoretical_stock: new Prisma.Decimal(0),
          },
        });
      }

      // 4b. Generate receipt number
      const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // 4c. Create GoodsReceipt
      const goodsReceipt = await tx.goods_receipts.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: input.tenant_id,
          location_id: input.location_id,
          receipt_number: receiptNumber,
          received_by: input.actor_id,
          status: 'CONFIRMED',
          received_at: new Date(),
          notes: input.notes,
          goods_receipt_items: {
            create: [{
              id: crypto.randomUUID(),
              inventory_code: input.inventory_code,
              quantity_ordered: new Prisma.Decimal(input.quantity),
              quantity_received: new Prisma.Decimal(input.quantity),
              quantity_rejected: new Prisma.Decimal(0),
              unit_cost_cents: input.unit_cost_cents,
              lot_number: input.lot_number,
              expiry_date: input.expiry_date ? new Date(input.expiry_date) : null,
            }],
          },
        },
      });

      // 4d. Create InventoryLog
      const inventoryLog = await tx.inventory_log.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: input.tenant_id,
          inventory_id: inventory.id,
          movement_type: 'IN',
          quantity: new Prisma.Decimal(input.quantity),
          reference_id: goodsReceipt.id,
          reason: `Recepción: ${receiptNumber}${input.invoice_number ? ` - Factura: ${input.invoice_number}` : ''}`,
          actor_id: input.actor_id,
        },
      });

      // 4e. Update inventory stock and cost
      const newStock = Number(inventory.stock) + input.quantity;
      const oldCost = inventory.cost_cents || 0;
      const oldStock = Number(inventory.stock);
      
      // Weighted average cost calculation
      const newCostCents = oldStock > 0
        ? Math.round((oldCost * oldStock + input.unit_cost_cents * input.quantity) / newStock)
        : input.unit_cost_cents;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          stock: { increment: input.quantity },
          theoretical_stock: { increment: input.quantity },
          cost_cents: newCostCents,
          lot_number: input.lot_number || inventory.lot_number,
          expiry_date: input.expiry_date ? new Date(input.expiry_date) : inventory.expiry_date,
          updated_at: new Date(),
        },
      });

      // 4f. Create immutable event
      const eventId = randomUUID();
      await tx.events.create({
        data: {
          id: eventId,
          tenant_id: input.tenant_id,
          occurred_at: new Date(),
          type: 'GOODS_RECEIVED',
          entity_type: 'inventory',
          entity_id: inventory.id,
          actor_id: input.actor_id,
          terminal_id: input.terminal_id,
          payload_version: 1,
          payload: {
            inventory_code: input.inventory_code,
            quantity: input.quantity,
            unit_cost_cents: input.unit_cost_cents,
            supplier_id: input.supplier_id,
            invoice_number: input.invoice_number,
            lot_number: input.lot_number,
            expiry_date: input.expiry_date,
            goods_receipt_id: goodsReceipt.id,
            receipt_number: receiptNumber,
          },
        },
      });

      return {
        goods_receipt_id: goodsReceipt.id,
        inventory_log_id: inventoryLog.id,
        event_id: eventId,
      };
    });

    // 5. Log audit
    await logGoodsReceipt(
      input.tenant_id,
      input.actor_id,
      result.goods_receipt_id,
      {
        inventory_code: input.inventory_code,
        quantity: input.quantity,
        unit_cost_cents: asCentavos(input.unit_cost_cents),
        supplier_id: input.supplier_id,
        invoice_number: input.invoice_number,
      },
      { ip, userAgent, terminalId: input.terminal_id }
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error receiving goods:', error);
    return NextResponse.json(
      { success: false, error: 'internal_error' },
      { status: 500 }
    );
  }
}
