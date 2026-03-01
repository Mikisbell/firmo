/**
 * GET /api/notifications/preferences - Get notification preferences
 * PATCH /api/notifications/preferences - Update notification preferences
 * 
 * Requirements: 9.1, 9.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';
import { logger } from '@/src/core/observability/structured-logger';

const updatePreferencesSchema = z.object({
  items_ready: z.boolean().optional(),
  request_check: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
}).refine(
  (data) => data.items_ready !== undefined || data.request_check !== undefined || data.sound_enabled !== undefined,
  { message: 'No hay preferencias válidas para actualizar' }
);

// GET - Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const preferences = await notificationService.getPreferences(
      session.tenantId,
      session.employeeId
    );

    return NextResponse.json(preferences);
  } catch (error) {
    logger.error('Error al obtener preferencias de notificaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener preferencias' },
      { status: 500 }
    );
  }
}

// PATCH - Update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = updatePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Build updates object with only defined boolean fields
    const updates: Record<string, boolean> = {};
    const { items_ready, request_check, sound_enabled } = parsed.data;
    if (items_ready !== undefined) updates.items_ready = items_ready;
    if (request_check !== undefined) updates.request_check = request_check;
    if (sound_enabled !== undefined) updates.sound_enabled = sound_enabled;

    const preferences = await notificationService.updatePreferences(
      session.tenantId,
      session.employeeId,
      updates
    );

    return NextResponse.json(preferences);
  } catch (error) {
    logger.error('Error al actualizar preferencias de notificaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    );
  }
}
