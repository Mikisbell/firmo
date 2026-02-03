import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/:id/events
 * Get tenant events (cross-tenant admin only, read-only)
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

    // Get authentication session
    const session = await getSessionFromRequest(request, prisma);
    if (!session || !session.employee_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin access
    const context = await withCrossTenantAdmin(
      session.employee_id,
      tenantId,
      'can_view_events',
      {
        ip_address: request.ip,
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get tenant events (read-only)
    const [events, total] = await Promise.all([
      prisma.events.findMany({
        where: { tenant_id: tenantId },
        orderBy: { occurred_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.events.count({
        where: { tenant_id: tenantId },
      }),
    ]);

    // Log action
    await logCrossTenantAdminAction(
      context,
      'VIEW_EVENTS',
      'events',
      undefined,
      { count: events.length, total }
    );

    return NextResponse.json({
      events,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error getting tenant events:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
