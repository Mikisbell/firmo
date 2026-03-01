/**
 * Occupy Table API - POST
 *
 * @module app/api/admin/mesas/[id]/occupy/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { MesaService } from '@/src/core/services/mesa.service';
import prisma from '@/src/core/db/prisma';

const occupyTableSchema = z.object({
  guestCount: z.number({ required_error: 'guestCount es requerido' }).int().min(1, 'guestCount debe ser al menos 1'),
  orderId: z.string().optional(),
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

  const parsed = occupyTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { guestCount, orderId } = parsed.data;

  const service = new MesaService(prisma);
  const result = await service.occupyTable(
    authResult.user.tenantId,
    id,
    guestCount,
    orderId,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
