import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants/:id/configuration
 * Get tenant configuration (cross-tenant admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

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
      'can_view_configuration',
      {
        ip_address: request.ip,
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get tenant configuration
    const configuration = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!configuration) {
      return NextResponse.json(
        { error: 'Tenant configuration not found' },
        { status: 404 }
      );
    }

    // Log action
    await logCrossTenantAdminAction(
      context,
      'VIEW_CONFIGURATION',
      'tenant_settings',
      tenantId
    );

    return NextResponse.json(configuration);
  } catch (error: any) {
    console.error('Error getting tenant configuration:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
