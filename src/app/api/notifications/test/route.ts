/**
 * POST /api/notifications/test - Send test notification
 * 
 * Requirements: 7.3
 * - Any authenticated user can send test to themselves
 * - ADMIN role required to send to other employees
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Determine target employee
    let targetEmployeeId = session.employeeId;

    if (body.employee_id && body.employee_id !== session.employeeId) {
      // Sending to another employee requires admin role
      if (!(ADMIN_ROLES as readonly string[]).includes(session.role)) {
        return NextResponse.json(
          { error: 'Se requiere rol de administrador para enviar prueba a otros empleados' },
          { status: 403 }
        );
      }
      targetEmployeeId = body.employee_id;
    }

    const result = await notificationService.sendTest(
      session.tenantId,
      targetEmployeeId
    );

    if (result.sent === 0 && result.failed === 0) {
      return NextResponse.json({
        success: false,
        message: 'No se encontraron suscripciones activas para este empleado',
        sent: 0,
        failed: 0,
      });
    }

    return NextResponse.json({
      success: result.sent > 0,
      message: result.sent > 0 
        ? `Notificación de prueba enviada a ${result.sent} dispositivo(s)` 
        : 'Error al enviar notificación de prueba',
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('[API] Test notification error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al enviar notificación de prueba' },
      { status: 500 }
    );
  }
}
