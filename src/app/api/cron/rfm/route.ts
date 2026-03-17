/**
 * Cron RFM Endpoint
 *
 * Computes RFM metrics for all tenants daily.
 * Schedule: Daily at 5:00 UTC (midnight Lima, UTC-5)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { RfmWorker } from '@/src/core/jobs/rfm-worker';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const logger = pinoLogger.child({ service: 'cron-rfm' });

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('RFM worker iniciado');

    const worker = new RfmWorker(prisma as any);
    const result = await worker.computeAll();

    logger.info(result, 'RFM worker completado');

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error({ error }, 'RFM worker fallo');
    return NextResponse.json(
      {
        error: 'RFM worker failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
