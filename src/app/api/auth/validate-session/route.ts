// src/app/api/auth/validate-session/route.ts
// Validate if a session is still active

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/src/core/security/session-validator';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { logger } from '@/src/core/observability/structured-logger';

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

    logger.info('Validando sesión', { sessionToken: session_token.substring(0, 8) + '...' });

    // Validate the session
    const result = await validateSession(session_token);

    if (!result.valid) {
      logger.info('Sesión inválida');
      return NextResponse.json(
        {
          valid: false,
          message: 'Sesión inválida o expirada',
        },
        { status: 401 }
      );
    }

    logger.info('Sesión válida');

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
    logger.error('Error al validar sesión', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al validar sesión' },
      { status: 500 }
    );
  }
}
