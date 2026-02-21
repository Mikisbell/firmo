/**
 * HR Schedule Assignment API - POST
 *
 * Assign a schedule template to one or more employees.
 * Delegates to ScheduleService.assignToEmployee().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ScheduleService } from '@/src/core/services/schedule.service';
import { z } from 'zod';

const service = new ScheduleService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

const AssignBody = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
  start_date: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id: templateId } = await params;

  try {
    const body = await request.json();
    const parsed = AssignBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const startDate = new Date(parsed.data.start_date);
    const assignments: unknown[] = [];
    const errors: Array<{ employee_id: string; error: string }> = [];

    for (const employeeId of parsed.data.employee_ids) {
      const result = await service.assignToEmployee(
        tenantId,
        employeeId,
        templateId,
        startDate,
      );

      if (result.success) {
        assignments.push(result.data);
      } else {
        errors.push({ employee_id: employeeId, error: result.error.message });
      }
    }

    return NextResponse.json(
      { assignments, errors, total: parsed.data.employee_ids.length },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error al asignar horario:', error);
    return NextResponse.json(
      { error: 'Error al asignar horario' },
      { status: 500 },
    );
  }
}
