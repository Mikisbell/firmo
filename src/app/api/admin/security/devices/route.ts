// src/app/api/admin/security/devices/route.ts
// List all devices (MAC addresses) registered in the system

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
    logger.info('Solicitud GET recibida para dispositivos');

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

    logger.debug('Obteniendo todos los dispositivos');

    // Get all devices
    const devices = await prisma.device_mac_addresses.findMany({
      where: {
        tenant_id: session.tenantId,
      },
      orderBy: {
        last_seen: 'desc',
      },
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(devices.map(d => d.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    logger.info('Dispositivos encontrados', { count: devices.length });

    return NextResponse.json({
      success: true,
      devices: devices.map((device) => ({
        mac_address: device.mac_address,
        employee: employeeMap.get(device.employee_id),
        terminal_id: device.terminal_id,
        trust_level: device.trust_level,
        first_seen: device.first_seen,
        last_seen: device.last_seen,
        is_active: device.is_active,
        access_count: device.access_count,
      })),
    });
  } catch (error) {
    logger.error('Error al obtener dispositivos', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener dispositivos' },
      { status: 500 }
    );
  }
}
