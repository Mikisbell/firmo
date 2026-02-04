import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/current/activity
 * Get recent tenant activity (audit log)
 * Requirements: 7.6
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

    // Get limit from query params
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);

    const tenantId = session.tenantId;

    // Get recent audit log entries
    const activity = await prisma.cross_tenant_audit_log.findMany({
      where: {
        tenant_id: tenantId,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      select: {
        id: true,
        action: true,
        resource_type: true,
        resource_id: true,
        details: true,
        created_at: true,
      },
    });

    // Transform to match expected format
    const formattedActivity = activity.map(item => ({
      id: item.id,
      action: item.action,
      resource_type: item.resource_type,
      resource_id: item.resource_id,
      details: item.details,
      created_at: item.created_at.toISOString(),
    }));

    return NextResponse.json(formattedActivity);
  } catch (error: any) {
    console.error('Error getting tenant activity:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
