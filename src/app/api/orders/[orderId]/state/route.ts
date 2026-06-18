// src/app/api/orders/[orderId]/state/route.ts
// Order State Endpoint for Conflict Resolution
// Returns current order state with revision for client refresh

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/core/db/prisma";
import { logger } from '@/src/core/observability/structured-logger';
import { requirePosAuth } from "@/src/core/middleware/pos-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  // AUTH (bug #3 fix): session JWT via cookie/Bearer instead of the exposed x-api-secret.
  const authResult = await requirePosAuth(req);
  if (!authResult.authorized) return authResult.response;

  const { orderId } = await params;
  const tenantId = authResult.user.tenantId;

  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    });

    // Tenant isolation: 404 (not 403) to avoid leaking cross-tenant existence.
    if (!order || order.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        tenant_id: order.tenant_id,
        order_number: order.order_number,
        order_type: order.order_type,
        order_status: order.order_status,
        fulfillment_status: order.fulfillment_status,
        handoff_status: order.handoff_status,
        items: order.items,
        checks: order.checks,
        subtotal_cents: order.subtotal_cents,
        discount_cents: order.discount_cents,
        total_cents: order.total_cents,
        revision: order.revision,
        terminal_id: order.terminal_id,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
      revision: order.revision,
      last_updated_at: order.updated_at,
    });
  } catch (e) {
    logger.error('Error al obtener estado de orden', e instanceof Error ? e : new Error(String(e)));
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
