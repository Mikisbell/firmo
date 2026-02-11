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
import { AlertConfigService } from '@/src/core/alerts/alert-config';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { logger } from '@/src/core/observability/structured-logger';
import prisma from '@/src/core/db/prisma';

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
    
    if (!session || session.role !== 'ADMIN') {
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
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id } = await params;
    
    const configuration = await alertConfigService.updateAlertConfig(
      id,
      session.tenantId,
      {
        ...body,
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
    
    if (!session || session.role !== 'ADMIN') {
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
