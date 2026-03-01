/**
 * HR Employee Search API - GET
 *
 * Search employees by name or DNI.
 * Delegates to EmployeeService.search().
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EmployeeService } from '@/src/core/services/employee.service';
import { logger } from '@/src/core/observability/structured-logger';

const employeeSearchSchema = z.object({
  q: z.string().min(1, 'Parámetro de búsqueda "q" es requerido'),
});

const service = new EmployeeService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const parsed = employeeSearchSchema.safeParse({
      q: (request.nextUrl.searchParams.get('q') ?? '').trim() || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await service.search(tenantId, parsed.data.q);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error('Error al buscar empleados', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al buscar empleados' },
      { status: 500 },
    );
  }
}
