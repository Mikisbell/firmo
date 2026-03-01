/**
 * Reject Platform Order API - POST
 *
 * @module app/api/admin/platform-orders/[id]/reject/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PlatformOrderService } from '@/src/core/services/platform-order.service';
import prisma from '@/src/core/db/prisma';

const rejectOrderSchema = z.object({
  reason: z.string().min(1, 'Se requiere una razón'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = rejectOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const service = new PlatformOrderService(prisma);
  const result = await service.rejectOrder(authResult.user.tenantId, id, parsed.data.reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ order: result.data });
}
