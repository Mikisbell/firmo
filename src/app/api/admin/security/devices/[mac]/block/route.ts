// src/app/api/admin/security/devices/[mac]/block/route.ts
// Block a device (MAC address)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { blockMAC } from '@/src/core/security/mac-validator-hybrid';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { ADMIN_ROLES } from '@/src/core/constants/roles';
import { logger } from '@/src/core/observability/structured-logger';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mac: string }> }
) {
  try {
    const { mac } = await params;
    logger.info('Solicitud POST recibida para bloquear dispositivo');

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

    const body = await request.json();
    const { reason } = body;

    logger.info('Bloqueando dispositivo', { reason });

    // Block the MAC
    await blockMAC(session.tenantId, mac, reason || 'Blocked by admin');

    // Create alert
    const device = await prisma.device_mac_addresses.findFirst({
      where: {
        mac_address: mac,
        tenant_id: session.tenantId,
      },
    });

    if (device) {
      await prisma.session_alerts.create({
        data: {
          id: require('uuid').v4(),
          tenant_id: session.tenantId,
          employee_id: device.employee_id,
          alert_type: 'BLOCKED_DEVICE',
          reason: `Device blocked by admin: ${reason || 'No reason provided'}`,
          mac_address: mac,
          is_resolved: false,
        },
      });
    }

    logger.info('Dispositivo bloqueado exitosamente');

    return NextResponse.json({
      success: true,
      message: 'Dispositivo bloqueado exitosamente',
      mac_address: mac,
    });
  } catch (error) {
    logger.error('Error al bloquear dispositivo', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al bloquear dispositivo' },
      { status: 500 }
    );
  }
}
