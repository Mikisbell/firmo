// src/app/api/auth/register-terminal/route.ts
// API to register a new terminal with activation code

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const RegisterSchema = z.object({
  activation_code: z.string().min(8),
  device_fingerprint: z.string().min(16),
  device_name: z.string().min(1).max(50),
  role: z.enum(['CASHIER', 'WAITER', 'KDS', 'ADMIN', 'BAR']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = RegisterSchema.parse(body);

    // For now, activation codes are simple format: TENANT_ID-LOCATION_ID-RANDOM
    // In production, store these in a separate table with expiration
    const [tenantId, locationId] = data.activation_code.split('-');
    
    if (!tenantId || !locationId) {
      return NextResponse.json(
        { error: 'Código de activación inválido' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Código de activación inválido' },
        { status: 400 }
      );
    }

    // Check if device already registered
    const existing = await prisma.terminals.findFirst({
      where: {
        tenant_id: tenantId,
        device_secret_hash: data.device_fingerprint,
      },
    });

    if (existing) {
      // Return existing terminal config
      return NextResponse.json({
        terminal_id: existing.terminal_id,
        tenant_id: existing.tenant_id,
        device_name: data.device_name,
        role: data.role,
        location_id: locationId,
        is_allowed: existing.is_allowed,
        registered_at: existing.last_seen_at?.toISOString() || new Date().toISOString(),
        message: 'Terminal ya registrado',
      });
    }

    // Generate terminal ID
    const terminalCount = await prisma.terminals.count({
      where: { tenant_id: tenantId },
    });
    const terminalId = `${data.role}-${String(terminalCount + 1).padStart(2, '0')}`;

    // Create terminal
    const terminal = await prisma.terminals.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        terminal_id: terminalId,
        device_secret_hash: data.device_fingerprint,
        is_allowed: true,
        last_seen_at: new Date(),
      },
    });

    return NextResponse.json({
      terminal_id: terminal.terminal_id,
      tenant_id: terminal.tenant_id,
      device_fingerprint: data.device_fingerprint,
      device_name: data.device_name,
      role: data.role,
      location_id: locationId,
      is_allowed: terminal.is_allowed,
      registered_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Terminal registration error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error al registrar terminal' },
      { status: 500 }
    );
  }
}
