// src/app/api/admin/security/sessions/route.ts
// Get all active sessions

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { ADMIN_ROLES } from '@/src/core/constants/roles';
import { logger } from '@/src/core/observability/structured-logger';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function GET(request: NextRequest) {
  try {
    logger.info('Solicitud GET recibida para sesiones activas');

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      logger.warn('No autorizado - sin sesión activa');
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const employee = await prisma.employees.findFirst({
      where: { id: session.employeeId, tenant_id: session.tenantId },
    });

    if (!employee || !(ADMIN_ROLES as readonly string[]).includes(employee.role)) {
      logger.warn('Prohibido - no es administrador');
      return NextResponse.json(
        { error: 'Prohibido - se requiere acceso de administrador' },
        { status: 403 }
      );
    }

    logger.debug('Obteniendo todas las sesiones');

    // Get all sessions (active and inactive)
    const sessions = await prisma.active_sessions.findMany({
      where: {
        tenant_id: session.tenantId,
      },
      orderBy: {
        started_at: 'desc',
      },
      take: 500,
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(sessions.map(s => s.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    logger.info('Sesiones encontradas', { count: sessions.length });

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        employee: employeeMap.get(s.employee_id),
        terminal_id: s.terminal_id,
        device_id: s.device_id,
        mac_address: s.mac_address,
        ip_address: s.ip_address,
        started_at: s.started_at,
        last_activity_at: s.last_activity_at,
        is_active: s.is_active,
        is_suspicious: s.is_suspicious,
      })),
    });
  } catch (error) {
    logger.error('Error al obtener sesiones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener sesiones' },
      { status: 500 }
    );
  }
}
