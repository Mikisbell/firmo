/**
 * POST /api/attendance/clock-in
 *
 * Registers an employee clock-in when a POS session starts.
 * Called fire-and-forget by createSession() on the client side,
 * so there is no JWT available yet.
 *
 * Auth: x-tenant-id header (required) — no JWT, called at login time.
 * Idempotent: if the employee is already clocked in today, returns 200.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { AttendanceService } from '@/src/core/services/attendance.service';
import { logger } from '@/src/core/observability/structured-logger';
import { z } from 'zod';

const service = new AttendanceService(prisma);

const ClockInBody = z.object({
  employee_id: z.string().uuid(),
  terminal_id: z.string().min(1),
  role: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'x-tenant-id header requerido' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const parsed = ClockInBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { employee_id } = parsed.data;

  try {
    const result = await service.clockIn(tenantId, employee_id, new Date());

    if (!result.success) {
      // CONFLICT = already clocked in today — treat as success (idempotent)
      if (result.error.code === 'CONFLICT') {
        return NextResponse.json({ message: 'Ya registrado hoy' }, { status: 200 });
      }
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(
      { attendance_id: result.data.id, clock_in: result.data.clock_in },
      { status: 201 },
    );
  } catch (error) {
    logger.error(
      'Error en clock-in automático',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al registrar entrada' }, { status: 500 });
  }
}
