// src/app/api/auth/logout/route.ts
// Logout endpoint - closes active session

import { NextRequest, NextResponse } from 'next/server';
import { closeSession } from '@/src/core/security/session-validator';
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

    logger.info('Cerrando sesión', { sessionToken: session_token.substring(0, 8) + '...' });

    // Close the session
    await closeSession(session_token, 'User logout');

    logger.info('Sesión cerrada exitosamente');

    // Clear cookies
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });

    response.cookies.delete('auth_token');
    response.cookies.delete('session_id');

    return response;
  } catch (error) {
    logger.error('Error al cerrar sesión', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al cerrar sesión' },
      { status: 500 }
    );
  }
}
