/**
 * Archive Events API
 *
 * POST — Archive old events to archived_events table
 * GET  — Get event storage stats for current tenant
 *
 * Only accessible by OWNER/ADMIN roles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { archiveEvents, getEventStorageStats } from '@/src/core/workers/archive-events';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('api-archive-events');

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;

    // Only OWNER and ADMIN can archive events
    if (!['OWNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Solo OWNER o ADMIN pueden archivar eventos' },
        { status: 403 }
      );
    }

    let retentionDays = 180;
    let dryRun = false;
    try {
      const body = await request.json();
      if (body.retentionDays && typeof body.retentionDays === 'number') {
        retentionDays = Math.max(30, Math.min(730, body.retentionDays)); // 30d to 2y
      }
      if (typeof body.dryRun === 'boolean') {
        dryRun = body.dryRun;
      }
    } catch {
      // Use defaults
    }

    const result = await archiveEvents({
      tenantId: user.tenantId,
      retentionDays,
      dryRun,
    });

    log.info('Archival ejecutado via API', {
      tenant_id: user.tenantId,
      actor_id: user.id,
      archived: result.archived,
      dry_run: dryRun,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('Error en archival API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al archivar eventos' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const stats = await getEventStorageStats(authResult.user.tenantId);

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    log.error('Error en storage stats API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de almacenamiento' },
      { status: 500 }
    );
  }
}
