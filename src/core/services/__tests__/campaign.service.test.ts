/**
 * Campaign Service - Tests
 *
 * Tests for campaign CRUD, launch, and stats.
 *
 * @module core/services/__tests__/campaign.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignService } from '../campaign.service';
import { SegmentService } from '../segment.service';
import { TemplateService } from '../template.service';

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

vi.mock('@/src/core/cache/redis.service', () => {
  class MockCacheService {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    del = vi.fn().mockResolvedValue(undefined);
  }
  return {
    CacheService: MockCacheService,
    generateCacheKey: (...args: string[]) => args.join(':'),
  };
});

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function createMockPrisma() {
  return {
    marketing_campaigns: {
      create: vi.fn().mockResolvedValue({
        id: 'camp-1', tenant_id: TENANT_ID, name: 'Test Campaign',
        channel: 'WHATSAPP', status: 'DRAFT', segment_id: 'seg-1',
        message_template_id: 'tpl-1',
      }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'camp-1', tenant_id: TENANT_ID, name: 'Test Campaign',
        channel: 'WHATSAPP', status: 'DRAFT', segment_id: 'seg-1',
        message_template_id: 'tpl-1',
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    marketing_segments: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'seg-1', tenant_id: TENANT_ID, name: 'VIP',
        definition: { type: 'CUSTOM', filters: [{ field: 'rfm_segment', operator: 'eq', value: 'VIP' }], logic: 'AND' },
      }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    segment_members: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    message_templates: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'tpl-1', tenant_id: TENANT_ID, name: 'Promo',
        channel: 'WHATSAPP', content: 'Hola {{nombre}}, tienes {{puntos}} pts',
        variables_schema: { nombre: 'string', puntos: 'string' },
      }),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    message_outbox: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    customer_profile: {
      findMany: vi.fn().mockResolvedValue([
        {
          customer_id: 'c1', loyalty_points_balance: 500, loyalty_tier: 'ORO', rfm_segment: 'VIP',
          customers: { id: 'c1', name: 'Juan', phone: '+51999888777' },
        },
        {
          customer_id: 'c2', loyalty_points_balance: 100, loyalty_tier: 'BRONCE', rfm_segment: 'FRECUENTE',
          customers: { id: 'c2', name: null, phone: '+51999888666' },
        },
      ]),
      count: vi.fn().mockResolvedValue(2),
    },
  } as any;
}

describe('CampaignService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: CampaignService;

  beforeEach(() => {
    prisma = createMockPrisma();
    const segService = new SegmentService(prisma);
    const tplService = new TemplateService(prisma);
    service = new CampaignService(prisma, segService, tplService);
  });

  // --------------------------------------------------------------------------
  // Create
  // --------------------------------------------------------------------------

  describe('create', () => {
    it('creates a campaign in DRAFT status', async () => {
      const result = await service.create(TENANT_ID, {
        name: 'Promo VIP',
        segment_id: 'seg-1',
        template_id: 'tpl-1',
        channel: 'WHATSAPP',
      });
      expect(result.success).toBe(true);
      expect(prisma.marketing_campaigns.create).toHaveBeenCalledOnce();
    });

    it('fails when segment not found', async () => {
      prisma.marketing_segments.findFirst.mockResolvedValue(null);
      const result = await service.create(TENANT_ID, {
        name: 'Bad',
        segment_id: 'nonexistent',
        template_id: 'tpl-1',
        channel: 'WHATSAPP',
      });
      expect(result.success).toBe(false);
    });

    it('fails when template not found', async () => {
      prisma.message_templates.findFirst.mockResolvedValue(null);
      const result = await service.create(TENANT_ID, {
        name: 'Bad',
        segment_id: 'seg-1',
        template_id: 'nonexistent',
        channel: 'WHATSAPP',
      });
      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Launch
  // --------------------------------------------------------------------------

  describe('launch', () => {
    it('creates outbox rows for matching customers', async () => {
      const result = await service.launch(TENANT_ID, 'camp-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messagesQueued).toBe(2);
      }
      expect(prisma.message_outbox.createMany).toHaveBeenCalledOnce();
      expect(prisma.marketing_campaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'ACTIVE' } }),
      );
    });

    it('interpolates variables correctly', async () => {
      await service.launch(TENANT_ID, 'camp-1');
      const createCall = prisma.message_outbox.createMany.mock.calls[0][0];
      const firstMsg = createCall.data[0];
      expect(firstMsg.payload.body).toBe('Hola Juan, tienes 500 pts');
    });

    it('uses "Cliente" fallback for null name', async () => {
      await service.launch(TENANT_ID, 'camp-1');
      const createCall = prisma.message_outbox.createMany.mock.calls[0][0];
      const secondMsg = createCall.data[1];
      expect(secondMsg.payload.body).toBe('Hola Cliente, tienes 100 pts');
    });

    it('returns 0 when segment has no customers', async () => {
      prisma.customer_profile.findMany.mockResolvedValue([]);
      prisma.customer_profile.count.mockResolvedValue(0);

      const result = await service.launch(TENANT_ID, 'camp-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.messagesQueued).toBe(0);
      }
    });

    it('cannot launch ACTIVE campaign', async () => {
      prisma.marketing_campaigns.findFirst.mockResolvedValue({
        id: 'camp-1', status: 'ACTIVE', segment_id: 'seg-1', message_template_id: 'tpl-1',
      });

      const result = await service.launch(TENANT_ID, 'camp-1');
      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Cancel
  // --------------------------------------------------------------------------

  describe('cancel', () => {
    it('cancels campaign and pending outbox messages', async () => {
      prisma.marketing_campaigns.findFirst.mockResolvedValue({
        id: 'camp-1', status: 'ACTIVE',
      });

      const result = await service.cancel(TENANT_ID, 'camp-1');
      expect(result.success).toBe(true);
      expect(prisma.marketing_campaigns.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } }),
      );
      expect(prisma.message_outbox.updateMany).toHaveBeenCalledOnce();
    });

    it('cannot cancel completed campaign', async () => {
      prisma.marketing_campaigns.findFirst.mockResolvedValue({
        id: 'camp-1', status: 'COMPLETED',
      });

      const result = await service.cancel(TENANT_ID, 'camp-1');
      expect(result.success).toBe(false);
    });
  });
});
