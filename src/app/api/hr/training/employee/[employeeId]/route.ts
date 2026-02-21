/**
 * Training API - GET list by employee
 * Query params: ?training_type=...
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TrainingService } from '@/src/core/services/training.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new TrainingService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { employeeId } = await params;
  const training_type =
    request.nextUrl.searchParams.get('training_type') ?? undefined;

  const result = await service.listByEmployee(
    authResult.user.tenantId,
    employeeId,
    { training_type },
  );
  return resultToResponse(result);
}
