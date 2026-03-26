import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

/**
 * POST /api/admin/bulk-import
 * Bulk import data for current tenant
 *
 * NOTE: This endpoint is not yet implemented.
 * It's a stub for E2E testing purposes.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  return NextResponse.json(
    { error: 'Endpoint de importación masiva aún no implementado' },
    { status: 501 },
  );
}
