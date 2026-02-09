import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/tenant/restore
 * Restore tenant data from backup
 * 
 * NOTE: This endpoint is not yet implemented.
 * It's a stub for E2E testing purposes.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Restore endpoint not yet implemented' },
    { status: 404 }
  );
}
