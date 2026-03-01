/**
 * HR Attendance Justify API - POST
 *
 * Justify an absence with a reason and optional certificate URL.
 * Delegates to AttendanceService.justifyAbsence().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { AttendanceService } from '@/src/core/services/attendance.service';
import { z } from 'zod';
import { logger } from '@/src/core/observability/structured-logger';

const service = new AttendanceService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

const JustifyBody = z.object({
  justification: z.string().min(1),
  certificate_url: z.string().url().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id: attendanceId } = await params;

  try {
    const body = await request.json();
    const parsed = JustifyBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await service.justifyAbsence(
      tenantId,
      attendanceId,
      parsed.data.justification,
      parsed.data.certificate_url,
    );

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logger.error('Error al justificar inasistencia', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al justificar inasistencia' },
      { status: 500 },
    );
  }
}
