/**
 * Cron SUNAT Queue Endpoint
 *
 * Processes pending invoice queue items every 2 minutes.
 * Protected by CRON_SECRET header (Vercel Cron Jobs set this automatically).
 *
 * Schedule: Every 2 minutes (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { SunatQueueWorker } from '@/src/core/jobs/sunat-queue-worker';
import { InvoiceProviderRouter } from '@/src/core/integrations/sunat/provider-router';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('cron-sunat-queue');

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    log.info('SUNAT queue worker iniciado');

    const providerRouter = new InvoiceProviderRouter();
    const worker = new SunatQueueWorker(prisma as any, providerRouter);
    const result = await worker.processBatch(10);

    log.info('SUNAT queue worker completado', {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      duration_ms: result.duration_ms,
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      duration_ms: result.duration_ms,
      details: result.details,
    });
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    log.error(
      'SUNAT queue worker fallo',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        error: 'SUNAT queue worker failed',
        message: error instanceof Error ? error.message : String(error),
        duration_ms,
      },
      { status: 500 },
    );
  }
}
