/**
 * HR Attendance API - GET (list) and POST (clock in)
 *
 * Delegates to AttendanceService for all business logic.
 * All operations scoped by tenant_id from JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AttendanceService } from '@/src/core/services/attendance.service';
import { z } from 'zod';

const service = new AttendanceService(prisma);

// ---------------------------------------------------------------------------
// GET - List attendance records for employee within a date range
// Query: employee_id (required), start_date, end_date
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const url = request.nextUrl;
    const employeeId = url.searchParams.get('employee_id');
    const startDateStr = url.searchParams.get('start_date');
    const endDateStr = url.searchParams.get('end_date');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Parámetro employee_id es requerido' },
        { status: 400 },
      );
    }

    // Default to current month if not provided
    const now = new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateStr
      ? new Date(endDateStr)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await service.getByEmployee(tenantId, employeeId, startDate, endDate);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al listar asistencias:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al listar asistencias' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Clock in
// ---------------------------------------------------------------------------

const ClockInBody = z.object({
  employee_id: z.string().uuid(),
  clock_in_time: z.string().optional(),
  schedule_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = ClockInBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const clockInTime = parsed.data.clock_in_time
      ? new Date(parsed.data.clock_in_time)
      : new Date();

    const result = await service.clockIn(
      tenantId,
      parsed.data.employee_id,
      clockInTime,
      parsed.data.schedule_id,
    );

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'CONFLICT' ? 409
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error al registrar entrada:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al registrar entrada' },
      { status: 500 },
    );
  }
}
