// src/app/api/admin/security/alerts/route.ts
// Get all security alerts

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
    logger.info('Solicitud GET recibida para alertas de seguridad');

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      logger.warn('No autorizado - sin sesión');
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
      logger.warn('Prohibido - no es admin');
      return NextResponse.json(
        { error: 'Prohibido - se requiere acceso de administrador' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
    const alertType = url.searchParams.get('alert_type');
    const isResolved = url.searchParams.get('is_resolved');

    logger.info('Obteniendo alertas de seguridad');

    // Build where clause
    const where: any = {
      tenant_id: session.tenantId,
    };

    if (alertType) {
      where.alert_type = alertType;
    }

    if (isResolved !== null) {
      where.is_resolved = isResolved === 'true';
    }

    // Get alerts
    const alerts = await prisma.session_alerts.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Get total count
    const total = await prisma.session_alerts.count({ where });

    logger.info('Alertas encontradas', { count: alerts.length });

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      alerts: alerts.map((a) => ({
        id: a.id,
        employee_id: a.employee_id,
        alert_type: a.alert_type,
        reason: a.reason,
        mac_address: a.mac_address,
        ip_address: a.ip_address,
        is_resolved: a.is_resolved,
        resolved_by: a.resolved_by,
        resolved_at: a.resolved_at,
        created_at: a.created_at,
      })),
    });
  } catch (error) {
    logger.error('Error al obtener alertas de seguridad', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener alertas' },
      { status: 500 }
    );
  }
}
