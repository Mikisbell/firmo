/**
 * Self-Service API - GET current employee's weekly schedule
 *
 * Returns schedules for the current week (Monday-Sunday) for the
 * authenticated employee. Looks up their assigned location first.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateAdminAuth } from '@/src/core/middleware/admin-auth';
import { ScheduleService } from '@/src/core/services/schedule.service';

const scheduleService = new ScheduleService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await validateAdminAuth(request);
  if (!authResult.valid) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;

  try {
    // Find the employee's active schedule assignment to get their location
    const assignment = await prisma.employee_schedules.findFirst({
      where: {
        tenant_id: tenantId,
        employee_id: employeeId,
        is_active: true,
      },
      include: { template: true },
    });

    if (!assignment) {
      return NextResponse.json([]);
    }

    // Calculate current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);

    const result = await scheduleService.getWeeklyCalendar(
      tenantId,
      assignment.template.location_id,
      weekStart,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    // Filter to only the current employee's entries
    const mySchedule = result.data.filter(
      (entry) => entry.employee_id === employeeId,
    );

    return NextResponse.json(mySchedule);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching schedule' },
      { status: 500 },
    );
  }
}
