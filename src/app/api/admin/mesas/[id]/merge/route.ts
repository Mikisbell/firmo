/**
 * Merge Tables API - POST
 *
 * @module app/api/admin/mesas/[id]/merge/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { MesaService } from '@/src/core/services/mesa.service';
import prisma from '@/src/core/db/prisma';

const mergeTablesSchema = z.object({
  childTableIds: z.array(z.string(), { required_error: 'childTableIds es requerido' }).min(1, 'childTableIds debe ser un array no vacío'),
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

  const parsed = mergeTablesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { childTableIds } = parsed.data;

  const service = new MesaService(prisma);
  const result = await service.mergeTables(authResult.user.tenantId, id, childTableIds);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
