/**
 * Leave Requests API - POST (create)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const LeaveRequestSchema = z.object({
  employee_id: z.string().min(1).max(255),
  leave_type: z.string().min(1).max(50),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  days_requested: z.number().int().positive().max(365),
  reason: z.string().max(500).optional(),
  with_pay: z.boolean(),
  certificate_url: z.string().url().optional(),
});

const service = new LeaveRequestService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = LeaveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const result = await service.create(tenantId, {
      employee_id: parsed.data.employee_id,
      leave_type: parsed.data.leave_type,
      start_date: new Date(parsed.data.start_date),
      end_date: new Date(parsed.data.end_date),
      days_requested: parsed.data.days_requested,
      reason: parsed.data.reason,
      with_pay: parsed.data.with_pay,
      certificate_url: parsed.data.certificate_url,
      created_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
