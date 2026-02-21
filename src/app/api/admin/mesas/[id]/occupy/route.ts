/**
 * Occupy Table API - POST
 *
 * @module app/api/admin/mesas/[id]/occupy/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { MesaService } from '@/src/core/services/mesa.service';
import prisma from '@/src/core/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  let body: { guestCount?: number; orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.guestCount || typeof body.guestCount !== 'number') {
    return NextResponse.json({ error: 'guestCount es requerido' }, { status: 400 });
  }

  const service = new MesaService(prisma);
  const result = await service.occupyTable(
    authResult.user.tenantId,
    id,
    body.guestCount,
    body.orderId,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
