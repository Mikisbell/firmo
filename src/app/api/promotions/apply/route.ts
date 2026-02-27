/**
 * Promotions API - Apply Promotion to Order
 * 
 * POST /api/promotions/apply
 * 
 * Applies a promotion to an order (tentative application)
 * Generates PROMOTION_APPLIED_TENTATIVE event
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

const ApplyPromotionSchema = z.object({
  order_id: z.string().uuid(),
  promotion_id: z.string().uuid(),
  source: z.enum(['ORDER_SCREEN', 'CATALOG', 'MANUAL']).default('ORDER_SCREEN'),
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
    const validationResult = ApplyPromotionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { order_id, promotion_id, source } = validationResult.data;

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
        { error: 'Order not found or cancelled' },
        { status: 404 }
      );
    }

    // Verify promotion exists and is active
    const promotion = await prisma.promotions.findFirst({
      where: {
        id: promotion_id,
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { starts_at: null, ends_at: null },
          { starts_at: { lte: new Date() }, ends_at: null },
          { starts_at: null, ends_at: { gte: new Date() } },
          { starts_at: { lte: new Date() }, ends_at: { gte: new Date() } },
        ],
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: 'Promotion not found, inactive, or expired' },
        { status: 404 }
      );
    }

    // Check if order already has a non-stackable promotion
    if (order.promotion_id && !promotion.stackable) {
      const existingPromotion = await prisma.promotions.findUnique({
        where: { id: order.promotion_id },
      });
      
      if (existingPromotion && !existingPromotion.stackable) {
        return NextResponse.json(
          { error: 'Order already has a non-stackable promotion applied' },
          { status: 409 }
        );
      }
    }

    // Create the event
    const event_id = uuidv4();
    const occurred_at = new Date().toISOString();
    
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
      event_type: 'PROMOTION_APPLIED_TENTATIVE',
      payload: {
        order_id,
        promotion_id,
        source,
        applied_at: occurred_at,
      },
    };

    // Save event to database (using events table)
    await prisma.events.create({
      data: {
        id: event_id,
        tenant_id: tenantId,
        occurred_at: new Date(occurred_at),
        type: 'PROMOTION_APPLIED_TENTATIVE',
        entity_type: 'ORDER',
        entity_id: order_id,
        actor_id: user.id,
        actor_role_snapshot: user.role,
        terminal_id: 'admin-panel',
        payload: event.payload,
      },
    });

    // Update order with tentative promotion
    await prisma.orders.update({
      where: { id: order_id },
      data: {
        promotion_id: promotion.id,
        promotion_snapshot: {
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          value: promotion.value,
          applied_at: occurred_at,
          tentative: true,
        },
      },
    });

    pinoLogger.info({
      event_id,
      order_id,
      promotion_id,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Promotion applied tentatively');

    return NextResponse.json({
      success: true,
      event_id,
      order_id,
      promotion: {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        value: promotion.value,
      },
      message: 'Promotion applied tentatively. Validation required at checkout.',
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error applying promotion');
    return NextResponse.json(
      { error: 'Failed to apply promotion' },
      { status: 500 }
    );
  }
}
