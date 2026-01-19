/**
 * Employee API - GET, PUT, DELETE for single employee
 * Requirements: 1.3, 1.4, 1.6, 10.2, 10.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

// GET - Fetch single employee
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await prisma.employees.findFirst({
      where: {
        id: params.id,
        tenant_id: TENANT_ID,
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
        created_at: true,
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
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

// PUT - Update employee (name, role, is_active only - no PIN changes)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, role, is_active } = body;

    // Validate required fields
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, role' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER', 'BAR'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Check employee exists
    const existing = await prisma.employees.findFirst({
      where: {
        id: params.id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Update employee in transaction with audit trail
    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employees.update({
        where: { id: params.id },
        data: {
          name,
          role,
          is_active: is_active ?? existing.is_active,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: ADMIN_ID,
          action: 'UPDATE',
          resource: 'employees',
          metadata: {
            record_id: params.id,
            changes: { name, role, is_active },
          },
          created_at: new Date(),
        },
      });

      return updated;
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Employee PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete employee
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check employee exists
    const existing = await prisma.employees.findFirst({
      where: {
        id: params.id,
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
        where: { id: params.id },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: ADMIN_ID,
          action: 'DELETE',
          resource: 'employees',
          metadata: { record_id: params.id },
          created_at: new Date(),
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Employee DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
