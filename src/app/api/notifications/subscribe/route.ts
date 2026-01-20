/**
 * POST /api/notifications/subscribe - Subscribe to push notifications
 * DELETE /api/notifications/subscribe - Unsubscribe from push notifications
 * 
 * Requirements: 4.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';
import type { PushSubscriptionData } from '@/src/core/notifications/types';

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate subscription data
    if (!body.subscription || !body.subscription.endpoint || !body.subscription.keys) {
      return NextResponse.json(
        { error: 'Datos de suscripción inválidos' },
        { status: 400 }
      );
    }

    const subscription: PushSubscriptionData = {
      endpoint: body.subscription.endpoint,
      keys: {
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
      },
      expirationTime: body.subscription.expirationTime,
    };

    // Validate keys are present
    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json(
        { error: 'Faltan claves de suscripción (p256dh, auth)' },
        { status: 400 }
      );
    }

    await notificationService.subscribe(
      session.tenantId,
      session.employeeId,
      subscription
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Subscribe error:', error);
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
    
    if (!body.endpoint) {
      return NextResponse.json(
        { error: 'Falta endpoint' },
        { status: 400 }
      );
    }

    await notificationService.unsubscribe(
      session.tenantId,
      session.employeeId,
      body.endpoint
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Error al desuscribirse' },
      { status: 500 }
    );
  }
}
