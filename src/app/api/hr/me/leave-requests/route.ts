/**
 * Self-Service API - GET/POST leave requests for current employee
 *
 * GET:  List the authenticated employee's own leave requests
 * POST: Submit a new leave request (employee self-service)
 */

import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new LeaveRequestService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await validateAdminAuth(request);
  if (!authResult.valid) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;
  const status = request.nextUrl.searchParams.get('status') ?? undefined;
  const leave_type = request.nextUrl.searchParams.get('leave_type') ?? undefined;

  const result = await service.listByEmployee(tenantId, employeeId, {
    status,
    leave_type,
  });
  return resultToResponse(result);
}

export async function POST(request: NextRequest) {
  const authResult = await validateAdminAuth(request);
  if (!authResult.valid) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;

  try {
    const body = await request.json();
    const result = await service.create(tenantId, {
      employee_id: employeeId,
      leave_type: body.leave_type,
      start_date: new Date(body.start_date),
      end_date: new Date(body.end_date),
      days_requested: body.days_requested,
      reason: body.reason,
      with_pay: body.with_pay,
      certificate_url: body.certificate_url,
      created_by: employeeId,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Invalid request body', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
