/**
 * Admin Notifications Read All API
 * POST - Mark all notifications as read
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { markAllNotificationsAsRead } from '@/src/core/notifications/admin-notifier';

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    // Check role
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Se requiere rol de ADMIN u OWNER.' },
        { status: 403 }
      );
    }

    const count = await markAllNotificationsAsRead(session.tenantId);

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Error al marcar todas las notificaciones como leídas' },
      { status: 500 }
    );
  }
}
