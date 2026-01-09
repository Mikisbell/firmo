/**
 * GET /api/admin/analytics/hourly
 * Returns hourly sales breakdown for the current business date
 */

import { NextResponse } from 'next/server';
import { getHourlySales } from '@/src/core/analytics/analytics.service';

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const hourly = await getHourlySales(tenantId);

    return NextResponse.json(hourly);
  } catch (error) {
    console.error('Analytics hourly error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
