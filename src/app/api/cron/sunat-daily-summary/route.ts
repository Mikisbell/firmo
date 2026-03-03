/**
 * Cron SUNAT Daily Summary Endpoint
 *
 * Processes daily summaries (Resumen Diario) of boletas for all active tenants.
 * Protected by CRON_SECRET header (Vercel Cron Jobs set this automatically).
 *
 * Schedule: Daily at 11:00 UTC (6:00 AM Lima time)
 * Configured in vercel.json: "0 11 * * *"
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { SunatDailySummaryService } from '@/src/core/jobs/sunat-daily-summary';
import { InvoiceProviderRouter } from '@/src/core/integrations/sunat/provider-router';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('cron-sunat-daily-summary');

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    log.info('SUNAT daily summary processing iniciado');

    const providerRouter = new InvoiceProviderRouter();
    const service = new SunatDailySummaryService(prisma as any, providerRouter);
    const results = await service.processAllTenants();

    const duration_ms = Date.now() - startTime;
    const sent = results.filter((r) => r.status === 'SENT').length;
    const skipped = results.filter((r) => r.status === 'SKIPPED').length;
    const errors = results.filter((r) => r.status === 'ERROR').length;

    log.info('SUNAT daily summary processing completado', {
      total: results.length,
      sent,
      skipped,
      errors,
      duration_ms,
    });

    return NextResponse.json({
      success: true,
      total: results.length,
      sent,
      skipped,
      errors,
      duration_ms,
      results,
    });
  } catch (error) {
    const duration_ms = Date.now() - startTime;
    log.error(
      'SUNAT daily summary processing fallo',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        error: 'SUNAT daily summary processing failed',
        message: error instanceof Error ? error.message : String(error),
        duration_ms,
      },
      { status: 500 },
    );
  }
}
