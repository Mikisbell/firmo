/**
 * PATCH /api/delivery/[id]/assign - Asignar motorizado a delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { cache } from '@/src/core/cache/redis.service';

const AssignDriverSchema = z.object({
  driverId: z.string().uuid('ID de repartidor inválido'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = AssignDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const delivery = await DeliveryService.assignDriver(id, parsed.data.driverId);

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
    console.error('Error assigning driver:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
