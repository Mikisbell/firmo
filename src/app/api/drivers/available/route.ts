/**
 * GET /api/drivers/available - Obtener drivers disponibles
 */

import { NextResponse } from 'next/server';
import { DriverService } from '@/src/core/delivery';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const drivers = await DriverService.getAvailable(TENANT_ID);
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
