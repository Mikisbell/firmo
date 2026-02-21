/**
 * Leave Requests API - POST (create)
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new LeaveRequestService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const result = await service.create(tenantId, {
      employee_id: body.employee_id,
      leave_type: body.leave_type,
      start_date: new Date(body.start_date),
      end_date: new Date(body.end_date),
      days_requested: body.days_requested,
      reason: body.reason,
      with_pay: body.with_pay,
      certificate_url: body.certificate_url,
      created_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
