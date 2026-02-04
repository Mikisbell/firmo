import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/:id/orders
 * Get tenant orders (cross-tenant admin only, read-only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employeeId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employeeId,
      tenantId,
      'can_view_orders',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Build where clause
    const where: any = { tenant_id: tenantId };
    if (status) {
      where.order_status = status;
    }

    // Get tenant orders (read-only)
    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.orders.count({ where }),
    ]);

    // Log action
    await logCrossTenantAdminAction(
      context,
      'VIEW_ORDERS',
      'orders',
      undefined,
      { count: orders.length, total, status }
    );

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error getting tenant orders:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
