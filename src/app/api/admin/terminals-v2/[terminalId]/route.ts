/**
 * Terminal Device Details API - GET
 * 
 * Returns detailed information about a specific terminal including:
 * - Terminal device data
 * - Current activation code (if pending)
 * - Activation code history
 * 
 * Requirements: 2.1, 3.1, 3.3 (Terminal Architecture v2)
 */

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const { terminalId } = await params;
    const tenantId = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    // Get terminal device
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: terminalId,
        tenant_id: tenantId,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal no encontrado' },
        { status: 404 }
      );
    }

    // Get all activation codes for this terminal (history)
    const activationCodes = await prisma.activation_codes.findMany({
      where: { terminal_id: terminalId },
      orderBy: { created_at: 'desc' },
    });

    // Get current active code (not used, not expired)
    const currentCode = activationCodes.find(
      (code) => !code.used && new Date(code.expires_at) > new Date()
    );

    return NextResponse.json({
      terminal,
      activation_codes: activationCodes,
      current_code: currentCode || null,
    });
  } catch (error) {
    console.error('Terminal details GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminal details' },
      { status: 500 }
    );
  }
}
