/**
 * Terminal Device Validation API
 * 
 * Validates if a device_id is already bound to a terminal
 * 
 * POST /api/terminals/validate-device
 * 
 * Body:
 * {
 *   device_id: string (UUID from localStorage),
 *   terminal_id?: string (optional, to check specific terminal)
 * }
 * 
 * Response:
 * {
 *   valid: boolean,
 *   terminal?: { terminal_id, role, status, device_name },
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { logger } from '@/src/core/observability/structured-logger';

const validateDeviceSchema = z.object({
  device_id: z.string().min(1, 'device_id es requerido'),
  terminal_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = validateDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { device_id, terminal_id } = parsed.data;

    const tenantId = getTenantId();

    // Find terminal by device_id
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        device_id,
        tenant_id: tenantId,
        status: 'active',
      },
    });

    if (!terminal) {
      return NextResponse.json({
        valid: false,
        error: 'Dispositivo no vinculado a ningún terminal',
      });
    }

    // If terminal_id is specified, verify it matches
    if (terminal_id && terminal.terminal_id !== terminal_id) {
      return NextResponse.json({
        valid: false,
        error: 'Dispositivo vinculado a otro terminal',
      });
    }

    return NextResponse.json({
      valid: true,
      terminal: {
        terminal_id: terminal.terminal_id,
        role: terminal.role,
        status: terminal.status,
        device_name: terminal.device_name,
      },
    });

  } catch (error) {
    logger.error('Error al validar dispositivo', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al validar dispositivo' },
      { status: 500 }
    );
  }
}
