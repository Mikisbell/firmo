// src/app/api/auth/login/route.ts
// API to authenticate employee with PIN

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { hashPin } from '@/src/core/auth/pin';

const LoginSchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string(),
  pin: z.string().length(4),
  device_fingerprint: z.string().min(16),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = LoginSchema.parse(body);

    // 1. Verify terminal is registered and allowed
    const terminal = await prisma.terminal.findUnique({
      where: {
        tenant_id_terminal_id: {
          tenant_id: data.tenant_id,
          terminal_id: data.terminal_id,
        },
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal no registrado' },
        { status: 401 }
      );
    }

    if (!terminal.is_allowed) {
      return NextResponse.json(
        { error: 'Terminal desactivado. Contacte al administrador.' },
        { status: 403 }
      );
    }

    // 2. Verify device fingerprint matches (if terminal has one stored)
    // Skip verification for legacy terminals without fingerprint
    if (terminal.device_secret_hash && terminal.device_secret_hash !== data.device_fingerprint) {
      return NextResponse.json(
        { error: 'Dispositivo no reconocido' },
        { status: 403 }
      );
    }

    // 3. Find employee by PIN
    const pinHash = await hashPin(data.pin);
    const employee = await prisma.employee.findFirst({
      where: {
        tenant_id: data.tenant_id,
        pin_hash: pinHash,
        is_active: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'PIN incorrecto' },
        { status: 401 }
      );
    }

    // 4. Update terminal last seen
    await prisma.terminal.update({
      where: { id: terminal.id },
      data: { last_seen_at: new Date() },
    });

    // 5. Get active shift (if any)
    const activeShift = await prisma.shift.findFirst({
      where: {
        tenant_id: data.tenant_id,
        terminal_id: data.terminal_id,
        status: 'OPEN',
      },
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      },
      shift: activeShift ? {
        id: activeShift.id,
        opened_at: activeShift.opened_at.toISOString(),
        opened_by: activeShift.opened_by,
      } : null,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error de autenticación' },
      { status: 500 }
    );
  }
}
