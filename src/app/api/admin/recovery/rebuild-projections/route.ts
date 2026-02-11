/**
 * API Endpoint: Rebuild Projections
 * 
 * Endpoint de recuperación manual para reconstruir proyecciones desde eventos.
 * Requiere autenticación de administrador.
 * 
 * @module api/admin/recovery/rebuild-projections
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RecoveryService } from '@/src/core/recovery/recovery-service';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';

/**
 * Schema de validación para la solicitud de reconstrucción de proyecciones
 */
const RebuildProjectionsRequestSchema = z.object({
  reason: z.string().min(10).max(500).describe('Razón para reconstruir las proyecciones'),
  projectionType: z.enum(['sales', 'inventory', 'all']).optional().default('all').describe('Tipo de proyección a reconstruir'),
  fromDate: z.string().datetime().optional().describe('Fecha desde la cual reconstruir (ISO 8601)'),
  dryRun: z.boolean().optional().default(false).describe('Simular sin aplicar cambios'),
});

type RebuildProjectionsRequest = z.infer<typeof RebuildProjectionsRequestSchema>;

/**
 * POST /api/admin/recovery/rebuild-projections
 * 
 * Reconstruye proyecciones desde el event store.
 * 
 * @param request - Request de Next.js con body JSON
 * @returns Response con resultado de la operación
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticación - Verificar que el usuario es admin
    const session = await getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Autenticación requerida',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Se requiere rol de administrador',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // 2. Validación de entrada
    const body = await request.json();
    const validationResult = RebuildProjectionsRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos',
            details: validationResult.error.format(),
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const { reason, projectionType, fromDate, dryRun } = validationResult.data;

    // 3. Ejecutar acción de recuperación
    const recoveryService = RecoveryService.getInstance();
    const result = await recoveryService.executeRecoveryAction({
      actionType: 'REBUILD_PROJECTIONS',
      reason,
      tenantId: session.tenantId,
      userId: session.employeeId,
      metadata: { projectionType, fromDate, dryRun },
    });

    // 4. Retornar resultado
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: dryRun 
            ? 'Simulación de reconstrucción completada exitosamente' 
            : 'Proyecciones reconstruidas exitosamente',
          details: {
            action: 'REBUILD_PROJECTIONS',
            projectionType,
            fromDate: fromDate || 'beginning',
            dryRun,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          error: {
            code: 'RECOVERY_FAILED',
            message: result.message || 'Error al reconstruir las proyecciones',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error en endpoint rebuild-projections:', error);
    
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
