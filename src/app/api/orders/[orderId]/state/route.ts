// src/app/api/orders/[orderId]/state/route.ts
// Order State Endpoint for Conflict Resolution
// Returns current order state with revision for client refresh

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  // Auth check
  const secret = req.headers.get("x-api-secret");
  if (secret !== process.env.PARK_API_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
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
    console.error("[OrderState] Error fetching order:", e);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
