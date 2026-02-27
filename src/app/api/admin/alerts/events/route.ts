/**
 * API de Eventos de Alertas
 * 
 * Endpoints para gestionar eventos de alertas:
 * - GET: Listar eventos de alertas con filtros
 * 
 * @module app/api/admin/alerts/events
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertNotifier } from '@/src/core/alerts/alert-notifier';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { logger } from '@/src/core/observability/structured-logger';
import prisma from '@/src/core/db/prisma';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

const alertNotifier = new AlertNotifier();

/**
 * GET /api/admin/alerts/events
 * 
 * Obtener eventos de alertas con filtros opcionales
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    
    if (!session || !(ADMIN_ROLES as readonly string[]).includes(session.role)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const alertType = searchParams.get('alertType');
    const limit = parseInt(searchParams.get('limit') || '50');

    const events = await alertNotifier.getAlertEvents(
      session.tenantId,
      {
        status: status as any,
        alertType: alertType as any,
        limit,
      }
    );

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error) {
    logger.error('Error al obtener eventos de alertas', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
