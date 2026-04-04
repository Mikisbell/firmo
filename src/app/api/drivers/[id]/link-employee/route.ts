/**
 * PATCH /api/drivers/[id]/link-employee — Vincular/desvincular driver a empleado
 * Body: { employeeId: string } to link, { employeeId: null } to unlink
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DriverService, DriverServiceError } from '@/src/core/delivery';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { logger } from '@/src/core/observability/structured-logger';

const LinkEmployeeSchema = z.object({
  employeeId: z.string().uuid('ID de empleado inválido').nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = LinkEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    let driver;
    if (parsed.data.employeeId) {
      driver = await DriverService.linkToEmployee(id, parsed.data.employeeId);
    } else {
      driver = await DriverService.unlinkEmployee(id);
    }

    return NextResponse.json(driver);
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    logger.error('Error al vincular empleado', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
