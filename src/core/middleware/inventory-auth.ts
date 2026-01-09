/**
 * Inventory API Authentication Middleware
 * 
 * Validates JWT tokens and role permissions for inventory APIs.
 * Requirements: 5.8 - JWT validation, ADMIN/MANAGER role check
 * 
 * @module inventory-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken, validateSession, logAdminAccess, type AuthPayload } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';

// Roles allowed to access inventory APIs
const INVENTORY_ALLOWED_ROLES = ['ADMIN', 'MANAGER'];

export interface AuthenticatedRequest {
  auth: AuthPayload;
  tenantId: string;
  actorId: string;
  role: string;
}

export interface AuthMiddlewareResult {
  success: boolean;
  error?: string;
  errorCode?: 'NO_TOKEN' | 'INVALID_TOKEN' | 'SESSION_INVALID' | 'ROLE_NOT_ALLOWED';
  status?: number;
  auth?: AuthPayload;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Validate inventory API request authentication
 * 
 * Checks:
 * 1. Bearer token present
 * 2. JWT valid and not expired
 * 3. Session active
 * 4. Role is ADMIN or MANAGER
 */
export async function validateInventoryAuth(
  request: NextRequest
): Promise<AuthMiddlewareResult> {
  // 1. Extract token
  const token = extractToken(request);
  if (!token) {
    return {
      success: false,
      error: 'Token de autenticación requerido',
      errorCode: 'NO_TOKEN',
      status: 401,
    };
  }

  // 2. Validate JWT
  const tokenResult = await validateToken(token);
  if (!tokenResult.valid || !tokenResult.payload) {
    return {
      success: false,
      error: tokenResult.error || 'Token inválido',
      errorCode: 'INVALID_TOKEN',
      status: 401,
    };
  }

  const payload = tokenResult.payload;

  // 3. Validate session
  const sessionResult = await validateSession(prisma, payload.sid);
  if (!sessionResult.valid) {
    // Log session expiration
    await logAdminAccess(prisma, payload.tid, payload.sub, 'SESSION_EXPIRED', {
      resource: 'inventory',
      details: { reason: sessionResult.error || 'unknown' },
    });

    return {
      success: false,
      error: sessionResult.error || 'Sesión inválida',
      errorCode: 'SESSION_INVALID',
      status: 401,
    };
  }

  // 4. Check role
  const role = payload.role.toUpperCase();
  if (!INVENTORY_ALLOWED_ROLES.includes(role)) {
    // Log access denied
    await logAdminAccess(prisma, payload.tid, payload.sub, 'ACCESS_DENIED', {
      resource: 'inventory',
      details: { 
        reason: 'Role not allowed',
        role: payload.role,
        required: INVENTORY_ALLOWED_ROLES.join(','),
      },
    });

    return {
      success: false,
      error: `Rol ${payload.role} no autorizado para inventario. Se requiere: ${INVENTORY_ALLOWED_ROLES.join(' o ')}`,
      errorCode: 'ROLE_NOT_ALLOWED',
      status: 403,
    };
  }

  return {
    success: true,
    auth: payload,
  };
}

/**
 * Create error response for auth failures
 */
export function createAuthErrorResponse(result: AuthMiddlewareResult): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: result.error,
      errorCode: result.errorCode,
    },
    { status: result.status || 401 }
  );
}

/**
 * Higher-order function to wrap API handlers with auth
 */
export function withInventoryAuth<T>(
  handler: (request: NextRequest, auth: AuthPayload) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest): Promise<NextResponse<T | { success: false; error: string; errorCode: string }>> => {
    const authResult = await validateInventoryAuth(request);
    
    if (!authResult.success || !authResult.auth) {
      return createAuthErrorResponse(authResult) as NextResponse<{ success: false; error: string; errorCode: string }>;
    }

    return handler(request, authResult.auth);
  };
}

// Export allowed roles for testing
export const ALLOWED_ROLES = INVENTORY_ALLOWED_ROLES;
