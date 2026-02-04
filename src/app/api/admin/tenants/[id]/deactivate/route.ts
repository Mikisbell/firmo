import { NextRequest, NextResponse } from 'next/server';
import { deactivateTenant } from '@/src/core/tenant/deactivation';
import { withCrossTenantAdmin } from '@/src/core/tenant/cross-tenant-admin';
import { validateToken } from '@/src/core/auth/auth.service';

/**
 * POST /api/admin/tenants/:id/deactivate
 * 
 * Deactivate a tenant (prevent logins and API access)
 * 
 * Requirements: 14.1, 14.2, 14.7
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenant_id } = await params;

    // Get authentication token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate token
    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload?.sub) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify cross-tenant admin authorization
    await withCrossTenantAdmin(
      tokenResult.payload.sub,
      tenant_id,
      'can_deactivate_tenant',
      {
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || undefined,
      }
    );

    // Deactivate tenant
    await deactivateTenant(tenant_id);

    return NextResponse.json(
      {
        success: true,
        message: `Tenant ${tenant_id} has been deactivated`,
        tenant_id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deactivating tenant:', error);

    if (error instanceof Error && error.message.includes('authorization')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to deactivate tenant' },
      { status: 500 }
    );
  }
}
