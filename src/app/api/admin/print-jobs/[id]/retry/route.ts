/**
 * Print Job Retry API - POST
 *
 * Retries a failed print job by resetting its status to QUEUED.
 *
 * @module app/api/admin/print-jobs/[id]/retry/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PrintJobService } from '@/src/core/services/print-job.service';
import prisma from '@/src/core/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  try {
    const service = new PrintJobService(prisma);
    const result = await service.retryJob(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Job reencolado correctamente' });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
