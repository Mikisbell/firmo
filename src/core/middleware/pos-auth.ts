/**
 * POS Authentication Middleware
 *
 * Validates JWT token but accepts ANY role (CASHIER, WAITER, ADMIN, etc.)
 * Used for POS terminal endpoints that don't require admin elevation.
 *
 * @module core/middleware/pos-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, type AuthenticatedRequest } from './admin-auth';

const POS_ROLES = ['ADMIN', 'MANAGER', 'OWNER', 'SUPERVISOR', 'CASHIER', 'WAITER', 'KITCHEN', 'BAR', 'DELIVERY', 'DRIVER'];

/**
 * Middleware helper to protect POS endpoints.
 * Validates token but accepts any POS-relevant role.
 */
export async function requirePosAuth(
  request: NextRequest
): Promise<
  | { authorized: true; user: NonNullable<AuthenticatedRequest['user']> & { terminalId?: string } }
  | { authorized: false; response: NextResponse }
> {
  const authResult = await validateAdminAuth(request);

  if (!authResult.valid) {
    return { authorized: false, response: authResult.response };
  }

  if (!POS_ROLES.includes(authResult.user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Rol no autorizado para POS' },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true,
    user: {
      ...authResult.user,
      terminalId: request.headers.get('x-terminal-id') || undefined,
    },
  };
}
