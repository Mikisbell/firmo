/**
 * Session API
 * GET - Check if session is valid
 * DELETE - Logout (revoke session and clear cookie)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateToken, validateSession, revokeSession, logAdminAccess } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

// Handle CORS preflight request
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

/**
 * GET /api/auth/session
 * Check if current session is valid
 * Returns employee data if valid, 401 if not
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get token from cookie first, fallback to Authorization header
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Validate token
    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { valid: false, error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    // Validate session is still active
    const sessionResult = await validateSession(prisma, tokenResult.payload.sid);
    if (!sessionResult.valid) {
      return NextResponse.json(
        { valid: false, error: sessionResult.error },
        { status: 401 }
      );
    }

    // Session is valid, return employee data
    return NextResponse.json({
      valid: true,
      employee: {
        id: tokenResult.payload.sub,
        name: tokenResult.payload.name,
        role: tokenResult.payload.role,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { valid: false, error: 'Error al verificar sesión' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Logout - revoke session and clear cookie
 */
export async function DELETE(request: NextRequest) {
  try {
    // Try to get token from cookie first, fallback to Authorization header
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    const token = cookieToken || headerToken;

    if (token) {
      // Validate token to get session ID
      const tokenResult = await validateToken(token);
      if (tokenResult.valid && tokenResult.payload) {
        // Revoke session in database
        await revokeSession(prisma, tokenResult.payload.sid);

        // Log logout
        await logAdminAccess(
          prisma,
          tokenResult.payload.tid,
          tokenResult.payload.sub,
          'LOGOUT',
          {
            ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                request.headers.get('x-real-ip') || 
                'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          }
        );
      }
    }

    // Clear cookie and return success
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada exitosamente',
    });

    // Delete the auth cookie
    response.cookies.delete('auth_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear the cookie
    const response = NextResponse.json(
      { success: true, message: 'Sesión cerrada' },
      { status: 200 }
    );
    
    response.cookies.delete('auth_token');
    return response;
  }
}
