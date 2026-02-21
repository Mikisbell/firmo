/**
 * Pollo Production API - POST (registrar lote de producción)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { polloControlService } from '@/src/core/services/pollo-control.service';
import { LogProductionSchema } from '@/src/core/admin/schemas/pollo-control.schema';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const validated = LogProductionSchema.parse(body);

    const result = await polloControlService.logProduction(tenantId, validated, authResult.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: (error as ZodError).errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al registrar producción' }, { status: 500 });
  }
}
