import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
  grantCrossTenantAdmin,
  revokeCrossTenantAdmin,
  CrossTenantPermissions,
} from '@/src/core/tenant/cross-tenant-admin';

/**
 * GET /api/admin/cross-tenant/access-control
 * List all cross-tenant admins (cross-tenant admin only)
 * Requirements: 9.1, 9.2
 */
export async function GET(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employeeId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for list operation
      'can_modify_quotas', // Requires higher permission to manage admins
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get all cross-tenant admins
    const admins = await prisma.cross_tenant_admins.findMany({
      orderBy: { granted_at: 'desc' },
    });

    // Log action
    await logCrossTenantAdminAction(
      context,
      'LIST_ADMINS',
      'cross_tenant_admins',
      undefined,
      { count: admins.length }
    );

    return NextResponse.json(admins);
  } catch (error: any) {
    logger.error('Error al listar administradores cross-tenant', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cross-tenant/access-control
 * Grant cross-tenant admin access to an employee
 * Requirements: 9.1, 9.2
 */
export async function POST(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employeeId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for grant operation
      'can_modify_quotas', // Requires higher permission to manage admins
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Parse request body
    const body = await request.json();
    const { employee_id, permissions, expires_in_days } = body;

    if (!employee_id || !permissions) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: employee_id, permissions' },
        { status: 400 }
      );
    }

    // Verify employee exists
    const employee = await prisma.employees.findUnique({
      where: { id: employee_id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Grant admin access
    await grantCrossTenantAdmin(
      employee_id,
      session.employeeId,
      permissions as CrossTenantPermissions,
      expires_in_days
    );

    // Log action
    await logCrossTenantAdminAction(
      context,
      'GRANT_ADMIN',
      'cross_tenant_admins',
      employee_id,
      { permissions, expires_in_days }
    );

    return NextResponse.json({
      success: true,
      message: 'Acceso de administrador cross-tenant otorgado',
      employee_id,
    });
  } catch (error: any) {
    logger.error('Error al otorgar acceso de administrador cross-tenant', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cross-tenant/access-control
 * Revoke cross-tenant admin access from an employee
 * Query params:
 *   - employee_id: Employee to revoke access from
 * Requirements: 9.1, 9.2
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employeeId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for revoke operation
      'can_modify_quotas', // Requires higher permission to manage admins
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const employee_id = searchParams.get('employee_id');

    if (!employee_id) {
      return NextResponse.json(
        { error: 'Falta parámetro requerido: employee_id' },
        { status: 400 }
      );
    }

    // Verify employee exists
    const employee = await prisma.employees.findUnique({
      where: { id: employee_id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Revoke admin access
    await revokeCrossTenantAdmin(employee_id);

    // Log action
    await logCrossTenantAdminAction(
      context,
      'REVOKE_ADMIN',
      'cross_tenant_admins',
      employee_id,
      {}
    );

    return NextResponse.json({
      success: true,
      message: 'Acceso de administrador cross-tenant revocado',
      employee_id,
    });
  } catch (error: any) {
    logger.error('Error al revocar acceso de administrador cross-tenant', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
