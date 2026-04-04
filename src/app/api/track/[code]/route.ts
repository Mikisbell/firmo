/**
 * GET /api/track/[code] - Public delivery tracking endpoint
 *
 * NO authentication required — customer-facing.
 * Rate limited: 10 requests per minute per IP.
 * Returns only safe public data (no tenant_id, prices, phone numbers).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { rateLimit, getRetryAfterSeconds } from '@/src/core/middleware/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  // Rate limit: 10 req/min per IP
  const rateLimitResult = await rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(getRetryAfterSeconds(rateLimitResult.resetAt)) },
      }
    );
  }

  const { code } = await params;

  // Validate tracking code format: PARK-XXXXXX
  if (!/^PARK-[A-Z0-9]{6}$/i.test(code)) {
    return NextResponse.json(
      { error: 'Código de seguimiento inválido' },
      { status: 400 }
    );
  }

  const delivery = await prisma.delivery_orders.findFirst({
    where: { tracking_code: code.toUpperCase() },
    select: {
      status: true,
      address_text: true,
      created_at: true,
      assigned_at: true,
      dispatched_at: true,
      delivered_at: true,
      failed_at: true,
      estimated_delivery_at: true,
      tracking_code: true,
      drivers: {
        select: { name: true },
      },
      tenants: {
        select: { name: true },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json(
      { error: 'Pedido no encontrado' },
      { status: 404 }
    );
  }

  // Mask address: show street name but hide the number
  // "Av. Larco 1234, Miraflores" -> "Av. Larco ***, Miraflores"
  const maskedAddress = maskAddress(delivery.address_text);

  // Only return first name of driver
  const driverFirstName = delivery.drivers?.name?.split(' ')[0] ?? null;

  return NextResponse.json({
    trackingCode: delivery.tracking_code,
    status: delivery.status,
    address: maskedAddress,
    driverName: driverFirstName,
    restaurantName: delivery.tenants?.name ?? 'PARK',
    createdAt: delivery.created_at,
    assignedAt: delivery.assigned_at,
    dispatchedAt: delivery.dispatched_at,
    deliveredAt: delivery.delivered_at,
    failedAt: delivery.failed_at,
    estimatedDeliveryAt: delivery.estimated_delivery_at,
  });
}

/**
 * Mask street numbers in address for privacy.
 * "Av. Larco 1234, Miraflores" -> "Av. Larco ***, Miraflores"
 * "Jr. Huallaga 234 Int 5B" -> "Jr. Huallaga *** Int ***"
 */
function maskAddress(address: string): string {
  return address.replace(/\b\d{1,5}\b/g, '***');
}
