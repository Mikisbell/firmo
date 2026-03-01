// src/app/api/admin/security/terminals/[id]/access-log/route.ts
// Get access log for a specific terminal (which MACs accessed it)

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.info('Solicitud GET recibida para log de acceso de terminal', { terminalId: id });

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
    const employee = await prisma.employees.findUnique({
      where: { id: session.employeeId },
    });

    if (!employee || !(ADMIN_ROLES as readonly string[]).includes(employee.role)) {
      logger.warn('Prohibido - no es administrador');
      return NextResponse.json(
        { error: 'Prohibido - se requiere acceso de administrador' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    logger.debug('Obteniendo log de acceso para terminal', { terminalId: id });

    // Get access log for terminal
    const accessLog = await prisma.terminal_mac_registry.findMany({
      where: {
        tenant_id: session.tenantId,
        terminal_id: id,
      },
      orderBy: {
        last_seen: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(accessLog.map(log => log.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Get total count
    const total = await prisma.terminal_mac_registry.count({
      where: {
        tenant_id: session.tenantId,
        terminal_id: id,
      },
    });

    logger.info('Registros de acceso encontrados', { count: accessLog.length, terminalId: id });

    return NextResponse.json({
      success: true,
      terminal_id: id,
      total,
      limit,
      offset,
      access_log: accessLog.map((log) => ({
        mac_address: log.mac_address,
        employee: employeeMap.get(log.employee_id),
        first_seen: log.first_seen,
        last_seen: log.last_seen,
        access_count: log.access_count,
        is_authorized: log.is_authorized,
      })),
    });
  } catch (error) {
    logger.error('Error al obtener log de acceso de terminal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener log de acceso' },
      { status: 500 }
    );
  }
}
