/**
 * GET /api/drivers - Listar drivers
 * POST /api/drivers - Crear driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DriverService, DriverServiceError } from '@/src/core/delivery';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

const CreateDriverSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres').optional(),
});

export async function GET() {
  try {
    const drivers = await DriverService.listWithStatus(TENANT_ID);
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const parsed = CreateDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const driver = await DriverService.create(
      TENANT_ID,
      parsed.data.name,
      parsed.data.phone
    );

    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error creating driver:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
