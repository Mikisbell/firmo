/**
 * Admin Petty Cash Reconcile API - POST
 *
 * Reconciles the petty cash balance with a physical count.
 *
 * @module app/api/admin/petty-cash/reconcile/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PettyCashService } from '@/src/core/services/petty-cash.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const ReconcileSchema = z.object({
  locationId: z.string().uuid(),
  countedAmount: z.number().int().min(0),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const data = ReconcileSchema.parse(body);

    const service = new PettyCashService(prisma);
    const result = await service.reconcile(
      authResult.user.tenantId,
      data.locationId,
      data.countedAmount,
      authResult.user.id,
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
