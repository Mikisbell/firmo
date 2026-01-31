/**
 * Employees API - GET, PUT, DELETE for single employee
 * Requirements: 1.3, 1.4, 10.2, 10.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

// GET - Get single employee
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employee = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
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
    console.error('Employee GET error:', error);
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

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, is_active } = body;

    // Check employee exists
    const existing = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER', 'BAR'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` },
          { status: 400 }
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
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'employees',
          metadata: { 
            record_id: id,
            changes: { name, role, is_active },
          },
          created_at: new Date(),
        },
      });

      return updatedEmployee;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Employee PUT error:', error);
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

  try {
    const { id } = await params;
    // Check employee exists
    const existing = await prisma.employees.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
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
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'employees',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Employee DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar empleado' },
      { status: 500 }
    );
  }
}
