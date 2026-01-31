/**
 * Cleanup API - POST
 * 
 * Ejecuta limpieza de processed_events antiguos.
 * Solo accesible por ADMIN/MANAGER.
 * 
 * Requirements: 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupProcessedEvents } from '@/src/core/workers/cleanup-processed-events';
import { logger } from '@/src/core/observability/logger';

export async function POST(request: NextRequest) {
  try {
    // Verificar autorización básica (en producción usar JWT)
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
