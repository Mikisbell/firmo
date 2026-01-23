/**
 * GET /api/drivers/available - Obtener drivers disponibles
 */

import { NextResponse } from 'next/server';
import { DriverService } from '@/src/core/delivery';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

export async function GET() {
  try {
    const drivers = await DriverService.getAvailable(TENANT_ID);
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
