import { NextRequest, NextResponse } from 'next/server';
import { revokeCrossTenantAdmin } from '@/src/core/tenant/cross-tenant-admin';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { z } from 'zod';

const revokeAdminSchema = z.object({
  employee_id: z.string().uuid('Invalid employee ID'),
});

/**
 * POST /api/admin/cross-tenant-admins/revoke
 * Revoke cross-tenant admin access from an employee
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
    const validated = revokeAdminSchema.parse(body);

    // Revoke cross-tenant admin access
    await revokeCrossTenantAdmin(validated.employee_id);

    return NextResponse.json({
      success: true,
      message: 'Cross-tenant admin access revoked',
      employee_id: validated.employee_id,
    });
  } catch (error: any) {
    console.error('Error revoking cross-tenant admin access:', error instanceof Error ? error.message : String(error));

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
