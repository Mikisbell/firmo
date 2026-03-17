/**
 * Admin Notifications API
 * GET  - List notifications for authenticated employee (last 20)
 * Returns also unread_count
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('notifications-api');

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const tenantId = authResult.user.tenantId;
  const employeeId = authResult.user.id;

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notifications.findMany({
        where: {
          tenant_id: tenantId,
          recipient_id: employeeId,
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
      prisma.notifications.count({
        where: {
          tenant_id: tenantId,
          recipient_id: employeeId,
          read: false,
        },
      }),
    ]);

    return NextResponse.json({
      data: notifications,
      unread_count: unreadCount,
    });
  } catch (error) {
    log.error('Error listing notifications', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 });
  }
}
