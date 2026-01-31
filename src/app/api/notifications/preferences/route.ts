/**
 * GET /api/notifications/preferences - Get notification preferences
 * PATCH /api/notifications/preferences - Update notification preferences
 * 
 * Requirements: 9.1, 9.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';

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
    console.error('[API] Get preferences error:', error);
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
    
    // Validate that at least one preference is being updated
    const validKeys = ['items_ready', 'request_check', 'sound_enabled'];
    const updates: Record<string, boolean> = {};
    
    for (const key of validKeys) {
      if (typeof body[key] === 'boolean') {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No hay preferencias válidas para actualizar' },
        { status: 400 }
      );
    }

    const preferences = await notificationService.updatePreferences(
      session.tenantId,
      session.employeeId,
      updates
    );

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('[API] Update preferences error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar preferencias' },
      { status: 500 }
    );
  }
}
