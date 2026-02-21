/**
 * Admin Reconciliation Detail API - PATCH
 *
 * Records actual received amount for a settlement.
 *
 * @module app/api/admin/reconciliation/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ReconciliationService } from '@/src/core/services/reconciliation.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const UpdateSchema = z.object({
  receivedCents: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = UpdateSchema.parse(body);

    const service = new ReconciliationService(prisma);
    const result = await service.recordActualReceived(
      authResult.user.tenantId,
      id,
      data.receivedCents,
      authResult.user.id,
      data.notes,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
