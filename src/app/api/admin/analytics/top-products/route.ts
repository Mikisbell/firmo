/**
 * GET /api/admin/analytics/top-products
 * Returns top selling products for the current business date
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTopProducts } from '@/src/core/analytics/analytics.service';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    const products = await getTopProducts(tenantId, Math.min(limit, 20));

    return NextResponse.json(products);
  } catch (error) {
    console.error('Analytics top-products error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
