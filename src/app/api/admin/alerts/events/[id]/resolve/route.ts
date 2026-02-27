/**
 * API para Resolver Alerta
 * 
 * POST /api/admin/alerts/events/[id]/resolve
 * 
 * @module app/api/admin/alerts/events/[id]/resolve
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertNotifier } from '@/src/core/alerts/alert-notifier';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { logger } from '@/src/core/observability/structured-logger';
import prisma from '@/src/core/db/prisma';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

const alertNotifier = new AlertNotifier();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request, prisma);

    if (!session || !(ADMIN_ROLES as readonly string[]).includes(session.role)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;
    await alertNotifier.resolveAlert(
      id,
      session.tenantId,
      session.employeeId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error al resolver alerta', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
