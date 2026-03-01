import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';

/**
 * GET /api/admin/cross-tenant/tenants/:tenantId/health
 * Get tenant health status (cross-tenant admin only)
 * Requirements: 9.5, 9.6
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

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
      tenantId,
      'can_view_analytics',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Local no encontrado' },
        { status: 404 }
      );
    }

    const checks: any[] = [];

    // Check 1: Active terminals
    const activeTerminals = await prisma.terminals.count({
      where: {
        tenant_id: tenantId,
        is_allowed: true,
      },
    });
    checks.push({
      type: 'active_terminals',
      status: activeTerminals > 0 ? 'pass' : 'warn',
      message: `${activeTerminals} active terminals`,
    });

    // Check 2: Recent orders
    const recentOrders = await prisma.orders.count({
      where: {
        tenant_id: tenantId,
        created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    checks.push({
      type: 'recent_orders',
      status: recentOrders > 0 ? 'pass' : 'warn',
      message: `${recentOrders} orders in last 24h`,
    });

    // Check 3: Sync errors
    const syncErrors = await prisma.sync_conflicts.count({
      where: {
        tenant_id: tenantId,
        severity: 'BLOCKING',
        resolved_at: null,
      },
    });
    checks.push({
      type: 'sync_errors',
      status: syncErrors === 0 ? 'pass' : syncErrors < 5 ? 'warn' : 'fail',
      message: `${syncErrors} unresolved sync conflicts`,
    });

    // Determine overall status
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    const overall_status = hasFail ? 'critical' : hasWarn ? 'warning' : 'healthy';

    // Log action
    await logCrossTenantAdminAction(
      context,
      'VIEW_HEALTH',
      'tenant_health',
      tenantId,
      { overall_status }
    );

    return NextResponse.json({
      tenant_id: tenantId,
      overall_status,
      checks,
      last_checked: new Date(),
    });
  } catch (error: any) {
    logger.error('Error al obtener salud del tenant cross-tenant', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
