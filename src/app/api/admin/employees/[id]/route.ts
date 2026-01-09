/**
 * Employees API - GET, PUT, DELETE by ID
 * 
 * Requirements: 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { createHash } from 'crypto';

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER']).optional(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    const employee = await prisma.employees.findFirst({
      where: { id, tenant_id: tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error('Employee GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid employee data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const existing = await prisma.employees.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    const data = parsed.data;
    
    // Check PIN uniqueness if changing
    if (data.pin) {
      const pinHash = hashPin(data.pin);
      const duplicatePin = await prisma.employees.findFirst({
        where: {
          tenant_id: tenantId,
          pin_hash: pinHash,
          is_active: true,
          id: { not: id },
        },
      });
      
      if (duplicatePin) {
        return NextResponse.json(
          { error: 'PIN already in use by another employee' },
          { status: 409 }
        );
      }
    }
    
    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.is_active !== undefined) updateData.is_active = data.is_active;
    if (data.pin) updateData.pin_hash = hashPin(data.pin);
    
    const employee = await prisma.employees.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
    
    return NextResponse.json(employee);
  } catch (error) {
    console.error('Employee PUT error:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    const existing = await prisma.employees.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    // Prevent deleting last OWNER/ADMIN
    if (existing.role === 'OWNER' || existing.role === 'ADMIN') {
      const adminCount = await prisma.employees.count({
        where: {
          tenant_id: tenantId,
          role: { in: ['OWNER', 'ADMIN'] },
          is_active: true,
        },
      });
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last OWNER/ADMIN' },
          { status: 400 }
        );
      }
    }
    
    // Soft delete
    await prisma.employees.update({
      where: { id },
      data: { is_active: false },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Employee DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
