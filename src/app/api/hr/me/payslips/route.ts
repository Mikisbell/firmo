/**
 * Self-Service API - GET current employee's payroll history
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { PayrollService } from '@/src/core/services/payroll.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new PayrollService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;
  const result = await service.getHistory(tenantId, employeeId);
  return resultToResponse(result);
}
