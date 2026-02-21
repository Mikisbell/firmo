/**
 * Yape/Plin Settings API - GET (read) and PUT (update)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { YapePlinSettingsSchema } from '@/src/core/admin/schemas/yape-plin.schema';
import prisma from '@/src/core/db/prisma';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;

    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        yape_merchant_phone: true,
        yape_merchant_name: true,
        plin_merchant_phone: true,
        plin_merchant_name: true,
      },
    });

    return NextResponse.json(settings ?? {
      yape_merchant_phone: null,
      yape_merchant_name: null,
      plin_merchant_phone: null,
      plin_merchant_name: null,
    });
  } catch {
    return NextResponse.json({ error: 'Error al obtener configuración Yape/Plin' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const validated = YapePlinSettingsSchema.parse(body);

    const updated = await prisma.tenant_settings.update({
      where: { tenant_id: tenantId },
      data: {
        yape_merchant_phone: validated.yape_merchant_phone ?? null,
        yape_merchant_name: validated.yape_merchant_name ?? null,
        plin_merchant_phone: validated.plin_merchant_phone ?? null,
        plin_merchant_name: validated.plin_merchant_name ?? null,
      },
      select: {
        yape_merchant_phone: true,
        yape_merchant_name: true,
        plin_merchant_phone: true,
        plin_merchant_name: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Error al actualizar configuración Yape/Plin' }, { status: 500 });
  }
}
