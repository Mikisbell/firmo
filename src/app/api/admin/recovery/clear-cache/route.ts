/**
 * API Endpoint: Clear Cache
 * 
 * Endpoint de recuperación manual para limpiar la caché de Redis.
 * Requiere autenticación de administrador.
 * 
 * @module api/admin/recovery/clear-cache
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { RecoveryService } from '@/src/core/recovery/recovery-service';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

/**
 * Schema de validación para la solicitud de limpieza de caché
 */
const ClearCacheRequestSchema = z.object({
  reason: z.string().min(10).max(500).describe('Razón para limpiar la caché'),
  tags: z.array(z.string()).optional().describe('Tags específicos a limpiar (opcional)'),
});

type ClearCacheRequest = z.infer<typeof ClearCacheRequestSchema>;

/**
 * POST /api/admin/recovery/clear-cache
 * 
 * Limpia la caché de Redis completamente o por tags específicos.
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

    if (!(ADMIN_ROLES as readonly string[]).includes(session.role)) {
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
    const validationResult = ClearCacheRequestSchema.safeParse(body);

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

    const { reason, tags } = validationResult.data;

    // 3. Ejecutar acción de recuperación
    const recoveryService = RecoveryService.getInstance();
    const result = await recoveryService.executeRecoveryAction({
      actionType: 'CLEAR_CACHE',
      reason,
      tenantId: session.tenantId,
      userId: session.employeeId,
      metadata: { tags },
    });

    // 4. Retornar resultado
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'Caché limpiada exitosamente',
          details: {
            action: 'CLEAR_CACHE',
            tags: tags || 'all',
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
            message: result.message || 'Error al limpiar la caché',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error en endpoint clear-cache:', error instanceof Error ? error.message : String(error));
    
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
