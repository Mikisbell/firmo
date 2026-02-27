/**
 * HR Attendance Monthly Report API - GET
 *
 * Get monthly attendance summary for an employee.
 * Delegates to AttendanceService.getMonthlyReport().
 *
 * Query: employee_id (required), month (required, format YYYY-MM)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AttendanceService } from '@/src/core/services/attendance.service';

const service = new AttendanceService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const url = request.nextUrl;
    const employeeId = url.searchParams.get('employee_id');
    const month = url.searchParams.get('month');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Parámetro employee_id es requerido' },
        { status: 400 },
      );
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month es requerido (formato YYYY-MM)' },
        { status: 400 },
      );
    }

    const result = await service.getMonthlyReport(tenantId, employeeId, month);

    if (!result.success) {
      const status =
        result.error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al obtener reporte de asistencia:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al obtener reporte de asistencia' },
      { status: 500 },
    );
  }
}
