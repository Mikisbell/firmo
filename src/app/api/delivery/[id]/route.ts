/**
 * GET /api/delivery/[id] - Obtener delivery por ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeliveryService } from '@/src/core/delivery';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { id } = await params;
    const delivery = await DeliveryService.getById(id);

    if (!delivery) {
      return NextResponse.json(
        { error: 'Entrega no encontrada', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(delivery);
  } catch (error) {
    logger.error('Error al obtener delivery', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
