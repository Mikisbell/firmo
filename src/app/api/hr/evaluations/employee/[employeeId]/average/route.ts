/**
 * Evaluations API - GET average score for employee
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EvaluationService } from '@/src/core/services/evaluation.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new EvaluationService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { employeeId } = await params;
  const result = await service.getAverageScore(
    authResult.user.tenantId,
    employeeId,
  );
  return resultToResponse(result);
}
