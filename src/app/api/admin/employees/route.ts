/**
 * Employees API - GET and POST
 * 
 * Requirements: 4.2, 4.3, 4.4
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { createHash, randomUUID } from 'crypto';

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

// Hash PIN for storage
function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

// Validation schema
const employeeSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER']),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    const employees = await prisma.employees.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error('Employees GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    // Validate input
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid employee data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    const pinHash = hashPin(data.pin);
    
    // Check for duplicate PIN within tenant
    const existingPin = await prisma.employees.findFirst({
      where: {
        tenant_id: tenantId,
        pin_hash: pinHash,
        is_active: true,
      },
    });
    
    if (existingPin) {
      return NextResponse.json(
        { error: 'PIN already in use by another employee' },
        { status: 409 }
      );
    }
    
    // Create employee
    const employee = await prisma.employees.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        name: data.name,
        role: data.role,
        pin_hash: pinHash,
        is_active: data.is_active,
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });
    
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Employees POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
