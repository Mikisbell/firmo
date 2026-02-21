/**
 * Leave Requests API - POST reject with reason
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new LeaveRequestService(prisma);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  try {
    const body = await request.json();
    const result = await service.reject(
      authResult.user.tenantId,
      id,
      authResult.user.id,
      body.reason,
    );
    return resultToResponse(result);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
