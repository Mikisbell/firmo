/**
 * Complete Production API - PUT (completar lote cocido)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { polloControlService } from '@/src/core/services/pollo-control.service';
import { CompleteProductionSchema } from '@/src/core/admin/schemas/pollo-control.schema';
import { ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const { id } = await params;
    const body = await request.json();
    const validated = CompleteProductionSchema.parse(body);

    const result = await polloControlService.completeProduction(tenantId, id, validated);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'ALREADY_COMPLETED' ? 409
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: (error as ZodError).errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al completar producción' }, { status: 500 });
  }
}
