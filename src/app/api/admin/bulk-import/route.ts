import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/bulk-import
 * Bulk import data for current tenant
 * 
 * NOTE: This endpoint is not yet implemented.
 * It's a stub for E2E testing purposes.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Endpoint de importación masiva aún no implementado' },
    { status: 404 }
  );
}
