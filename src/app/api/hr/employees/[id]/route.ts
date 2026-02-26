/**
 * HR Employee Detail API - GET, PATCH, DELETE
 *
 * Delegates to EmployeeService for all business logic.
 * All operations scoped by tenant_id from JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EmployeeService } from '@/src/core/services/employee.service';
import { z } from 'zod';

const service = new EmployeeService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET - Get single employee by ID
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id } = await params;

  try {
    const result = await service.getById(tenantId, id);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al obtener empleado HR:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleado' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH - Partial update employee profile
// ---------------------------------------------------------------------------

const UpdateEmployeeBody = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'WAITER', 'KITCHEN', 'COOK', 'PACKER', 'BAR', 'DRIVER']).optional(),
  dni: z.string().nullish(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  birth_date: z.string().nullish(),
  profile_photo_url: z.string().url().nullish(),
  position: z.string().min(1).optional(),
  base_salary_cents: z.number().int().min(0).optional(),
  contract_type: z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'PART_TIME']).optional(),
  work_schedule_type: z.enum(['FULL_TIME', 'PART_TIME', 'ROTATING']).optional(),
  location_id: z.string().nullish(),
  commission_rate: z.number().nullish(),
  pension_system: z.enum(['ONP', 'AFP_INTEGRA', 'AFP_PRIMA', 'AFP_PROFUTURO', 'AFP_HABITAT']).nullish(),
  has_health_insurance: z.boolean().optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = UpdateEmployeeBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const changes: Record<string, unknown> = { ...parsed.data };
    if (typeof changes.birth_date === 'string') {
      changes.birth_date = new Date(changes.birth_date as string);
    }

    const result = await service.update(tenantId, id, changes as any, authResult.user.id);

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al actualizar empleado HR:', error);
    return NextResponse.json(
      { error: 'Error al actualizar empleado' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE - Soft delete (deactivate) employee
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const reason = (body as any)?.reason || 'Desactivado por administrador';

    const result = await service.deactivate(tenantId, id, reason, authResult.user.id);

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error al desactivar empleado HR:', error);
    return NextResponse.json(
      { error: 'Error al desactivar empleado' },
      { status: 500 },
    );
  }
}
