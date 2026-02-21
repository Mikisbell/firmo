/**
 * HR Schedules API - GET (list templates) and POST (create template)
 *
 * Delegates to ScheduleService for all business logic.
 * All operations scoped by tenant_id from JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ScheduleService } from '@/src/core/services/schedule.service';
import { z } from 'zod';

const service = new ScheduleService(prisma);

// ---------------------------------------------------------------------------
// GET - List schedule templates
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const templates = await prisma.schedule_templates.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error al listar plantillas de horario:', error);
    return NextResponse.json(
      { error: 'Error al listar plantillas de horario' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Create schedule template
// ---------------------------------------------------------------------------

const CreateTemplateBody = z.object({
  location_id: z.string().min(1),
  name: z.string().min(1),
  schedule_type: z.enum(['FIXED', 'ROTATING']),
  days_of_week: z.array(z.number().int().min(1).max(7)).min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  break_minutes: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = CreateTemplateBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await service.createTemplate(tenantId, parsed.data as any);

    if (!result.success) {
      const status =
        result.error.code === 'VALIDATION_ERROR' ? 400 : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error al crear plantilla de horario:', error);
    return NextResponse.json(
      { error: 'Error al crear plantilla de horario' },
      { status: 500 },
    );
  }
}
