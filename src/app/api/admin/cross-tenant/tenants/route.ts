import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';

/**
 * GET /api/admin/cross-tenant/tenants
 * List all tenants with their status (cross-tenant admin only)
 * Requirements: 9.5, 9.6
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

    // Verify cross-tenant admin access (no specific tenant for list operation)
    const context = await withCrossTenantAdmin(
      session.employeeId,
      '', // No specific tenant for list operation
      'can_view_configuration',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get all tenants with their settings
    const tenants = await prisma.tenants.findMany({
      include: {
        tenant_settings: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Enrich with health status and usage data
    const enrichedTenants = await Promise.all(
      tenants.map(async (tenant) => {
        // Get health status
        const checks: any[] = [];

        // Check 1: Active terminals
        const activeTerminals = await prisma.terminals.count({
          where: {
            tenant_id: tenant.id,
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
            tenant_id: tenant.id,
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
            tenant_id: tenant.id,
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

        return {
          ...tenant,
          health_status: overall_status,
          checks,
          active_terminals: activeTerminals,
          recent_orders: recentOrders,
          sync_errors: syncErrors,
        };
      })
    );

    // Log action
    await logCrossTenantAdminAction(
      context,
      'LIST_TENANTS',
      'tenants',
      undefined,
      { count: enrichedTenants.length }
    );

    return NextResponse.json(enrichedTenants);
  } catch (error: any) {
    logger.error('Error al listar tenants cross-tenant', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
