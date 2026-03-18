/**
 * Advances API
 * GET  - List advances for tenant (optional ?status filter)
 * POST - Request a new advance
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AdvanceService } from '@/src/core/services/advance.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const status = request.nextUrl.searchParams.get('status') || undefined;

  try {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (status) where.status = status;

    const items = await prisma.advances.findMany({
      where,
      include: { employee: { select: { name: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Error al obtener adelantos' }, { status: 500 });
  }
}

const AdvanceRequestSchema = z.object({
  employee_id: z.string().min(1).max(255),
  amount_cents: z.number().int().positive().max(99999999),
  reason: z.string().min(1).max(500),
});

const service = new AdvanceService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = AdvanceRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const result = await service.request(tenantId, {
      employee_id: parsed.data.employee_id,
      amount_cents: parsed.data.amount_cents,
      reason: parsed.data.reason,
      requested_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Cuerpo de solicitud inválido', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
