/**
 * API Endpoint: Reset Sync
 * 
 * Endpoint de recuperación manual para reiniciar el estado de sincronización.
 * Requiere autenticación de administrador.
 * 
 * @module api/admin/recovery/reset-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RecoveryService } from '@/src/core/recovery/recovery-service';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';

/**
 * Schema de validación para la solicitud de reset de sincronización
 */
const ResetSyncRequestSchema = z.object({
  reason: z.string().min(10).max(500).describe('Razón para reiniciar la sincronización'),
  terminalId: z.string().uuid().optional().describe('ID de terminal específico (opcional)'),
  force: z.boolean().optional().default(false).describe('Forzar reset incluso si hay eventos pendientes'),
});

type ResetSyncRequest = z.infer<typeof ResetSyncRequestSchema>;

/**
 * POST /api/admin/recovery/reset-sync
 * 
 * Reinicia el estado de sincronización para un terminal o todos los terminales.
 * 
 * @param request - Request de Next.js con body JSON
 * @returns Response con resultado de la operación
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Autenticación - Verificar que el usuario es admin
    const session = await getSessionFromRequest(request, prisma);
    
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
    const validationResult = ResetSyncRequestSchema.safeParse(body);

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

    const { reason, terminalId, force } = validationResult.data;

    // 3. Ejecutar acción de recuperación
    const recoveryService = RecoveryService.getInstance();
    const result = await recoveryService.executeRecoveryAction({
      actionType: 'RESET_SYNC',
      reason,
      tenantId: session.tenantId,
      userId: session.employeeId,
      metadata: { terminalId, force },
    });

    // 4. Retornar resultado
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Sincronización reiniciada exitosamente',
          details: {
            action: 'RESET_SYNC',
            terminalId: terminalId || 'all',
            force,
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
            message: result.message || 'Error al reiniciar la sincronización',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error en endpoint reset-sync:', error);
    
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
