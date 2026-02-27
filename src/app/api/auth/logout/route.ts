// src/app/api/auth/logout/route.ts
// Logout endpoint - closes active session

import { NextRequest, NextResponse } from 'next/server';
import { closeSession } from '@/src/core/security/session-validator';
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

    console.log('[Logout API] Closing session:', session_token.substring(0, 8) + '...');

    // Close the session
    await closeSession(session_token, 'User logout');

    console.log('[Logout API] Session closed successfully');

    // Clear cookies
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    response.cookies.delete('auth_token');
    response.cookies.delete('session_id');

    return response;
  } catch (error) {
    console.error('Logout error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error during logout' },
      { status: 500 }
    );
  }
}
