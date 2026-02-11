/**
 * API Endpoint: Configuración de Niveles de Log
 * 
 * Permite obtener y actualizar la configuración de niveles de log
 * por módulo en tiempo de ejecución.
 * 
 * Endpoints:
 * - GET /api/admin/log-config - Obtener configuración actual
 * - POST /api/admin/log-config - Actualizar configuración
 * 
 * @module api/admin/log-config
 */

import { NextRequest, NextResponse } from 'next/server';
import { logConfig, LogLevel, LogModule } from '@/src/core/observability/log-config';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';

/**
 * GET /api/admin/log-config
 * 
 * Obtener configuración actual de niveles de log
 * 
 * Requiere autenticación de administrador
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener configuración actual
    const config = logConfig.getAllConfig();

    return NextResponse.json({
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error al obtener configuración de logs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/log-config
 * 
 * Actualizar configuración de nivel de log para un módulo
 * 
 * Body:
 * {
 *   "module": "auth" | "sync" | "events" | "orders" | "global",
 *   "level": "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL",
 *   "reason": "Razón del cambio (opcional)"
 * }
 * 
 * Requiere autenticación de administrador
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Parsear body
    const body = await request.json();
    const { module, level, reason } = body;

    // Validar parámetros requeridos
    if (!module || !level) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: module, level' },
        { status: 400 }
      );
    }

    // Actualizar configuración
    await logConfig.setLevel(
      module as LogModule,
      level as LogLevel,
      session.employeeId,
      reason
    );

    // Obtener configuración actualizada
    const config = logConfig.getAllConfig();

    return NextResponse.json({
      success: true,
      config,
      message: `Nivel de log actualizado para módulo ${module}: ${level}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error al actualizar configuración de logs:', error);
    
    // Si es error de validación, retornar 400
    if (error instanceof Error && error.message.includes('inválido')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
