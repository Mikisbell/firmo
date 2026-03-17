/**
 * Send test in-app notification to a specific employee
 * POST /api/admin/notifications/test
 * Body: { employee_id: string }
 * Requires ADMIN or MANAGER role
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

const log = createLogger('notifications-test');

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // Only ADMIN/MANAGER/OWNER can send test notifications
  if (!(ALLOWED_ROLES as readonly string[]).includes(user.role)) {
    return NextResponse.json(
      { error: 'Acceso denegado. Se requiere rol ADMIN o MANAGER.' },
      { status: 403 },
    );
  }

  let body: { employee_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  const { employee_id } = body;
  if (!employee_id || typeof employee_id !== 'string') {
    return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
  }

  const tenantId = user.tenantId;

  try {
    // Verify employee belongs to tenant
    const employee = await prisma.employees.findFirst({
      where: { id: employee_id, tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const notification = await prisma.notifications.create({
      data: {
        tenant_id: tenantId,
        recipient_id: employee_id,
        type: 'GENERAL',
        title: 'Notificación de prueba',
        body: `Hola ${employee.name}, este es un mensaje de prueba del sistema de notificaciones.`,
        read: false,
      },
    });

    log.info('Test notification created', { userId: employee_id, tenantId });

    return NextResponse.json({ success: true, notification_id: notification.id });
  } catch (error) {
    log.error('Error creating test notification', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al crear notificación de prueba' }, { status: 500 });
  }
}
