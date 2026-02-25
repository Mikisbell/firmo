/**
 * PATCH /api/delivery/[id]/dispatch - Marcar delivery como despachado
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { cache } from '@/src/core/cache/redis.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const delivery = await DeliveryService.markDispatched(id);

    // Invalidar caché Redis de delivery metrics/history
    await cache.invalidatePattern('delivery:*');

    return NextResponse.json(delivery);
  } catch (error) {
    if (error instanceof DeliveryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error dispatching delivery:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
