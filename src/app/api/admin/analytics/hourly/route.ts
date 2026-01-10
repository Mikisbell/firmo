/**
 * GET /api/admin/analytics/hourly
 * Returns hourly sales breakdown for the current business date
 * 
 * Requirements: 1.7
 */

import { NextResponse } from 'next/server';
import { getHourlySales } from '@/src/core/analytics/analytics.service';

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const hourlySales = await getHourlySales(tenantId);

    return NextResponse.json({ hourly: hourlySales });
  } catch (error) {
    console.error('Error fetching hourly sales:', error);
    return NextResponse.json(
      { error: 'Error al obtener ventas por hora' },
      { status: 500 }
    );
  }
}
