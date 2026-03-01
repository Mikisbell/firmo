/**
 * Endpoint API para envío de notificaciones push
 *
 * POST /api/push/send
 *
 * Envía una notificación push a un repartidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendNotification } from '@/src/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/src/core/delivery/types-2026';
import type { PushNotification } from '@/src/core/delivery/types-2026';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/structured-logger';

const pushNotificationSchema = z.object({
  title: z.string().min(1, 'title es requerido'),
  body: z.string().min(1, 'body es requerido'),
  priority: z.enum(['urgent', 'normal'], { message: 'Prioridad inválida. Debe ser "urgent" o "normal"' }),
  expiresAt: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

const pushSendSchema = z.object({
  driverId: z.string().min(1, 'driverId es requerido'),
  notification: pushNotificationSchema,
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();

    const parsed = pushSendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { driverId, notification } = parsed.data;

    // Parsear expiresAt si se proporcionó
    const pushNotification: PushNotification = {
      ...notification,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined,
    };

    // Enviar notificación — tenant_id del JWT
    await sendNotification(
      toTenantId(authResult.user.tenantId),
      toDriverId(driverId),
      pushNotification
    );

    return NextResponse.json({
      success: true,
      message: 'Notificación push enviada exitosamente',
    });
  } catch (error) {
    logger.error('Error al enviar notificación push', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al enviar notificación push' },
      { status: 500 }
    );
  }
}
