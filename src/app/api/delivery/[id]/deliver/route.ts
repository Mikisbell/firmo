/**
 * PATCH /api/delivery/[id]/deliver - Marcar delivery como entregado
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { cache } from '@/src/core/cache/redis.service';

const DeliverSchema = z.object({
  signatureUrl: z.string().url().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    let signatureUrl: string | undefined;
    try {
      const body = await request.json();
      const parsed = DeliverSchema.safeParse(body);
      if (parsed.success) {
        signatureUrl = parsed.data.signatureUrl;
      }
    } catch {
      // Body vacío es válido
    }

    const delivery = await DeliveryService.markDelivered(id, signatureUrl);

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
    console.error('Error delivering:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
