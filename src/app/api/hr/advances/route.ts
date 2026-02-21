/**
 * Advances API - POST (request advance)
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AdvanceService } from '@/src/core/services/advance.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new AdvanceService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const result = await service.request(tenantId, {
      employee_id: body.employee_id,
      amount_cents: body.amount_cents,
      reason: body.reason,
      requested_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
