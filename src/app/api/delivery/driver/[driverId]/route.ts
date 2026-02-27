/**
 * GET /api/delivery/driver/[driverId] - Obtener deliveries de un motorizado
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/src/core/delivery';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const { driverId } = await params;
    const deliveries = await DeliveryService.getDriverDeliveries(driverId);
    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Error fetching driver deliveries:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
