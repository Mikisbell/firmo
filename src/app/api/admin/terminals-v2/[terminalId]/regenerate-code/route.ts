/**
 * Terminal Activation Code Regeneration API - POST
 * 
 * Generates a new activation code for a terminal.
 * Invalidates any existing unused codes.
 * 
 * Requirements: 2.1, 2.6 (Terminal Architecture v2)
 */

import { NextResponse } from 'next/server';
import { generateActivationCode, formatActivationCode } from '@/src/core/auth/terminal-registry';
import { getAdminEmployeeId } from '@/src/core/config/employees';
import { logger } from '@/src/core/observability/structured-logger';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const { terminalId } = await params;
    // Use ADMIN employee ID as created_by (TODO: Get from session)
    const ADMIN_ID = getAdminEmployeeId();
    const createdBy = ADMIN_ID;

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
