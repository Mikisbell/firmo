/**
 * HR Weekly Schedule Calendar API - GET
 *
 * Get weekly calendar for a location.
 * Delegates to ScheduleService.getWeeklyCalendar().
 *
 * Query: location_id (required), week_start (required, YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ScheduleService } from '@/src/core/services/schedule.service';

const service = new ScheduleService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const url = request.nextUrl;
    const locationId = url.searchParams.get('location_id');
    const weekStartStr = url.searchParams.get('week_start');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Parámetro location_id es requerido' },
        { status: 400 },
      );
    }

    if (!weekStartStr || !/^\d{4}-\d{2}-\d{2}$/.test(weekStartStr)) {
      return NextResponse.json(
        { error: 'Parámetro week_start es requerido (formato YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    const weekStart = new Date(weekStartStr);

    const result = await service.getWeeklyCalendar(tenantId, locationId, weekStart);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al obtener calendario semanal:', error);
    return NextResponse.json(
      { error: 'Error al obtener calendario semanal' },
      { status: 500 },
    );
  }
}
