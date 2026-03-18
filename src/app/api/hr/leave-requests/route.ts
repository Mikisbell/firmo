/**
 * Leave Requests API
 * GET  - List leave requests for tenant (optional ?status filter)
 * POST - Create a new leave request
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LeaveRequestService } from '@/src/core/services/leave-request.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const status = request.nextUrl.searchParams.get('status') || undefined;

  try {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (status) where.status = status;

    const items = await prisma.leave_requests.findMany({
      where,
      include: { employee: { select: { name: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Error al obtener solicitudes de permiso' }, { status: 500 });
  }
}

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
      { success: false, error: { message: 'Cuerpo de solicitud inválido', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
