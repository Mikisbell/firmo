/**
 * Mark all notifications as read for authenticated employee
 * POST /api/admin/notifications/read-all
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('notifications-read-all');

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const tenantId = authResult.user.tenantId;
  const employeeId = authResult.user.id;

  try {
    const result = await prisma.notifications.updateMany({
      where: {
        tenant_id: tenantId,
        recipient_id: employeeId,
        read: false,
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    log.error('Error marking all notifications as read', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al marcar notificaciones' }, { status: 500 });
  }
}
