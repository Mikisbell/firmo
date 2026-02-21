/**
 * Leave Requests API - GET list by employee
 * Query params: ?status=...&leave_type=...
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new LeaveRequestService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { employeeId } = await params;
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const leave_type = request.nextUrl.searchParams.get('leave_type') ?? undefined;

  const result = await service.listByEmployee(
    authResult.user.tenantId,
    employeeId,
    { status, leave_type },
  );
  return resultToResponse(result);
}
