/**
 * Endpoint API para suscripción a notificaciones push
 *
 * POST /api/push/subscribe
 *
 * Almacena una suscripción Web Push API para un repartidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { subscribe } from '@/src/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/src/core/delivery/types-2026';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

const pushSubscribeSchema = z.object({
  driverId: z.string().min(1, 'driverId es requerido'),
  subscription: z.object({
    endpoint: z.string().min(1, 'endpoint es requerido'),
    keys: z.object({
      p256dh: z.string().min(1, 'p256dh es requerido'),
      auth: z.string().min(1, 'auth es requerido'),
    }),
  }, { required_error: 'subscription es requerido' }),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();

    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { driverId, subscription } = parsed.data;

    // Guardar suscripción — tenant_id del JWT
    await subscribe(
      toTenantId(authResult.user.tenantId),
      toDriverId(driverId),
      subscription
    );

    return NextResponse.json({
      success: true,
      message: 'Suscripción push almacenada exitosamente',
    });
  } catch (error) {
    logger.error('Error al almacenar suscripción push', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al almacenar suscripción push' },
      { status: 500 }
    );
  }
}
