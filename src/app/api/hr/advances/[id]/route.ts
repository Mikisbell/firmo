/**
 * Advances API - GET single by ID
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AdvanceService } from '@/src/core/services/advance.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new AdvanceService(prisma);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  const result = await service.getById(authResult.user.tenantId, id);
  return resultToResponse(result);
}
