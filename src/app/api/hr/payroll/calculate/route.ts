/**
 * HR Payroll Calculate API - POST
 *
 * Calculate payroll for a period.
 * If employee_id is provided, calculates for one employee.
 * Otherwise, calculates for all active employees (batch).
 *
 * Delegates to PayrollService.calculateForEmployee() or calculateMonthly().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PayrollService } from '@/src/core/services/payroll.service';
import { z } from 'zod';

const service = new PayrollService(prisma);

const CalculateBody = z.object({
  period_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM requerido'),
  employee_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = CalculateBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { period_month, employee_id } = parsed.data;

    // Single employee calculation
    if (employee_id) {
      const result = await service.calculateForEmployee(
        tenantId,
        employee_id,
        period_month,
        authResult.user.id,
      );

      if (!result.success) {
        const status =
          result.error.code === 'NOT_FOUND' ? 404
          : result.error.code === 'VALIDATION_ERROR' ? 400
          : 500;
        return NextResponse.json({ error: result.error.message }, { status });
      }

      return NextResponse.json(result.data, { status: 201 });
    }

    // Batch calculation for all active employees
    const result = await service.calculateMonthly(
      tenantId,
      period_month,
      authResult.user.id,
    );

    if (!result.success) {
      const status =
        result.error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error al calcular planilla:', error);
    return NextResponse.json(
      { error: 'Error al calcular planilla' },
      { status: 500 },
    );
  }
}
