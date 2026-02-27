/**
 * HR Attendance Clock Out API - POST
 *
 * Delegates to AttendanceService.clockOut().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AttendanceService } from '@/src/core/services/attendance.service';
import { z } from 'zod';

const service = new AttendanceService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

const ClockOutBody = z.object({
  clock_out_time: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id: attendanceId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = ClockOutBody.safeParse(body);

    const clockOutTime = parsed.success && parsed.data.clock_out_time
      ? new Date(parsed.data.clock_out_time)
      : new Date();

    const result = await service.clockOut(tenantId, attendanceId, clockOutTime);

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'CONFLICT' ? 409
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al registrar salida:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al registrar salida' },
      { status: 500 },
    );
  }
}
