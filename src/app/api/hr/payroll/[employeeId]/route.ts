/**
 * HR Payroll History by Employee API - GET
 *
 * Get payroll history for a specific employee.
 * Delegates to PayrollService.getHistory().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PayrollService } from '@/src/core/services/payroll.service';
import { logger } from '@/src/core/observability/structured-logger';

const service = new PayrollService(prisma);

type RouteContext = { params: Promise<{ employeeId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { employeeId } = await params;

  try {
    const result = await service.getHistory(tenantId, employeeId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error('Error al obtener historial de planilla', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener historial de planilla' },
      { status: 500 },
    );
  }
}
