/**
 * HR Employee Emergency Contacts API - POST
 *
 * Delegates to EmployeeService.addEmergencyContact().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EmployeeService } from '@/src/core/services/employee.service';
import { z } from 'zod';

const service = new EmployeeService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

const AddContactBody = z.object({
  name: z.string().min(1),
  relationship: z.enum(['SPOUSE', 'PARENT', 'SIBLING', 'CHILD', 'FRIEND', 'OTHER']),
  phone: z.string().min(1),
  address: z.string().nullish(),
  is_primary: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id: employeeId } = await params;

  try {
    const body = await request.json();
    const parsed = AddContactBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await service.addEmergencyContact(
      tenantId,
      employeeId,
      parsed.data as any,
    );

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error('Error al agregar contacto de emergencia:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al agregar contacto de emergencia' },
      { status: 500 },
    );
  }
}
