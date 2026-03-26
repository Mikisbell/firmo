/**
 * Terminal Activation Code Regeneration API - POST
 * 
 * Generates a new activation code for a terminal.
 * Invalidates any existing unused codes.
 * 
 * Requirements: 2.1, 2.6 (Terminal Architecture v2)
 */

import { NextResponse, NextRequest } from 'next/server';
import { generateActivationCode, formatActivationCode } from '@/src/core/auth/terminal-registry';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { logger } from '@/src/core/observability/structured-logger';
import prisma from '@/src/core/db/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { terminalId } = await params;
    const tenantId = authResult.user.tenantId;
    const createdBy = authResult.user.id;

    // Verify terminal belongs to the authenticated tenant before regenerating
    const terminal = await prisma.terminal_devices.findFirst({
      where: { terminal_id: terminalId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal no encontrado' }, { status: 404 });
    }

    // Generate new activation code
    const code = await generateActivationCode(terminalId, createdBy);

    return NextResponse.json({
      success: true,
      code: {
        code: code.code,
        formatted: formatActivationCode(code.code),
        expires_at: code.expires_at.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error al regenerar codigo de activacion', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al regenerar código de activación' },
      { status: 500 }
    );
  }
}
