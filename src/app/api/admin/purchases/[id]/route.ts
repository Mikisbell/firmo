/**
 * Admin Purchase Order Detail API - PATCH
 *
 * Updates a purchase order status (DRAFT → CONFIRMED → RECEIVED).
 *
 * @module app/api/admin/purchases/[id]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PurchasesService } from '@/src/core/services/purchases.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const UpdateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'RECEIVED', 'CANCELLED']),
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
    const data = UpdateStatusSchema.parse(body);

    const service = new PurchasesService(prisma);
    const result = await service.updatePOStatus(
      authResult.user.tenantId,
      id,
      data.status,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
