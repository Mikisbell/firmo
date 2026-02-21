/**
 * HR Payroll by Period API - GET
 *
 * List all payroll records for a given period (YYYY-MM).
 * Delegates to PayrollService.listByPeriod().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PayrollService } from '@/src/core/services/payroll.service';

const service = new PayrollService(prisma);

type RouteContext = { params: Promise<{ periodMonth: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { periodMonth } = await params;

  try {
    // Validate format
    if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
      return NextResponse.json(
        { error: 'Formato de período inválido. Use YYYY-MM' },
        { status: 400 },
      );
    }

    const result = await service.listByPeriod(tenantId, periodMonth);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al listar planillas del período:', error);
    return NextResponse.json(
      { error: 'Error al listar planillas del período' },
      { status: 500 },
    );
  }
}
