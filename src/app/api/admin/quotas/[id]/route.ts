import { NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/admin/quotas/:id
 * Update quota for current tenant
 * 
 * NOTE: This endpoint is not yet implemented.
 * It's a stub for E2E testing purposes.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: 'Quota update endpoint not yet implemented' },
    { status: 404 }
  );
}
