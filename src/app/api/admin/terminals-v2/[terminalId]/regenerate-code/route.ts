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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const { terminalId } = await params;
    // Use ADMIN employee ID as created_by (TODO: Get from session)
    const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
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
    console.error('Regenerate code error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate activation code' },
      { status: 500 }
    );
  }
}
