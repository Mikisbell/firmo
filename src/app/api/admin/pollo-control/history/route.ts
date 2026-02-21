/**
 * Pollo Production History API - GET (historial de lotes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { polloControlService } from '@/src/core/services/pollo-control.service';
import { PolloHistoryQuerySchema } from '@/src/core/admin/schemas/pollo-control.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validated = PolloHistoryQuerySchema.parse(queryParams);

    const result = await polloControlService.getProductionHistory(
      tenantId,
      validated.location_id,
      validated.page,
      validated.limit,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: (error as ZodError).errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
  }
}
