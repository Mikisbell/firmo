/**
 * Segment Service - Tests
 *
 * Tests for segment CRUD, evaluation, and filter building.
 *
 * @module core/services/__tests__/segment.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { SegmentService } from '../segment.service';

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function createMockPrisma() {
  return {
    marketing_segments: {
      create: vi.fn().mockResolvedValue({ id: 'seg-1', tenant_id: TENANT_ID, name: 'Test', definition: {}, is_active: true }),
      findFirst: vi.fn().mockResolvedValue({ id: 'seg-1', tenant_id: TENANT_ID, name: 'Test', definition: { type: 'CUSTOM', filters: [{ field: 'rfm_segment', operator: 'eq', value: 'VIP' }], logic: 'AND' }, is_active: true }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    segment_members: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    customer_profile: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  } as any;
}

describe('SegmentService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: SegmentService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SegmentService(prisma);
  });

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  describe('create', () => {
    it('creates a segment', async () => {
      const result = await service.create(TENANT_ID, {
        name: 'VIP Segment',
        definition: { type: 'CUSTOM', filters: [{ field: 'rfm_segment', operator: 'eq', value: 'VIP' }], logic: 'AND' },
      });
      expect(result.success).toBe(true);
      expect(prisma.marketing_segments.create).toHaveBeenCalledOnce();
    });
  });

  describe('getById', () => {
    it('returns segment when found', async () => {
      const result = await service.getById(TENANT_ID, 'seg-1');
      expect(result.success).toBe(true);
    });

    it('returns error when not found', async () => {
      prisma.marketing_segments.findFirst.mockResolvedValue(null);
      const result = await service.getById(TENANT_ID, 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('delete', () => {
    it('deletes segment and members', async () => {
      const result = await service.delete(TENANT_ID, 'seg-1');
      expect(result.success).toBe(true);
      expect(prisma.segment_members.deleteMany).toHaveBeenCalledOnce();
      expect(prisma.marketing_segments.delete).toHaveBeenCalledOnce();
    });

    it('returns error when not found', async () => {
      prisma.marketing_segments.findFirst.mockResolvedValue(null);
      const result = await service.delete(TENANT_ID, 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Evaluation
  // --------------------------------------------------------------------------

  describe('evaluateSegment', () => {
    it('evaluates segment and returns count', async () => {
      prisma.customer_profile.count.mockResolvedValue(5);
      prisma.customer_profile.findMany.mockResolvedValue([
        { customer_id: 'c1', loyalty_tier: 'ORO', rfm_segment: 'VIP', loyalty_points_balance: 1000, customers: { id: 'c1', name: 'Juan', phone: '+51999' } },
      ]);

      const result = await service.evaluateSegment(TENANT_ID, 'seg-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.count).toBe(5);
        expect(result.data.customers).toHaveLength(1);
        expect(result.data.customers[0].name).toBe('Juan');
      }
    });

    it('returns error for nonexistent segment', async () => {
      prisma.marketing_segments.findFirst.mockResolvedValue(null);
      const result = await service.evaluateSegment(TENANT_ID, 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Property tests
  // --------------------------------------------------------------------------

  describe('property tests', () => {
    const FIELDS = ['rfm_segment', 'loyalty_tier', 'monetary_30d', 'frequency_30d', 'recency_days', 'orders_count', 'lifetime_value_cents'] as const;
    const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;

    it('evaluateDefinition never throws with valid filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            field: fc.constantFrom(...FIELDS),
            operator: fc.constantFrom(...OPS),
            value: fc.oneof(fc.string(), fc.integer({ min: 0, max: 100000 })),
          }),
          async (filter) => {
            const freshPrisma = createMockPrisma();
            const svc = new SegmentService(freshPrisma);
            const result = await svc.evaluateDefinition(TENANT_ID, {
              type: 'CUSTOM',
              filters: [filter as any],
              logic: 'AND',
            });
            expect(result.success).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
