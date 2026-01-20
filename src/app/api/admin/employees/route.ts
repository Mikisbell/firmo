/**
 * Employees API - GET (list) and POST (create)
 * Requirements: 1.1, 1.2, 1.5, 1.6, 10.1
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { checkRateLimit, RATE_LIMIT_CONFIGS } from '@/src/lib/rate-limit-response';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = 'PARK_POS_2026_'; // Must match seed.ts

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

// OPTIONS - Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

// GET - List all employees
export async function GET() {
  try {
    const employees = await prisma.employees.findMany({
      where: { tenant_id: TENANT_ID },
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
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST - Create new employee
export async function POST(request: NextRequest) {
  // ✅ PASO 1: Rate limiting (10 requests por minuto)
  const rateLimitResponse = await checkRateLimit(request, RATE_LIMIT_CONFIGS.MUTATION);
  if (rateLimitResponse) {
    return rateLimitResponse; // Retorna 429 si excede el límite
  }

  // ✅ PASO 2: Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { name, role, pin, is_active = true } = body;

    // Validate required fields
    if (!name || !role || !pin) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, role, pin' },
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

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN debe ser de 4-6 dígitos' },
        { status: 400 }
      );
    }

    // Hash PIN
    const pin_hash = hashPin(pin);

    // Check PIN uniqueness
    const existingPin = await prisma.employees.findFirst({
      where: {
        tenant_id: TENANT_ID,
        pin_hash,
        is_active: true,
      },
    });

    if (existingPin) {
      return NextResponse.json(
        { error: 'Este PIN ya está en uso' },
        { status: 409 }
      );
    }

    // Create employee in transaction with audit trail
    const employee = await prisma.$transaction(async (tx) => {
      const newEmployee = await tx.employees.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          name,
          role,
          pin_hash,
          is_active,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'employees',
          metadata: { record_id: newEmployee.id },
          created_at: new Date(),
        },
      });

      return newEmployee;
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Employees POST error:', error);
    return NextResponse.json(
      { error: 'Error al crear empleado' },
      { status: 500 }
    );
  }
}
