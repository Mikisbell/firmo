/**
 * LlamaFood Webhook - POST
 *
 * Public endpoint (no admin auth). Receives order notifications from LlamaFood.
 * Validates HMAC-SHA256 signature before processing.
 *
 * @module app/api/webhooks/llamafood/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlatformOrderService } from '@/src/core/services/platform-order.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    const signature = request.headers.get('x-llamafood-signature') || '';
    const rawBody = await request.text();

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const service = new PlatformOrderService(prisma);
    const result = await service.handleIncomingOrder(tenantId, 'LLAMAFOOD', payload, signature);

    if (!result.success) {
      const status = result.error.message.includes('signature') ? 401 : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json({ received: true, orderId: result.data.id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
