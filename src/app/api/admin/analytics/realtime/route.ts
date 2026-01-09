/**
 * GET /api/admin/analytics/realtime
 * Returns real-time metrics for the current shift/business date
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeMetrics } from '@/src/core/analytics/analytics.service';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);
    const shiftId = searchParams.get('shift_id') || undefined;

    const metrics = await getRealtimeMetrics(tenantId, shiftId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Analytics realtime error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
