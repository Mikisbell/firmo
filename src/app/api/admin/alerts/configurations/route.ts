/**
 * API de Configuraciones de Alertas
 * 
 * Endpoints para gestionar configuraciones de alertas:
 * - GET: Listar todas las configuraciones del tenant
 * - POST: Crear nueva configuración
 * 
 * @module app/api/admin/alerts/configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { AlertConfigService } from '@/src/core/alerts/alert-config';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { logger } from '@/src/core/observability/structured-logger';

const alertConfigService = new AlertConfigService();

/**
 * GET /api/admin/alerts/configurations
 * 
 * Obtener todas las configuraciones de alertas del tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const configurations = await alertConfigService.getAllAlertConfigs(session.tenantId);

    return NextResponse.json({
      configurations,
      count: configurations.length,
    });
  } catch (error) {
    logger.error('Error al obtener configuraciones de alertas', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/alerts/configurations
 * 
 * Crear nueva configuración de alerta
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    const configuration = await alertConfigService.createAlertConfig({
      tenantId: session.tenantId,
      alertType: body.alertType,
      thresholdValue: body.thresholdValue,
      thresholdUnit: body.thresholdUnit,
      comparisonOperator: body.comparisonOperator,
      enabled: body.enabled ?? true,
      notificationChannels: body.notificationChannels,
      notificationConfig: body.notificationConfig,
      createdBy: session.userId,
    });

    return NextResponse.json(configuration, { status: 201 });
  } catch (error) {
    logger.error('Error al crear configuración de alerta', error as Error);
    
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
