import { NextRequest, NextResponse } from 'next/server';
import { listTenantExports } from '@/src/core/tenant/export';
import { getTenantContext } from '@/src/core/tenant/tenant-context';
import { logger } from '@/src/core/observability/structured-logger';

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
    logger.error('Error al listar exportaciones del tenant', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      { error: 'Error al listar exportaciones' },
      { status: 500 }
    );
  }
}
