import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/current/metrics
 * Get current tenant metrics
 * Requirements: 7.1, 7.2, 7.3, 7.4
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

    const today = new Date().toISOString().split('T')[0];

    // Get metrics from tenant_analytics
    const metrics = await prisma.tenant_analytics.findUnique({
      where: {
        tenant_id_date: {
          tenant_id: session.tenantId,
          date: today,
        },
      },
    });

    if (!metrics) {
      // Return default metrics if none exist yet
      return NextResponse.json({
        tenant_id: session.tenantId,
        date: today,
        active_terminals: 0,
        total_orders: 0,
        total_events: 0,
        total_revenue_cents: 0,
        avg_order_value_cents: 0,
        peak_orders_per_hour: 0,
        sync_errors: 0,
        api_errors: 0,
        storage_mb: 0,
      });
    }

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Error getting tenant metrics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
