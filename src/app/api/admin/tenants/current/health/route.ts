import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/current/health
 * Get current tenant health status
 * Requirements: 7.5, 7.6
 */
export async function GET(request: NextRequest) {
  try {
    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenantId;
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

    // Check 4: Storage usage
    const usage = await prisma.tenant_usage.findUnique({
      where: { tenant_id: tenantId },
    });
    const quota = await prisma.tenant_quotas.findUnique({
      where: { tenant_id: tenantId },
    });
    const storagePercent = usage && quota ? (usage.storage_mb / quota.max_storage_mb) * 100 : 0;
    checks.push({
      type: 'storage_usage',
      status: storagePercent < 80 ? 'pass' : storagePercent < 95 ? 'warn' : 'fail',
      message: `${storagePercent.toFixed(1)}% storage used`,
    });

    // Determine overall status
    const hasFail = checks.some(c => c.status === 'fail');
    const hasWarn = checks.some(c => c.status === 'warn');
    const overall_status = hasFail ? 'critical' : hasWarn ? 'warning' : 'healthy';

    return NextResponse.json({
      tenant_id: tenantId,
      overall_status,
      checks,
      last_checked: new Date(),
    });
  } catch (error: any) {
    console.error('Error getting tenant health:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
