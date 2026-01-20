/**
 * GET /api/admin/analytics/comparison
 * Returns comparison metrics (current vs same day last week)
 */

import { NextResponse } from 'next/server';
import { getComparison } from '@/src/core/analytics/analytics.service';

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const comparison = await getComparison(tenantId);

    return NextResponse.json(comparison);
  } catch (error) {
    console.error('Analytics comparison error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
