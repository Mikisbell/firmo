/**
 * Admin Notifications Stats API
 * GET - Get notification statistics (unread count, has critical)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { getAdminNotificationStats } from '@/src/core/notifications/admin-notifier';

export async function GET(request: NextRequest) {
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

    // Get stats
    const stats = await getAdminNotificationStats(session.tenantId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
