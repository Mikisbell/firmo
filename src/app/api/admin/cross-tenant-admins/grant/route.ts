import { NextRequest, NextResponse } from 'next/server';
import { grantCrossTenantAdmin } from '@/src/core/tenant/cross-tenant-admin';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { z } from 'zod';

const grantAdminSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
  permissions: z.object({
    can_view_configuration: z.boolean(),
    can_view_events: z.boolean(),
    can_view_orders: z.boolean(),
    can_view_analytics: z.boolean(),
    can_modify_configuration: z.boolean(),
    can_modify_quotas: z.boolean(),
    can_deactivate_tenant: z.boolean(),
  }),
  expiresInDays: z.number().int().positive().optional(),
});

/**
 * POST /api/admin/cross-tenant-admins/grant
 * Grant cross-tenant admin access to an employee
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = grantAdminSchema.parse(body);

    // Grant cross-tenant admin access
    await grantCrossTenantAdmin(
      validated.employee_id,
      authResult.user.id,
      validated.permissions,
      validated.expiresInDays
    );

    return NextResponse.json({
      success: true,
      message: 'Cross-tenant admin access granted',
      employee_id: validated.employee_id,
      expires_in_days: validated.expiresInDays || null,
    });
  } catch (error: any) {
    console.error('Error granting cross-tenant admin access:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
