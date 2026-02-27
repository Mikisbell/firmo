import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import {
  withCrossTenantAdmin,
  logCrossTenantAdminAction,
} from '@/src/core/tenant/cross-tenant-admin';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * GET /api/admin/tenants
 * List all tenants (cross-tenant admin only)
 */
export async function GET(request: NextRequest) {
  try {
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
      '', // No specific tenant for list operation
      'can_view_configuration',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Get all tenants
    const tenants = await prisma.tenants.findMany({
      include: {
        tenant_settings: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Log action
    await logCrossTenantAdminAction(
      context,
      'LIST_TENANTS',
      'tenants',
      undefined,
      { count: tenants.length }
    );

    return NextResponse.json(tenants);
  } catch (error: any) {
    console.error('Error listing tenants:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
