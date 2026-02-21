/**
 * HR Employee Search API - GET
 *
 * Search employees by name or DNI.
 * Delegates to EmployeeService.search().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EmployeeService } from '@/src/core/services/employee.service';

const service = new EmployeeService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const q = request.nextUrl.searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Parámetro de búsqueda "q" es requerido' },
        { status: 400 },
      );
    }

    const result = await service.search(tenantId, q.trim());

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al buscar empleados:', error);
    return NextResponse.json(
      { error: 'Error al buscar empleados' },
      { status: 500 },
    );
  }
}
