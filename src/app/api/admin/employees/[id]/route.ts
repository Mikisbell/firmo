/**
 * Employees API - GET, PUT, DELETE for single employee
 * Requirements: 1.3, 1.4, 10.2, 10.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createHash, randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { cache } from '@/src/core/cache/redis.service';
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';

const SALT = 'PARK_POS_2026_'; // Must match seed.ts and route.ts

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

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
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Employee GET error:', error instanceof Error ? error.message : String(error));
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
    const { name, role, is_active, pin, dni } = body;

    // Validate DNI format if provided
    if (dni !== undefined && dni !== null && dni !== '') {
      if (typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
        return NextResponse.json(
          { error: 'DNI debe tener exactamente 8 dígitos numéricos' },
          { status: 400 }
        );
      }
    }

    // Validate PIN format if provided
    if (pin !== undefined) {
      if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) {
        return NextResponse.json(
          { error: 'PIN debe ser de 4-6 dígitos numéricos' },
          { status: 400 }
        );
      }
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

    // Validate role if provided
    if (role) {
      const validRoles = [...EMPLOYEE_ROLES];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // If PIN is being changed, check uniqueness within tenant
    let pin_hash: string | undefined;
    if (pin) {
      pin_hash = hashPin(pin);
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
        where: { id },
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

    // Invalidar caché Redis de la lista de empleados para este tenant
    await cache.invalidatePattern(`employees:${tenantId}:*`);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Employee PUT error:', error instanceof Error ? error.message : String(error));
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
        where: { id },
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

    // Invalidar caché Redis de la lista de empleados para este tenant
    await cache.invalidatePattern(`employees:${tenantId}:*`);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Employee DELETE error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}
