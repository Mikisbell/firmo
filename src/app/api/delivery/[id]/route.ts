/**
 * GET /api/delivery/[id] - Obtener delivery por ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/src/core/delivery';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await DeliveryService.getById(id);

    if (!delivery) {
      return NextResponse.json(
        { error: 'Delivery not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Error fetching delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
