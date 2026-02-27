/**
 * API de Configuración Individual de Alerta
 * 
 * Endpoints para gestionar una configuración específica:
 * - GET: Obtener configuración por ID
 * - PATCH: Actualizar configuración
 * - DELETE: Eliminar configuración
 * 
 * @module app/api/admin/alerts/configurations/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AlertConfigService } from '@/src/core/alerts/alert-config';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { logger } from '@/src/core/observability/structured-logger';
import prisma from '@/src/core/db/prisma';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

const UpdateAlertConfigSchema = z.object({
  alertType: z.enum(['ERROR_RATE', 'RESPONSE_TIME', 'UPTIME', 'CACHE_HIT_RATE', 'DB_POOL']).optional(),
  thresholdValue: z.number().optional(),
  thresholdUnit: z.enum(['PERCENTAGE', 'MILLISECONDS', 'COUNT']).optional(),
  comparisonOperator: z.enum(['GT', 'LT', 'GTE', 'LTE', 'EQ']).optional(),
  enabled: z.boolean().optional(),
  notificationChannels: z.array(z.enum(['email', 'slack', 'webhook'])).optional(),
});

const alertConfigService = new AlertConfigService();

/**
 * GET /api/admin/alerts/configurations/[id]
 */
export async function GET(
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
    const configuration = await alertConfigService.getAlertConfig(
      id,
      session.tenantId
    );

    if (!configuration) {
      return NextResponse.json(
        { error: 'Configuración no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(configuration);
  } catch (error) {
    logger.error('Error al obtener configuración de alerta', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/alerts/configurations/[id]
 */
export async function PATCH(
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const parsed = UpdateAlertConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { id } = await params;

    const configuration = await alertConfigService.updateAlertConfig(
      id,
      session.tenantId,
      {
        ...parsed.data,
        updatedBy: session.employeeId,
      }
    );

    return NextResponse.json(configuration);
  } catch (error) {
    logger.error('Error al actualizar configuración de alerta', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/alerts/configurations/[id]
 */
export async function DELETE(
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
    await alertConfigService.deleteAlertConfig(id, session.tenantId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error al eliminar configuración de alerta', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
