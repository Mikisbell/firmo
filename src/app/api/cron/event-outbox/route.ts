/**
 * Cron Event Outbox Endpoint
 *
 * Retries publication of event_outbox rows whose inline publish failed
 * during ingest (published=false). Without this cron, processOutbox has
 * no invoker outside tests and failed publications are never retried.
 *
 * processOutbox is idempotent: it only reads rows with published=false
 * and attempts < MAX_ATTEMPTS (5), marking published=true on success and
 * incrementing attempts on failure (poison pills are skipped after 5 tries).
 *
 * Protected by CRON_SECRET header (Vercel Cron Jobs set this automatically).
 * Schedule: configured in vercel.json (daily on Hobby plan; on Pro this
 * can be tightened to every 2 minutes like sunat-queue originally was).
 */

import { NextRequest, NextResponse } from 'next/server';
import { processOutbox, getOutboxStats, cleanupPublishedEvents } from '@/src/core/workers/outbox-publisher';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('cron-event-outbox');

// Drain up to MAX_BATCHES * BATCH_SIZE(100) events per invocation.
// The loop stops early when a batch publishes 0 events (nothing pending
// or every pending row failed and had its attempts counter incremented).
const MAX_BATCHES = 10;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    log.info('Event outbox worker iniciado');

    let published = 0;
    let batches = 0;

    for (let i = 0; i < MAX_BATCHES; i++) {
      const count = await processOutbox();
      batches++;
      published += count;
      if (count === 0) break;
    }

    // Remove already-published rows older than 7 days to keep the table small
    const cleaned = await cleanupPublishedEvents(7);

    const stats = await getOutboxStats();
    if (stats.failed > 0) {
      // Poison pills: rows that exhausted MAX_ATTEMPTS and will no longer be retried
      log.warn('Event outbox tiene eventos envenenados (attempts >= MAX_ATTEMPTS)', {
        failed: stats.failed,
      });
    }

    const duration_ms = Date.now() - startTime;

    log.info('Event outbox worker completado', {
      published,
      batches,
      cleaned,
      pending: stats.pending,
      failed: stats.failed,
      duration_ms,
    });

    return NextResponse.json({
      success: true,
      published,
      batches,
      cleaned,
      pending: stats.pending,
      failed: stats.failed,
      duration_ms,
    });
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    log.error(
      'Event outbox worker fallo',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        error: 'Event outbox worker failed',
        message: error instanceof Error ? error.message : String(error),
        duration_ms,
      },
      { status: 500 },
    );
  }
}
