import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';

/**
 * GET /api/admin/cross-tenant/audit-log
 * Get cross-tenant admin audit logs (cross-tenant admin only)
 * Query params:
 *   - tenant_id: Filter by tenant (optional)
 *   - admin_id: Filter by admin (optional)
 *   - limit: Number of records to return (default: 100)
 * Requirements: 9.3, 9.7
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

    // Verify cross-tenant admin access (no specific tenant for audit log)
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for audit log
      'can_view_configuration',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const adminId = searchParams.get('admin_id');
    const limitStr = searchParams.get('limit') || '100';
    const limit = Math.min(parseInt(limitStr), 1000); // Max 1000

    // Build where clause
    const where: any = {};
    if (tenantId) where.tenant_id = tenantId;
    if (adminId) where.admin_id = adminId;

    // Get audit logs
    const auditLogs = await prisma.cross_tenant_audit_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // Log action
    await logCrossTenantAdminAction(
      context,
      'VIEW_AUDIT_LOG',
      'cross_tenant_audit_log',
      undefined,
      { count: auditLogs.length, filters: { tenantId, adminId } }
    );

    return NextResponse.json(auditLogs);
  } catch (error: any) {
    logger.error('Error al obtener logs de auditoría', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
