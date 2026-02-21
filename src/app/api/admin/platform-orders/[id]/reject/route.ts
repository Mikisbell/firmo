/**
 * Reject Platform Order API - POST
 *
 * @module app/api/admin/platform-orders/[id]/reject/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PlatformOrderService } from '@/src/core/services/platform-order.service';
import prisma from '@/src/core/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  const service = new PlatformOrderService(prisma);
  const result = await service.rejectOrder(authResult.user.tenantId, id, body.reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ order: result.data });
}
