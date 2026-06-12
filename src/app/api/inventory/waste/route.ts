// src/app/api/inventory/waste/route.ts
// API para registrar merma/pérdida
// Task 1.3 - Inventory UI Spec
// Task 9.1, 9.2 - Auth middleware + Audit logging

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { validateInventoryAuth, createAuthErrorResponse } from '@/src/core/middleware/inventory-auth';
import { logWasteRecorded, logInventoryFailure } from '@/src/core/inventory/audit.service';
import { asCentavos } from '@/src/core/types/shared';
import { logger } from '@/src/core/observability/structured-logger';

// Valid waste reason codes
const WASTE_REASON_CODES = [
  'EXPIRED',
  'DAMAGED', 
  'THEFT',
  'PRODUCTION_LOSS',
  'COUNT_ADJUSTMENT',
  'REJECTED_ON_RECEIPT',
  'OTHER',
] as const;

// Type exported for external use
export type WasteReasonCode = typeof WASTE_REASON_CODES[number];

// Zod schema for validation
const wasteSchema = z.object({
  tenant_id: z.string().uuid(),
  location_id: z.string().uuid(),
  inventory_code: z.string().min(1),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  lot_number: z.string().optional(),
  reason_code: z.enum(WASTE_REASON_CODES),
  reason_detail: z.string().optional(),
  photo_url: z.string().url().optional(),
  actor_id: z.string().uuid(),
  terminal_id: z.string().min(1),
}).refine(
  (data) => {
    // reason_detail obligatorio si THEFT u OTHER
    if (data.reason_code === 'THEFT' || data.reason_code === 'OTHER') {
      return !!data.reason_detail && data.reason_detail.length > 0;
    }
    return true;
  },
  { message: 'Detalle obligatorio para THEFT u OTHER', path: ['reason_detail'] }
);

export type WasteRequest = z.infer<typeof wasteSchema>;

export interface WasteResponse {
  success: boolean;
  waste_log_id?: string;
  inventory_log_id?: string;
  event_id?: string;
  cost_cents?: number;
  warning?: string;
  error?: string;
  errorCode?: string;
  details?: z.ZodIssue[];
}

/**
 * POST /api/inventory/waste
 * 
 * Registra merma/pérdida:
 * 1. Valida autenticación JWT y rol ADMIN/MANAGER
 * 2. Valida input con Zod
 * 3. Calcula cost_cents automáticamente (qty × avgCost)
 * 4. Crea WasteLog
 * 5. Actualiza Inventory.stock
 * 6. Crea InventoryLog
 * 7. Genera evento WASTE_RECORDED inmutable
 * 8. Registra audit log
 */
export async function POST(request: NextRequest): Promise<NextResponse<WasteResponse>> {
  // Get metadata for audit
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  // 1. Validate authentication (ALWAYS required — no bypass)
  const authResult = await validateInventoryAuth(request);
  if (!authResult.success || !authResult.auth) {
    return createAuthErrorResponse(authResult) as NextResponse<WasteResponse>;
  }

  try {
    const body = await request.json();

    // 2. Validate input
    const validation = wasteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error de validación',
          details: validation.error.issues
        },
        { status: 400 }
      );
    }

    const input = validation.data;

    // 2b. Tenant isolation: body tenant_id must match the JWT tenant
    if (input.tenant_id !== authResult.auth.tid) {
      return NextResponse.json(
        { success: false, error: 'Tenant no autorizado' },
        { status: 403 }
      );
    }

    // 3. Verify actor exists
    const actor = await prisma.employees.findFirst({
      where: { id: input.actor_id, is_active: true },
    });

    if (!actor) {
      await logInventoryFailure(
        input.tenant_id,
        input.actor_id,
        'WASTE_RECORDED',
        '/api/inventory/waste',
        'Actor no encontrado o inactivo',
        { inventory_code: input.inventory_code },
        { ip, userAgent, terminalId: input.terminal_id }
      );
      return NextResponse.json(
        { success: false, error: 'Actor no encontrado o inactivo' },
        { status: 400 }
      );
    }

    // 4. Find inventory item
    const inventory = await prisma.inventory.findFirst({
      where: {
        tenant_id: input.tenant_id,
        code: input.inventory_code,
      },
    });

    if (!inventory) {
      await logInventoryFailure(
        input.tenant_id,
        input.actor_id,
        'WASTE_RECORDED',
        '/api/inventory/waste',
        'Insumo no encontrado',
        { inventory_code: input.inventory_code },
        { ip, userAgent, terminalId: input.terminal_id }
      );
      return NextResponse.json(
        { success: false, error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    // 5. Calculate cost and check stock
    const currentStock = Number(inventory.stock);
    const unitCostCents = inventory.cost_cents || 0;
    const costCents = Math.round(input.quantity * unitCostCents);
    
    let warning: string | undefined;
    if (input.quantity > currentStock) {
      warning = `Cantidad (${input.quantity}) excede stock disponible (${currentStock})`;
    }

    // 6. Check photo requirement (cost > S/50 = 5000 centavos)
    if (costCents > 5000 && !input.photo_url) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Foto obligatoria para merma > S/50',
          cost_cents: costCents,
        },
        { status: 400 }
      );
    }

    // 7. Execute in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 7a. Create WasteLog
      const wasteLog = await tx.waste_logs.create({
        data: {
          id: uuidv4(),
          tenant_id: input.tenant_id,
          location_id: input.location_id,
          inventory_code: input.inventory_code,
          quantity: new Decimal(input.quantity),
          unit: inventory.unit,
          reason_code: input.reason_code,
          reason_detail: input.reason_detail,
          cost_cents: costCents,
          reported_by: input.actor_id,
          photo_url: input.photo_url,
        },
      });

      // 7b. Create InventoryLog
      const inventoryLog = await tx.inventory_log.create({
        data: {
          id: uuidv4(),
          tenant_id: input.tenant_id,
          inventory_id: inventory.id,
          movement_type: 'WASTE',
          quantity: new Decimal(-input.quantity), // Negative for waste
          reference_id: wasteLog.id,
          reason: `Merma: ${input.reason_code}${input.reason_detail ? ` - ${input.reason_detail}` : ''}`,
          actor_id: input.actor_id,
        },
      });

      // 7c. Update inventory stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          stock: { decrement: input.quantity },
          theoretical_stock: { decrement: input.quantity },
          updated_at: new Date(),
        },
      });

      // 7d. Create immutable event
      const eventId = uuidv4();
      await tx.events.create({
        data: {
          id: eventId,
          tenant_id: input.tenant_id,
          occurred_at: new Date(),
          type: 'WASTE_RECORDED',
          entity_type: 'inventory',
          entity_id: inventory.id,
          actor_id: input.actor_id,
          terminal_id: input.terminal_id,
          payload_version: 1,
          payload: {
            inventory_code: input.inventory_code,
            quantity: input.quantity,
            reason_code: input.reason_code,
            reason_detail: input.reason_detail,
            cost_cents: costCents,
            lot_number: input.lot_number,
            photo_url: input.photo_url,
            waste_log_id: wasteLog.id,
          },
        },
      });

      return {
        waste_log_id: wasteLog.id,
        inventory_log_id: inventoryLog.id,
        event_id: eventId,
      };
    });

    // 8. Log audit
    await logWasteRecorded(
      input.tenant_id,
      input.actor_id,
      result.waste_log_id,
      {
        inventory_code: input.inventory_code,
        quantity: input.quantity,
        reason_code: input.reason_code,
        cost_cents: asCentavos(costCents),
      },
      { ip, userAgent, terminalId: input.terminal_id }
    );

    return NextResponse.json({
      success: true,
      ...result,
      cost_cents: costCents,
      warning,
    });
  } catch (error) {
    logger.error('Error al registrar merma', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
