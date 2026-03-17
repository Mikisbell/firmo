/**
 * Admin Loyalty Config API - GET and PUT
 * Manage tenant loyalty program configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LoyaltyService } from '@/src/core/services/loyalty.service';
import { UpdateLoyaltyConfigSchema } from '@/src/core/admin/schemas/loyalty.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const service = new LoyaltyService();
    const config = await service.getLoyaltyConfig(authResult.user.tenantId);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener configuración de fidelización' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const validated = UpdateLoyaltyConfigSchema.parse(body);

    const service = new LoyaltyService();
    const result = await service.updateLoyaltyConfig(authResult.user.tenantId, validated);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos de configuración inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar configuración' },
      { status: 500 },
    );
  }
}
