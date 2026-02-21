/**
 * HR Employees API - GET (list) and POST (create)
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

// ---------------------------------------------------------------------------
// GET - List employees with pagination and filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const role = url.searchParams.get('role') || undefined;
    const isActiveParam = url.searchParams.get('is_active');
    const search = url.searchParams.get('search') || undefined;

    const is_active =
      isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const result = await service.list(tenantId, { page, pageSize, role, is_active, search });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Error al listar empleados HR:', error);
    return NextResponse.json(
      { error: 'Error al listar empleados' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Create new employee
// ---------------------------------------------------------------------------

const CreateEmployeeBody = z.object({
  name: z.string().min(1),
  role: z.enum(['CASHIER', 'WAITER', 'COOK', 'SUPERVISOR', 'ADMIN']),
  pin_hash: z.string().nullish(),
  dni: z.string().nullish(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  address: z.string().nullish(),
  birth_date: z.string().nullish(),
  profile_photo_url: z.string().url().nullish(),
  hire_date: z.string().min(1),
  position: z.string().min(1),
  base_salary_cents: z.number().int().min(0),
  contract_type: z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'PART_TIME']),
  work_schedule_type: z.enum(['FULL_TIME', 'PART_TIME', 'ROTATING']),
  location_id: z.string().nullish(),
  commission_rate: z.number().nullish(),
  pension_system: z.enum(['ONP', 'AFP_INTEGRA', 'AFP_PRIMA', 'AFP_PROFUTURO', 'AFP_HABITAT']).nullish(),
  has_health_insurance: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;

  try {
    const body = await request.json();
    const parsed = CreateEmployeeBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const result = await service.create(tenantId, {
      ...data,
      role: data.role as any,
      contract_type: data.contract_type as any,
      work_schedule_type: data.work_schedule_type as any,
      pension_system: (data.pension_system as any) ?? null,
      hire_date: new Date(data.hire_date),
      birth_date: data.birth_date ? new Date(data.birth_date) : null,
      created_by: authResult.user.id,
    });

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error al crear empleado HR:', error);
    return NextResponse.json(
      { error: 'Error al crear empleado' },
      { status: 500 },
    );
  }
}
