/**
 * POST /api/attendance/clock-out
 *
 * Registers an employee clock-out when a POS session ends.
 * Called fire-and-forget by clearSession() on the client side.
 *
 * Auth: x-tenant-id header (required) — no JWT, called at logout time.
 * Looks up the open attendance record for today and closes it.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { z } from 'zod';

const ClockOutBody = z.object({
  employee_id: z.string().uuid(),
  attendance_id: z.string().uuid().optional(),
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

  const parsed = ClockOutBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { employee_id, attendance_id } = parsed.data;

  try {
    const now = new Date();

    // Find the open attendance record for today (or use provided ID)
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const record = await prisma.attendance.findFirst({
      where: {
        tenant_id: tenantId,
        employee_id,
        ...(attendance_id ? { id: attendance_id } : { date: { gte: todayStart, lte: todayEnd } }),
        clock_out: null,
      },
      orderBy: { clock_in: 'desc' },
    });

    if (!record) {
      // No open record — not an error (idempotent)
      return NextResponse.json({ message: 'No hay registro abierto' }, { status: 200 });
    }

    const workedMinutes = Math.round(
      (now.getTime() - record.clock_in.getTime()) / 60_000,
    );

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        clock_out: now,
        worked_minutes: workedMinutes,
        updated_at: now,
      },
    });

    return NextResponse.json({ worked_minutes: updated.worked_minutes });
  } catch (error) {
    logger.error(
      'Error en clock-out automático',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al registrar salida' }, { status: 500 });
  }
}
