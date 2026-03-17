/**
 * Cron Message Outbox Endpoint
 *
 * Processes queued messages every minute.
 * Schedule: Every 1 minute (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { MessageOutboxWorker } from '@/src/core/jobs/message-outbox-worker';
import { MessagingService } from '@/src/core/services/messaging.service';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const logger = pinoLogger.child({ service: 'cron-message-outbox' });

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info('Message outbox worker iniciado');

    const messaging = new MessagingService();
    const worker = new MessageOutboxWorker(prisma as any, messaging);
    const result = await worker.processBatch(20);

    logger.info(result, 'Message outbox worker completado');

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error({ error }, 'Message outbox worker fallo');
    return NextResponse.json(
      {
        error: 'Message outbox worker failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
