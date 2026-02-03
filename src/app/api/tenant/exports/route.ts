import { NextRequest, NextResponse } from 'next/server';
import { listTenantExports } from '@/src/core/tenant/export';
import { getTenantContext } from '@/src/core/tenant/tenant-context';

/**
 * GET /api/tenant/exports
 * List all exports for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const contextResult = await getTenantContext(request);

    if (!contextResult.valid) {
      return contextResult.response;
    }

    const { context } = contextResult;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

    const exports = await listTenantExports(context.tenant_id, limit);

    return NextResponse.json(exports);
  } catch (error) {
    console.error('List exports failed:', error);

    return NextResponse.json(
      { error: 'Failed to list exports' },
      { status: 500 }
    );
  }
}
