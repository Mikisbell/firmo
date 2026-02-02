/**
 * Session API
 * GET - Check if session is valid
 * POST - Validate PIN and create session (for inventory/admin operations)
 * DELETE - Logout (revoke session and clear cookie)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateToken, validateSession, revokeSession, logAdminAccess, authenticate } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { getTenantId } from '@/src/core/config/tenant';

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
 * POST /api/auth/session
 * Validate PIN and create temporary session for inventory/admin operations
 * Used by PinModal for role-based access control
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, allowedRoles } = body;

    console.log('[Session API] POST request received');
    console.log('  PIN:', pin);
    console.log('  PIN type:', typeof pin);
    console.log('  PIN length:', pin?.length);
    console.log('  Allowed roles:', allowedRoles);

    if (!pin || !allowedRoles || !Array.isArray(allowedRoles)) {
      console.log('[Session API] Validation failed - missing PIN or roles');
      return NextResponse.json(
        { error: 'PIN y roles requeridos' },
        { status: 400 }
      );
    }

    // Get tenant ID from centralized config
    const tenantId = getTenantId();
    console.log('[Session API] Tenant ID:', tenantId);

    // Get IP and user agent
    const metadata = {
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
          request.headers.get('x-real-ip') || 
          'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      terminalId: 'admin-panel',
    };

    console.log('[Session API] Metadata:', metadata);

    // Authenticate with PIN
    console.log('[Session API] Calling authenticate()...');
    const authResult = await authenticate(prisma, tenantId, pin, allowedRoles, metadata);
    console.log('[Session API] Auth result:', { success: authResult.success, error: authResult.error });

    if (!authResult.success) {
      return NextResponse.json(
        { 
          error: authResult.error || 'PIN inválido',
          errorCode: authResult.errorCode,
          lockoutUntil: authResult.lockoutUntil,
        },
        { status: 401 }
      );
    }

    // Set httpOnly cookie with token
    const response = NextResponse.json({
      success: true,
      employee: authResult.employee,
    });

    console.log('[Session API] Setting cookie:');
    console.log('  Token exists:', !!authResult.token);
    console.log('  Token length:', authResult.token?.length);

    // Set secure httpOnly cookie
    if (authResult.token) {
      response.cookies.set('auth_token', authResult.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/',
      });
      console.log('[Session API] Cookie set successfully');
    } else {
      console.log('[Session API] ⚠️  Token is undefined!');
    }

    return response;
  } catch (error) {
    console.error('PIN validation error:', error);
    return NextResponse.json(
      { error: 'Error al validar PIN' },
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
