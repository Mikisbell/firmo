/**
 * Training API
 * GET  - List training records for tenant (optional ?type filter)
 * POST - Record a new training
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TrainingService } from '@/src/core/services/training.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const type = request.nextUrl.searchParams.get('type') || undefined;

  try {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (type) where.training_type = type;

    const items = await prisma.training_records.findMany({
      where,
      include: { employee: { select: { name: true, role: true } } },
      orderBy: { completion_date: 'desc' },
      take: 100,
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: 'Error al obtener capacitaciones' }, { status: 500 });
  }
}

const service = new TrainingService(prisma);

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const result = await service.record(tenantId, {
      employee_id: body.employee_id,
      training_name: body.training_name,
      training_type: body.training_type,
      provider: body.provider,
      duration_hours: body.duration_hours,
      completion_date: new Date(body.completion_date),
      certificate_url: body.certificate_url,
      score: body.score,
      notes: body.notes,
      assigned_by: body.assigned_by,
      recorded_by: authResult.user.id,
    });

    return resultToResponse(result, 201);
  } catch {
    return resultToResponse(
      { success: false, error: { message: 'Cuerpo de solicitud inválido', code: 'VALIDATION_ERROR', name: 'DomainError' } as any },
    );
  }
}
