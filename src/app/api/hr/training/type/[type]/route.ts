/**
 * Training API - GET list by training type
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TrainingService } from '@/src/core/services/training.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new TrainingService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { type } = await params;
  const result = await service.listByType(authResult.user.tenantId, type);
  return resultToResponse(result);
}
