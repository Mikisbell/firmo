/**
 * Promotions API - Remove Promotion from Order
 * 
 * POST /api/promotions/remove
 * 
 * Removes a promotion from an order (generates PROMOTION_REMOVED event)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

const RemovePromotionSchema = z.object({
  order_id: z.string().uuid(),
  promotion_id: z.string().uuid(),
  reason: z.enum(['USER_REQUEST', 'EXPIRED', 'INVALID', 'STACKING_NOT_ALLOWED']).default('USER_REQUEST'),
});

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = getTenantId();
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = RemovePromotionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { order_id, promotion_id, reason } = validationResult.data;

    // Verify order exists and belongs to tenant
    const order = await prisma.orders.findFirst({
      where: { 
        id: order_id, 
        tenant_id: tenantId,
        order_status: { not: 'CANCELLED' }
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Orden no encontrada o cancelada' },
        { status: 404 }
      );
    }

    // Verify order has the promotion
    if (order.promotion_id !== promotion_id) {
      return NextResponse.json(
        { error: 'Promoción no aplicada a esta orden' },
        { status: 400 }
      );
    }

    const occurred_at = new Date().toISOString();
    const currentDiscount = order.discount_cents || 0;
    const currentTotal = order.total_cents || 0;
    
    // Calculate totals without promotion
    const newTotal = currentTotal + currentDiscount;
    const subtotal = order.subtotal_cents || newTotal;

    // Create the removal event
    const event_id = uuidv4();
    
    const event = {
      event_id,
      tenant_id: tenantId,
      terminal_id: 'admin-panel',
      terminal_sequence: 0,
      occurred_at,
      aggregate_type: 'ORDER',
      aggregate_id: order_id,
      correlation_id: event_id,
      causation_id: null,
      actor_id: user.id,
      actor_role_snapshot: user.role,
      schema_version: 1,
      payload_version: 1,
      shift_id: null,
      business_date: null,
      event_type: 'PROMOTION_REMOVED',
      payload: {
        order_id,
        promotion_id,
        reason,
        previous_totals: {
          subtotal_cents: subtotal,
          discount_cents: currentDiscount,
          total_cents: currentTotal,
        },
        removed_at: occurred_at,
      },
    };

    // Save event to database
    await prisma.events.create({
      data: {
        id: event_id,
        tenant_id: tenantId,
        occurred_at: new Date(occurred_at),
        type: 'PROMOTION_REMOVED',
        entity_type: 'ORDER',
        entity_id: order_id,
        actor_id: user.id,
        actor_role_snapshot: user.role,
        terminal_id: 'admin-panel',
        payload: event.payload,
      },
    });

    // Update order to remove promotion
    await prisma.orders.update({
      where: { id: order_id },
      data: {
        promotion_id: null,
        discount_cents: 0,
        total_cents: newTotal,
        promotion_snapshot: undefined,
      },
    });

    pinoLogger.info({
      event_id,
      order_id,
      promotion_id,
      user_id: user.id,
      reason,
      tenant_id: tenantId,
    }, 'Promotion removed from order');

    return NextResponse.json({
      success: true,
      event_id,
      order_id,
      previous_totals: {
        subtotal_cents: subtotal,
        discount_cents: currentDiscount,
        total_cents: currentTotal,
      },
      new_totals: {
        subtotal_cents: subtotal,
        discount_cents: 0,
        total_cents: newTotal,
      },
      message: 'Promoción eliminada exitosamente',
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error removing promotion');
    return NextResponse.json(
      { error: 'Error al eliminar promoción' },
      { status: 500 }
    );
  }
}
