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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    // Validate admin authentication and authorization
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;

    const { terminalId } = await params;

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
