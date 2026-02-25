/**
 * Self-Service API - GET current employee's vacation balance
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new LeaveRequestService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;
  const result = await service.getVacationBalance(tenantId, employeeId);
  return resultToResponse(result);
}
