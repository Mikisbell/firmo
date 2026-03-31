/**
 * GET /api/admin/attendance/daily
 *
 * Returns daily attendance summary per employee with order stats.
 *
 * Query params:
 *   date (optional) — YYYY-MM-DD, defaults to today in Lima time
 *
 * Response per employee:
 *   employee_id, employee_name, role, clock_in, clock_out?,
 *   worked_minutes, orders_count, revenue_cents
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { logger } from '@/src/core/observability/structured-logger';

// Lima timezone offset: UTC-5
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;

function toLimaDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + LIMA_OFFSET_MS);
}

function todayLima(): string {
  return toLimaDate(new Date()).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  const dateParam = request.nextUrl.searchParams.get('date') || todayLima();

  // Parse and build UTC day boundaries from Lima date string
  const [year, month, day] = dateParam.split('-').map(Number);
  // Start of day Lima → UTC
  const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - LIMA_OFFSET_MS);
  const dayEndUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - LIMA_OFFSET_MS);
  // Date-only for attendance.date column (stored as Date, no timezone)
  const attendanceDate = new Date(Date.UTC(year, month - 1, day));

  try {
    // 1. Get all attendance records for this day
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        tenant_id: tenantId,
        date: attendanceDate,
      },
      orderBy: { clock_in: 'asc' },
    });

    if (attendanceRecords.length === 0) {
      return NextResponse.json([]);
    }

    const employeeIds = attendanceRecords.map((r) => r.employee_id);

    // 2. Get employee names and roles in one query
    const employees = await prisma.employees.findMany({
      where: { tenant_id: tenantId, id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // 3. Get order stats per employee (using waiter_id)
    const orderStats = await prisma.orders.groupBy({
      by: ['waiter_id'],
      where: {
        tenant_id: tenantId,
        waiter_id: { in: employeeIds },
        created_at: { gte: dayStartUtc, lte: dayEndUtc },
      },
      _count: { id: true },
      _sum: { total_cents: true },
    });
    const orderMap = new Map(
      orderStats.map((s) => [
        s.waiter_id ?? '',
        { count: s._count.id, revenue: s._sum.total_cents ?? 0 },
      ]),
    );

    // 4. Build response
    const result = attendanceRecords.map((rec) => {
      const emp = employeeMap.get(rec.employee_id);
      const orders = orderMap.get(rec.employee_id) ?? { count: 0, revenue: 0 };
      return {
        employee_id: rec.employee_id,
        employee_name: emp?.name ?? 'Desconocido',
        role: emp?.role ?? '',
        clock_in: rec.clock_in.toISOString(),
        clock_out: rec.clock_out ? rec.clock_out.toISOString() : null,
        worked_minutes: rec.worked_minutes,
        status: rec.status,
        orders_count: orders.count,
        revenue_cents: orders.revenue,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      'Error al obtener actividad diaria',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al obtener actividad diaria' }, { status: 500 });
  }
}
