/**
 * Public Menu API - GET (no auth required)
 *
 * Resolves a tenant slug + table ID to a full menu with products.
 * Cached for 5 minutes.
 *
 * @module app/api/menu/[tenantSlug]/[tableId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { tableQrService } from '@/src/core/tables/table-qr.service';

interface RouteContext {
  params: Promise<{ tenantSlug: string; tableId: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, tableId } = await context.params;

    if (!tenantSlug || !tableId) {
      return NextResponse.json(
        { error: 'Parámetros inválidos' },
        { status: 400 },
      );
    }

    const result = await tableQrService.resolveTableMenu(tenantSlug, tableId);

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json(
        { error: result.error.message },
        { status },
      );
    }

    return NextResponse.json(result.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Error al cargar menú' },
      { status: 500 },
    );
  }
}
