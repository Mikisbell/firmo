/**
 * GET /api/admin/delivery/metrics - Métricas de delivery de hoy
 */

import { NextResponse } from 'next/server';
import { DeliveryMetricsService } from '@/src/core/delivery';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const metrics = await DeliveryMetricsService.getTodayMetrics(TENANT_ID);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching delivery metrics:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
