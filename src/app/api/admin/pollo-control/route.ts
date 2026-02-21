/**
 * Pollo Control Dashboard API - GET (equivalentes en tiempo real + resumen diario)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { polloControlService } from '@/src/core/services/pollo-control.service';
import { PolloDashboardQuerySchema } from '@/src/core/admin/schemas/pollo-control.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = PolloDashboardQuerySchema.parse(queryParams);

    const [equivalentsResult, summaryResult] = await Promise.all([
      polloControlService.getRealtimeEquivalents(tenantId, validated.location_id),
      polloControlService.getDailySummary(tenantId, validated.location_id, validated.date),
    ]);

    if (!equivalentsResult.success) {
      return NextResponse.json({ error: equivalentsResult.error.message }, { status: 500 });
    }
    if (!summaryResult.success) {
      return NextResponse.json({ error: summaryResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      equivalents: equivalentsResult.data,
      summary: summaryResult.data,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: (error as ZodError).errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al obtener dashboard de pollo' }, { status: 500 });
  }
}
