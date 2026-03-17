/**
 * Message Outbox Worker - Processes queued messages from message_outbox
 *
 * Sends WhatsApp/SMS messages via MessagingService with:
 * - FOR UPDATE SKIP LOCKED batch processing
 * - Rate limiting (1 msg/sec for WhatsApp)
 * - Retry logic (max 3 attempts)
 * - Safety timeout (50s for Vercel function limit)
 *
 * @module core/jobs/message-outbox-worker
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { MessagingService, SendOutcome } from '@/src/core/services/messaging.service';

const logger = pinoLogger.child({ service: 'message-outbox-worker' });

const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 1000; // 1 msg/sec for WhatsApp
const SAFETY_TIMEOUT_MS = 50_000; // 50s (Vercel limit is 60s)

// ============================================================================
// Types
// ============================================================================

interface OutboxItem {
  id: string;
  tenant_id: string;
  channel: string;
  to_phone: string;
  payload: { body: string };
  attempts: number;
  campaign_id: string | null;
}

export interface OutboxWorkerResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}

// ============================================================================
// Worker
// ============================================================================

export class MessageOutboxWorker {
  private prisma: PrismaClient;
  private messaging: MessagingService;

  constructor(prismaClient?: PrismaClient, messagingService?: MessagingService) {
    this.prisma = (prismaClient || prisma) as PrismaClient;
    this.messaging = messagingService || new MessagingService();
  }

  async processBatch(batchSize: number = 20): Promise<OutboxWorkerResult> {
    const start = Date.now();
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Fetch pending items with FOR UPDATE SKIP LOCKED
    const items: OutboxItem[] = await (this.prisma as any).$queryRawUnsafe(
      `SELECT id, tenant_id, channel, to_phone, payload, attempts, campaign_id
       FROM message_outbox
       WHERE status = 'QUEUED'
         AND (scheduled_at IS NULL OR scheduled_at <= NOW())
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      batchSize,
    );

    if (items.length === 0) {
      return { processed: 0, sent: 0, failed: 0, skipped: 0, duration_ms: Date.now() - start };
    }

    logger.info({ count: items.length }, 'Processing outbox batch');

    for (const item of items) {
      // Safety timeout check
      if (Date.now() - start > SAFETY_TIMEOUT_MS) {
        logger.warn('Safety timeout reached, stopping batch');
        skipped += items.length - processed;
        break;
      }

      processed++;

      try {
        // Mark as SENDING
        await (this.prisma as any).message_outbox.update({
          where: { id: item.id },
          data: { status: 'SENDING' },
        });

        // Send via appropriate channel
        let outcome: SendOutcome;

        if (item.channel === 'WHATSAPP') {
          outcome = await this.messaging.sendWhatsApp(item.to_phone, item.payload.body);
        } else if (item.channel === 'SMS') {
          outcome = await this.messaging.sendSms(item.to_phone, item.payload.body);
        } else {
          outcome = { success: false, error: `Unsupported channel: ${item.channel}` };
        }

        if (outcome.success) {
          await (this.prisma as any).message_outbox.update({
            where: { id: item.id },
            data: {
              status: 'SENT',
              sent_at: new Date(),
              provider_message_id: outcome.providerId,
              attempts: item.attempts + 1,
            },
          });
          sent++;
        } else {
          const newAttempts = item.attempts + 1;
          const isFinal = newAttempts >= MAX_RETRIES;

          await (this.prisma as any).message_outbox.update({
            where: { id: item.id },
            data: {
              status: isFinal ? 'FAILED' : 'QUEUED',
              last_error: outcome.error,
              attempts: newAttempts,
            },
          });

          if (isFinal) {
            failed++;
            logger.warn({ itemId: item.id, error: outcome.error }, 'Message permanently failed');
          }
        }

        // Rate limit between sends
        if (item.channel === 'WHATSAPP') {
          await sleep(RATE_LIMIT_MS);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ itemId: item.id, error: msg }, 'Outbox item processing error');

        await (this.prisma as any).message_outbox.update({
          where: { id: item.id },
          data: {
            status: item.attempts + 1 >= MAX_RETRIES ? 'FAILED' : 'QUEUED',
            last_error: msg,
            attempts: item.attempts + 1,
          },
        }).catch(() => { /* best effort */ });

        failed++;
      }
    }

    // Check if campaign is complete (all messages sent/failed)
    const campaignIds = [...new Set(items.filter((i: OutboxItem) => i.campaign_id).map((i: OutboxItem) => i.campaign_id as string))];
    for (const campaignId of campaignIds) {
      await this.checkCampaignCompletion(campaignId);
    }

    const result: OutboxWorkerResult = {
      processed,
      sent,
      failed,
      skipped,
      duration_ms: Date.now() - start,
    };

    logger.info(result, 'Outbox batch completed');
    return result;
  }

  /**
   * If all messages for a campaign are sent/failed, mark campaign as COMPLETED
   */
  private async checkCampaignCompletion(campaignId: string): Promise<void> {
    const pending = await (this.prisma as any).message_outbox.count({
      where: {
        campaign_id: campaignId,
        status: { in: ['QUEUED', 'SENDING'] },
      },
    });

    if (pending === 0) {
      await (this.prisma as any).marketing_campaigns.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED' },
      }).catch(() => { /* campaign may not exist */ });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
