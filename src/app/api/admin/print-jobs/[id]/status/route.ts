/**
 * Print Job Status API - PATCH
 *
 * @module app/api/admin/print-jobs/[id]/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PrintJobService } from '@/src/core/services/print-job.service';
import prisma from '@/src/core/db/prisma';

const updatePrintJobStatusSchema = z.object({
  status: z.enum(['SENT', 'PRINTED', 'FAILED'], { message: 'status inválido (SENT, PRINTED, FAILED)' }),
});

export async function PATCH(
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

  const parsed = updatePrintJobStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const service = new PrintJobService(prisma);
    let result;

    switch (parsed.data.status) {
      case 'SENT':
        result = await service.markJobSent(authResult.user.tenantId, id);
        break;
      case 'PRINTED':
        result = await service.markJobPrinted(authResult.user.tenantId, id);
        break;
      case 'FAILED':
        result = await service.markJobFailed(authResult.user.tenantId, id);
        break;
      default:
        return NextResponse.json({ error: 'status inválido' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
