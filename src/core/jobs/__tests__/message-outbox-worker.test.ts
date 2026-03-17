/**
 * Message Outbox Worker - Tests
 *
 * Tests for batch processing, retry logic, and rate limiting.
 *
 * @module core/jobs/__tests__/message-outbox-worker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageOutboxWorker } from '../message-outbox-worker';

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

function createMockPrisma() {
  return {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    message_outbox: {
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    marketing_campaigns: {
      update: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

function createMockMessaging() {
  return {
    sendWhatsApp: vi.fn().mockResolvedValue({ success: true, providerId: 'twilio-sid-123' }),
    sendSms: vi.fn().mockResolvedValue({ success: false, error: 'SMS not implemented' }),
  } as any;
}

describe('MessageOutboxWorker', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let messaging: ReturnType<typeof createMockMessaging>;
  let worker: MessageOutboxWorker;

  beforeEach(() => {
    prisma = createMockPrisma();
    messaging = createMockMessaging();
    worker = new MessageOutboxWorker(prisma, messaging);
  });

  it('returns 0 when no pending messages', async () => {
    const result = await worker.processBatch(10);
    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('processes and sends WhatsApp messages', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'msg-1', tenant_id: 't1', channel: 'WHATSAPP', to_phone: '+51999', payload: { body: 'Test' }, attempts: 0, campaign_id: null },
    ]);

    const result = await worker.processBatch(10);
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(messaging.sendWhatsApp).toHaveBeenCalledWith('+51999', 'Test');
    expect(prisma.message_outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT', provider_message_id: 'twilio-sid-123' }),
      }),
    );
  });

  it('retries on failure (below max retries)', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'msg-1', tenant_id: 't1', channel: 'WHATSAPP', to_phone: '+51999', payload: { body: 'Test' }, attempts: 0, campaign_id: null },
    ]);
    messaging.sendWhatsApp.mockResolvedValue({ success: false, error: 'Twilio error' });

    const result = await worker.processBatch(10);
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(0);
    // Not final failure yet (attempts 0 + 1 = 1 < 3)
    expect(prisma.message_outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUEUED', last_error: 'Twilio error', attempts: 1 }),
      }),
    );
  });

  it('marks as FAILED after max retries', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'msg-1', tenant_id: 't1', channel: 'WHATSAPP', to_phone: '+51999', payload: { body: 'Test' }, attempts: 2, campaign_id: null },
    ]);
    messaging.sendWhatsApp.mockResolvedValue({ success: false, error: 'Final error' });

    const result = await worker.processBatch(10);
    expect(result.failed).toBe(1);
    expect(prisma.message_outbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attempts: 3 }),
      }),
    );
  });

  it('checks campaign completion after batch', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'msg-1', tenant_id: 't1', channel: 'WHATSAPP', to_phone: '+51999', payload: { body: 'Test' }, attempts: 0, campaign_id: 'camp-1' },
    ]);
    // No pending messages left for campaign
    prisma.message_outbox.count.mockResolvedValue(0);

    await worker.processBatch(10);

    expect(prisma.marketing_campaigns.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'camp-1' },
        data: { status: 'COMPLETED' },
      }),
    );
  });

  it('handles unsupported channel', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'msg-1', tenant_id: 't1', channel: 'EMAIL', to_phone: 'a@b.com', payload: { body: 'Test' }, attempts: 2, campaign_id: null },
    ]);

    const result = await worker.processBatch(10);
    expect(result.failed).toBe(1);
  });
});
