/**
 * Admin Authentication Middleware
 * 
 * Validates that requests to admin endpoints come from authenticated users
 * with ADMIN or MANAGER roles.
 * 
 * Requirements: 7.1, 7.2, 7.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/src/core/auth/auth.service';
import { ADMIN_ROLES } from '@/src/core/constants/roles';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('admin-auth');

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    role: string;
    name: string;
    tenantId: string;
    sessionId: string;
  };
}

/**
 * Validates that the request has a valid JWT token and the user has admin permissions
 * Returns the user info if valid, or an error response if not
 */
export async function validateAdminAuth(request: NextRequest): Promise<
  | { valid: true; user: NonNullable<AuthenticatedRequest['user']> }
  | { valid: false; response: NextResponse }
> {
  // Try to get token from cookie first, fallback to Authorization header
  const cookieToken = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  const token = cookieToken || headerToken;

  if (!token) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'No autenticado. Por favor inicie sesión.' },
        { status: 401 }
      ),
    };
  }

  try {
    const tokenResult = await validateToken(token);

    if (!tokenResult.valid || !tokenResult.payload) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Token inválido o expirado' },
          { status: 401 }
        ),
      };
    }

    const user = {
      id: tokenResult.payload.sub,
      role: tokenResult.payload.role,
      name: tokenResult.payload.name || '',
      tenantId: tokenResult.payload.tid,
      sessionId: tokenResult.payload.sid,
    };

    return { valid: true, user };
  } catch (error) {
    log.error('Error al validar autenticación admin', error instanceof Error ? error : new Error(String(error)));
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'No autenticado. Por favor inicie sesión.' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Validates that the authenticated user has admin permissions
 * Uses ADMIN_ROLES: OWNER, ADMIN, MANAGER, SUPERVISOR
 */
export function validateAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Middleware helper to protect admin endpoints
 * Use this at the beginning of POST, PUT, DELETE handlers
 */
export async function requireAdminAuth(
  request: NextRequest
): Promise<
  | { authorized: true; user: NonNullable<AuthenticatedRequest['user']> }
  | { authorized: false; response: NextResponse }
> {
  const authResult = await validateAdminAuth(request);

  if (!authResult.valid) {
    return { authorized: false, response: authResult.response };
  }

  if (!validateAdminRole(authResult.user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { 
          error: 'Acceso denegado. Se requiere rol de ADMIN o MANAGER.',
          requiredRoles: ['ADMIN', 'MANAGER', 'OWNER'],
          userRole: authResult.user.role,
        },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, user: authResult.user };
}

/**
 * Alias for requireAdminAuth for backward compatibility
 */
export const verifyAdminAuth = requireAdminAuth;
