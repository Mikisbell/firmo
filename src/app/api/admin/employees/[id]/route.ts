/**
 * Employees API - GET, PUT, DELETE for single employee
 * Requirements: 1.3, 1.4, 10.2, 10.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { hashPin } from '@/src/core/auth/crypto-utils';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { cache } from '@/src/core/cache/redis.service';
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';
import { logger } from '@/src/core/observability/structured-logger';

const updateEmployeeSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').optional(),
  role: z.enum(EMPLOYEE_ROLES, { message: `Rol inválido. Debe ser uno de: ${EMPLOYEE_ROLES.join(', ')}` }).optional(),
  is_active: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN debe ser de 4-6 dígitos numéricos').optional(),
  dni: z.union([
    z.string().regex(/^\d{8}$/, 'DNI debe tener exactamente 8 dígitos numéricos'),
    z.literal(''),
    z.null(),
  ]).optional(),
});

const SALT = 'PARK_POS_2026_'; // Must match seed.ts and route.ts



// Validate UUID format
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// GET - Get single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }
    
    const employee = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true,
            is_active: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    logger.error('Error al obtener empleado', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener empleado' },
      { status: 500 }
    );
  }
}

// PUT - Update employee
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, role, is_active, pin, dni } = parsed.data;

    // Check employee exists and belongs to tenant
    const existing = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // If PIN is being changed, check uniqueness within tenant
    let pin_hash: string | undefined;
    if (pin) {
      pin_hash = await hashPin(pin);
      const existingPin = await prisma.employees.findFirst({
        where: {
          tenant_id: tenantId,
          pin_hash,
          is_active: true,
          id: { not: id }, // Exclude self
        },
      });

      if (existingPin) {
        return NextResponse.json(
          { error: 'Este PIN ya está en uso por otro empleado' },
          { status: 409 }
        );
      }
    }

    // Update employee in transaction with audit trail
    const updated = await prisma.$transaction(async (tx: any) => {
      const updatedEmployee = await tx.employees.update({
        where: { id, tenant_id: tenantId },
        data: {
          ...(name && { name }),
          ...(role && { role }),
          ...(typeof is_active === 'boolean' && { is_active }),
          ...(pin_hash && { pin_hash }),
          ...(dni !== undefined && { dni: dni || null }),
        },
      });

      // Log audit trail (never log the PIN itself)
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'employees',
          metadata: {
            record_id: id,
            changes: { name, role, is_active, pin_changed: !!pin },
          },
          created_at: new Date(),
        },
      });

      return updatedEmployee;
    });

    // Invalidate employees cache
    await cache.deleteByTag('employees');

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error al actualizar empleado', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al actualizar empleado' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }
    
    // Check employee exists and belongs to tenant
    const existing = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // Soft delete in transaction with audit trail
    await prisma.$transaction(async (tx) => {
      await tx.employees.update({
        where: { id, tenant_id: tenantId },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'employees',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });

    // Invalidate employees cache
    await cache.deleteByTag('employees');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Error al eliminar empleado', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}
