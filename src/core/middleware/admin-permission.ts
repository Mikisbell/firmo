/**
 * Admin Permission Middleware
 *
 * Composes requireAdminAuth() + hasPermission() for granular
 * permission checks on admin API routes.
 *
 * Usage:
 *   const auth = await requireAdminPermission(request, 'manage_employees');
 *   if (!auth.authorized) return auth.response;
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAdminAuth, type AuthenticatedRequest } from './admin-auth';
import { validateAdminRole } from './admin-auth';
import { hasPermission, type AdminPermissions } from '@/src/app/admin/lib/permissions';

export async function requireAdminPermission(
  request: NextRequest,
  permission: keyof AdminPermissions
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
        { error: 'Acceso denegado. Se requiere rol administrativo.' },
        { status: 403 },
      ),
    };
  }

  if (!hasPermission(authResult.user.role, permission)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Permiso insuficiente: ${permission}`,
          required: permission,
          userRole: authResult.user.role,
        },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, user: authResult.user };
}
