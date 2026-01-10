/**
 * GET /api/admin/delivery/driver-metrics - Métricas por motorizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryMetricsService } from '@/src/core/delivery';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Default: últimos 7 días
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const from = dateFrom || weekAgo.toISOString().split('T')[0];
    const to = dateTo || today.toISOString().split('T')[0];

    const metrics = await DeliveryMetricsService.getDriverMetrics(TENANT_ID, from, to);
    return NextResponse.json({ metrics, dateFrom: from, dateTo: to });
  } catch (error) {
    console.error('Error fetching driver metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
