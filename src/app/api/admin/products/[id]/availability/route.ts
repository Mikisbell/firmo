/**
 * Product Availability API - PUT (toggle Auto-86)
 *
 * Body: { is_available: boolean, reason?: "MANUAL" | "LOW_STOCK" | "INGREDIENT_OUT" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { productAvailabilityService } from '@/src/core/services/product-availability.service';
import { z, ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ToggleAvailabilitySchema = z.object({
  is_available: z.boolean(),
  reason: z.enum(['MANUAL', 'LOW_STOCK', 'INGREDIENT_OUT']).default('MANUAL'),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const { id } = await params;
    const body = await request.json();
    const validated = ToggleAvailabilitySchema.parse(body);

    const result = validated.is_available
      ? await productAvailabilityService.markAvailable(tenantId, id, authResult.user.id)
      : await productAvailabilityService.markUnavailable(tenantId, id, validated.reason, authResult.user.id);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
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
    return NextResponse.json({ error: 'Error al cambiar disponibilidad' }, { status: 500 });
  }
}
