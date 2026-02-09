import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/quotas
 * Get quotas for current tenant
 * 
 * NOTE: This endpoint is not yet implemented.
 * It's a stub for E2E testing purposes.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Quotas endpoint not yet implemented' },
    { status: 404 }
  );
}
