/**
 * Tenant Context Middleware
 * 
 * Extracts tenant_id from JWT token and injects it into request context.
 * Sets PostgreSQL session variables for RLS enforcement.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('tenant-context');

export interface TenantContext {
  tenant_id: string;
  employee_id?: string;
  role?: string;
  is_cross_tenant_admin?: boolean;
}

/**
 * Extract tenant context from JWT token
 */
export async function extractTenantContext(
  request: NextRequest
): Promise<TenantContext | null> {
  // Try to get token from cookie first, fallback to Authorization header
  const cookieToken = request.cookies.get('auth_token')?.value;
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  const token = cookieToken || headerToken;

  if (!token) {
    return null;
  }

  try {
    const tokenResult = await validateToken(token);

    if (!tokenResult.valid || !tokenResult.payload) {
      return null;
    }

    const context: TenantContext = {
      tenant_id: tokenResult.payload.tid,
      employee_id: tokenResult.payload.sub,
      role: tokenResult.payload.role,
      is_cross_tenant_admin: (tokenResult.payload as any).is_cross_tenant_admin || false,
    };

    return context;
  } catch (error) {
    log.error('Error al extraer contexto de tenant', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Validate tenant context
 */
export async function validateTenantContext(context: TenantContext): Promise<boolean> {
  if (!context.tenant_id) {
    return false;
  }

  // Verify tenant exists
  const tenant = await prisma.tenant_settings.findUnique({
    where: { tenant_id: context.tenant_id },
  });

  return !!tenant;
}

/**
 * Set PostgreSQL session variables for RLS
 */
export async function setRLSSessionVariables(context: TenantContext): Promise<void> {
  try {
    // Set current tenant ID for RLS policies
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${context.tenant_id}, true)
    `;

    // Set cross-tenant admin flag if applicable
    if (context.is_cross_tenant_admin) {
      await prisma.$executeRaw`
        SELECT set_config('app.is_cross_tenant_admin', 'true', true)
      `;
    }
  } catch (error) {
    log.error('Error al configurar variables de sesión RLS', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Middleware to enforce tenant context
 * Use this wrapper in API routes to automatically extract and validate tenant context
 */
export async function withTenantContext<T>(
  request: NextRequest,
  handler: (context: TenantContext) => Promise<T>
): Promise<T | NextResponse> {
  try {
    // Extract tenant context from token
    const context = await extractTenantContext(request);

    if (!context) {
      return NextResponse.json(
        { error: 'Missing or invalid tenant context' },
        { status: 401 }
      );
    }

    // Validate tenant context
    const isValid = await validateTenantContext(context);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Tenant not found or invalid' },
        { status: 401 }
      );
    }

    // Set RLS session variables
    await setRLSSessionVariables(context);

    // Log tenant access
    log.info('Acceso de tenant', { tenantId: context.tenant_id, employeeId: context.employee_id });

    // Execute handler with context
    return await handler(context);
  } catch (error) {
    log.error('Error en middleware de contexto de tenant', error instanceof Error ? error : new Error(String(error)));

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Alternative middleware pattern for use in route handlers
 * Returns context or error response
 */
export async function getTenantContext(
  request: NextRequest
): Promise<
  | { valid: true; context: TenantContext }
  | { valid: false; response: NextResponse }
> {
  try {
    const context = await extractTenantContext(request);

    if (!context) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Missing or invalid tenant context' },
          { status: 401 }
        ),
      };
    }

    const isValid = await validateTenantContext(context);

    if (!isValid) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Tenant not found or invalid' },
          { status: 401 }
        ),
      };
    }

    await setRLSSessionVariables(context);

    return { valid: true, context };
  } catch (error) {
    log.error('Error al obtener contexto de tenant', error instanceof Error ? error : new Error(String(error)));

    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}
