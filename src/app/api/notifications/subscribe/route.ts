/**
 * POST /api/notifications/subscribe - Subscribe to push notifications
 * DELETE /api/notifications/subscribe - Unsubscribe from push notifications
 * 
 * Requirements: 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';
import type { PushSubscriptionData } from '@/src/core/notifications/types';
import { logger } from '@/src/core/observability/structured-logger';

const notificationSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().min(1, 'endpoint es requerido'),
    keys: z.object({
      p256dh: z.string().min(1, 'p256dh es requerido'),
      auth: z.string().min(1, 'auth es requerido'),
    }, { required_error: 'keys es requerido' }),
    expirationTime: z.number().nullish(),
  }, { required_error: 'Datos de suscripción inválidos' }),
});

const notificationUnsubscribeSchema = z.object({
  endpoint: z.string().min(1, 'Falta endpoint'),
});

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = notificationSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const subscription: PushSubscriptionData = {
      endpoint: parsed.data.subscription.endpoint,
      keys: {
        p256dh: parsed.data.subscription.keys.p256dh,
        auth: parsed.data.subscription.keys.auth,
      },
      expirationTime: parsed.data.subscription.expirationTime ?? undefined,
    };

    await notificationService.subscribe(
      session.tenantId,
      session.employeeId,
      subscription
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error al suscribirse a notificaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al suscribirse' },
      { status: 500 }
    );
  }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = notificationUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    await notificationService.unsubscribe(
      session.tenantId,
      session.employeeId,
      parsed.data.endpoint
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error al desuscribirse de notificaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al desuscribirse' },
      { status: 500 }
    );
  }
}
