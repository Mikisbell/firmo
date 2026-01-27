/**
 * Admin Notification Read API
 * POST - Mark notification as read
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { markNotificationAsRead } from '@/src/core/notifications/admin-notifier';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await markNotificationAsRead(params.id, session.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Error al marcar notificación como leída' },
      { status: 500 }
    );
  }
}
