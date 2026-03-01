/**
 * Cleanup API - POST
 * 
 * Ejecuta limpieza de processed_events antiguos.
 * Solo accesible por ADMIN/MANAGER.
 * 
 * Requisitos: 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupProcessedEvents } from '@/src/core/workers/cleanup-processed-events';
import { logger } from '@/src/core/observability/logger';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(request: NextRequest) {
  try {
    // Validar autenticación admin (JWT obligatorio)
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Obtener días de retención del body (opcional)
    let retentionDays = 30;
    try {
      const body = await request.json();
      if (body.retentionDays && typeof body.retentionDays === 'number') {
        retentionDays = Math.max(1, Math.min(365, body.retentionDays));
      }
    } catch {
      // Body vacío o inválido, usar default
    }

    const deletedCount = await cleanupProcessedEvents(retentionDays);

    logger.info('api.cleanup.success', `Cleanup completed via API`, {
      deleted_count: deletedCount,
      retention_days: retentionDays,
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays,
      message: `Deleted ${deletedCount} processed events older than ${retentionDays} days`,
    });
  } catch (error) {
    logger.error('api.cleanup.error', 'Cleanup API failed', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
