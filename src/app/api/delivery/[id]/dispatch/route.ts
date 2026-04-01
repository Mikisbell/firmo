/**
 * PATCH /api/delivery/[id]/dispatch - Marcar delivery como despachado
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { cache } from '@/src/core/cache/redis.service';
import { logger } from '@/src/core/observability/structured-logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

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
    logger.error('Error al despachar delivery', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
