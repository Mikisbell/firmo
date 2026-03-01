/**
 * Cron Maintenance Endpoint
 *
 * Runs weekly maintenance tasks:
 * 1. Archive old events (per tenant, 180-day retention)
 * 2. Cleanup processed_events (30-day retention)
 *
 * Protected by CRON_SECRET header (Vercel Cron Jobs set this automatically).
 *
 * Schedule: Every Sunday at 3:00 AM UTC (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { archiveEvents } from '@/src/core/workers/archive-events';
import { cleanupProcessedEvents } from '@/src/core/workers/cleanup-processed-events';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('cron-maintenance');

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    log.info('Cron maintenance iniciado');

    // 1. Get all active tenants
    const tenants = await prisma.tenants.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
    });

    // 2. Archive old events for each tenant
    const archiveResults = [];
    for (const tenant of tenants) {
      try {
        const result = await archiveEvents({
          tenantId: tenant.id,
          retentionDays: 180,
          maxBatches: 50,
        });
        archiveResults.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          archived: result.archived,
          batches: result.batches,
        });
      } catch (error) {
        log.error('Error archivando eventos para tenant', error instanceof Error ? error : new Error(String(error)), {
          tenant_id: tenant.id,
        });
        archiveResults.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          archived: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 3. Cleanup processed_events (global, not per-tenant)
    const cleanedUp = await cleanupProcessedEvents(30);

    const duration = Date.now() - startTime;

    const totalArchived = archiveResults.reduce((sum, r) => sum + r.archived, 0);

    log.info('Cron maintenance completado', {
      tenants_processed: tenants.length,
      total_archived: totalArchived,
      processed_events_cleaned: cleanedUp,
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      archival: {
        tenants_processed: tenants.length,
        total_archived: totalArchived,
        details: archiveResults,
      },
      cleanup: {
        processed_events_deleted: cleanedUp,
      },
    });
  } catch (error) {
    log.error('Cron maintenance falló', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Maintenance job failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
