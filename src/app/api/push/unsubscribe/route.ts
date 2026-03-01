/**
 * Endpoint API para desuscripción de notificaciones push
 *
 * POST /api/push/unsubscribe
 *
 * Elimina una suscripción Web Push API de un repartidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { unsubscribe } from '@/src/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/src/core/delivery/types-2026';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

const pushUnsubscribeSchema = z.object({
  driverId: z.string().min(1, 'driverId es requerido'),
  endpoint: z.string().min(1, 'endpoint es requerido'),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();

    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { driverId, endpoint } = parsed.data;

    // Eliminar suscripción — tenant_id del JWT
    await unsubscribe(
      toTenantId(authResult.user.tenantId),
      toDriverId(driverId),
      endpoint
    );

    return NextResponse.json({
      success: true,
      message: 'Suscripción push eliminada exitosamente',
    });
  } catch (error) {
    logger.error('Error al eliminar suscripción push', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al eliminar suscripción push' },
      { status: 500 }
    );
  }
}
