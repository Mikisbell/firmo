/**
 * Evaluations API - POST complete (DRAFT -> COMPLETED)
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EvaluationService } from '@/src/core/services/evaluation.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new EvaluationService(prisma);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  const result = await service.complete(authResult.user.tenantId, id);
  return resultToResponse(result);
}
