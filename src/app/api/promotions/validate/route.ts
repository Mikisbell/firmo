/**
 * Promotions API - Validate and Apply Promotion at Checkout
 * 
 * POST /api/promotions/validate
 * 
 * Validates and applies promotion (generates PROMOTION_VALIDATED_APPLIED event)
 * This is called at checkout to validate and finalize the promotion application
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { v4 as uuidv4 } from 'uuid';

const ValidatePromotionSchema = z.object({
  order_id: z.string().uuid(),
  promotion_id: z.string().uuid(),
});

// Calculate discount based on promotion type
function calculateDiscount(
  subtotalCents: number,
  promotionType: string,
  promotionValue: number | null,
  promotionRules: any
): number {
  if (!promotionValue) return 0;

  switch (promotionType) {
    case 'PERCENT':
      return Math.floor((subtotalCents * promotionValue) / 100);
    
    case 'FIXED':
      return Math.min(promotionValue, subtotalCents);
    
    case '2X1':
      // Calculate 2x1 discount based on items
      // Simplified: discount equals price of cheapest item
      return promotionRules?.free_item_value || 0;
    
    case 'COMBO':
      // Combo discount is a fixed amount
      return promotionValue;
    
    case 'HAPPY_HOUR':
      // Validate time window
      const now = new Date();
      const hour = now.getHours();
      const startHour = promotionRules?.start_hour || 0;
      const endHour = promotionRules?.end_hour || 24;
      
      if (hour >= startHour && hour <= endHour) {
        return Math.floor((subtotalCents * promotionValue) / 100);
      }
      return 0;
    
    default:
      return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = user.tenantId;
    
    // Parse and validate request body
    const body = await request.json();
    const validationResult = ValidatePromotionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { order_id, promotion_id } = validationResult.data;

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

    // Calculate new totals
    const currentSubtotal = order.subtotal_cents || 0;
    const discountCents = calculateDiscount(
      currentSubtotal,
      promotion.type,
      promotion.value,
      promotion.rules as any
    );
    
    const newTotal = currentSubtotal - discountCents;

    // Create the validation event
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
      event_type: 'PROMOTION_VALIDATED_APPLIED',
      payload: {
        order_id,
        promotion_id,
        promotion_snapshot: {
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          value: promotion.value,
        },
        recalculated_totals: {
          subtotal_cents: currentSubtotal,
          discount_cents: discountCents,
          total_cents: newTotal,
        },
        validated_at: occurred_at,
        validated_by: user.id,
      },
    };

    // Save event to database
    await prisma.events.create({
      data: {
        id: event_id,
        tenant_id: tenantId,
        occurred_at: new Date(occurred_at),
        type: 'PROMOTION_VALIDATED_APPLIED',
        entity_type: 'ORDER',
        entity_id: order_id,
        actor_id: user.id,
        actor_role_snapshot: user.role,
        terminal_id: 'admin-panel',
        payload: event.payload,
      },
    });

    // Update order with validated promotion and new totals
    await prisma.orders.update({
      where: { id: order_id },
      data: {
        promotion_id: promotion.id,
        discount_cents: discountCents,
        total_cents: newTotal,
        promotion_snapshot: {
          id: promotion.id,
          name: promotion.name,
          type: promotion.type,
          value: promotion.value,
          discount_cents: discountCents,
          validated_at: occurred_at,
          validated_by: user.id,
          tentative: false,
        },
      },
    });

    pinoLogger.info({
      event_id,
      order_id,
      promotion_id,
      user_id: user.id,
      discount_cents: discountCents,
      new_total: newTotal,
      tenant_id: tenantId,
    }, 'Promotion validated and applied');

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
      totals: {
        subtotal_cents: currentSubtotal,
        discount_cents: discountCents,
        total_cents: newTotal,
      },
      message: 'Promotion validated and applied successfully',
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error validating promotion');
    return NextResponse.json(
      { error: 'Failed to validate promotion' },
      { status: 500 }
    );
  }
}
