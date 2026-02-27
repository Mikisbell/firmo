// src/app/api/auth/validate-session/route.ts
// Validate if a session is still active

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/src/core/security/session-validator';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_token } = body;

    if (!session_token) {
      return NextResponse.json(
        { error: 'session_token is required' },
        { status: 400 }
      );
    }

    console.log('[Validate Session API] Validating session:', session_token.substring(0, 8) + '...');

    // Validate the session
    const result = await validateSession(session_token);

    if (!result.valid) {
      console.log('[Validate Session API] Session is invalid');
      return NextResponse.json(
        {
          valid: false,
          message: 'Session is invalid or expired',
        },
        { status: 401 }
      );
    }

    console.log('[Validate Session API] Session is valid');

    return NextResponse.json({
      valid: true,
      session: {
        id: result.session?.id,
        employee_id: result.session?.employee_id,
        terminal_id: result.session?.terminal_id,
        device_id: result.session?.device_id,
        mac_address: result.session?.mac_address,
        started_at: result.session?.started_at,
        last_activity_at: result.session?.last_activity_at,
        is_active: result.session?.is_active,
        is_suspicious: result.session?.is_suspicious,
      },
    });
  } catch (error) {
    console.error('Validate session error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error validating session' },
      { status: 500 }
    );
  }
}
