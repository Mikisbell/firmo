import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/src/core/middleware';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { ExecutiveDashboardService } from '@/src/core/services/executive-dashboard.service';
import type { PeriodPreset, PeriodRange } from '@/src/core/types/executive-dashboard';

const QuerySchema = z.object({
  preset: z.enum(['today', 'week', 'month', 'custom']),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'view_reports');
  if (!authResult.authorized) return authResult.response;

  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams);
    const params = QuerySchema.parse(raw);

    const startDate = new Date(params.start);
    const endDate = new Date(params.end);
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Fecha inicio debe ser anterior a fecha fin' },
        { status: 400 },
      );
    }

    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 90) {
      return NextResponse.json(
        { error: 'Rango máximo: 90 días' },
        { status: 400 },
      );
    }

    const period: PeriodRange = {
      preset: params.preset as PeriodPreset,
      start: params.start,
      end: params.end,
    };

    const service = new ExecutiveDashboardService(prisma);
    const data = await service.getData(authResult.user.tenantId, period);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Error al generar dashboard ejecutivo' },
      { status: 500 },
    );
  }
}
