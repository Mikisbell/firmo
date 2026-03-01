/**
 * PATCH /api/delivery/[id]/fail - Marcar delivery como fallido
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { cache } from '@/src/core/cache/redis.service';
import { logger } from '@/src/core/observability/structured-logger';

const FailSchema = z.object({
  reason: z.string().min(1, 'La razón del fallo es requerida'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = FailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const delivery = await DeliveryService.markFailed(id, parsed.data.reason);

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
    logger.error('Error al marcar delivery como fallido', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
