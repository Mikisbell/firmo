/**
 * Mark single notification as read
 * POST /api/admin/notifications/[id]/read
 * Verifies tenant_id + recipient_id from JWT before updating
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('notifications-read');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const tenantId = authResult.user.tenantId;
  const employeeId = authResult.user.id;
  const { id } = await params;

  try {
    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        tenant_id: tenantId,
        recipient_id: employeeId,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    await prisma.notifications.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Error marking notification as read', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al marcar notificación' }, { status: 500 });
  }
}
