/**
 * Loyalty Service - Tests
 *
 * Tests for points earning, redemption, reversal, tier management, and config.
 *
 * @module core/services/__tests__/loyalty.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { LoyaltyService } from '../loyalty.service';

// Mock dependencies
vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

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

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const CUSTOMER_ID = '22222222-2222-2222-2222-222222222222';
const INVOICE_ID = '33333333-3333-3333-3333-333333333333';

function createMockPrisma() {
  return {
    tenant_settings: {
      findUnique: vi.fn().mockResolvedValue({
        loyalty_enabled: true,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: JSON.stringify([
          { name: 'BRONCE', minPoints: 0, multiplier: 1.0 },
          { name: 'PLATA', minPoints: 500, multiplier: 1.2 },
          { name: 'ORO', minPoints: 2000, multiplier: 1.5 },
          { name: 'PLATINO', minPoints: 5000, multiplier: 2.0 },
        ]),
        loyalty_min_redemption_points: 100,
      }),
      update: vi.fn(),
    },
    customer_profile: {
      findUnique: vi.fn().mockResolvedValue({
        loyalty_points_balance: 200,
        loyalty_lifetime_points: 500,
        loyalty_tier: 'PLATA',
      }),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    loyalty_ledger: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([
      { loyalty_points_balance: 500, loyalty_tier: 'PLATA' },
    ]),
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

describe('LoyaltyService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: LoyaltyService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new LoyaltyService(prisma);
  });

  // --------------------------------------------------------------------------
  // getLoyaltyConfig
  // --------------------------------------------------------------------------

  describe('getLoyaltyConfig', () => {
    it('returns config from tenant_settings', async () => {
      const config = await service.getLoyaltyConfig(TENANT_ID);
      expect(config.enabled).toBe(true);
      expect(config.points_per_sol).toBe(1);
      expect(config.tiers).toHaveLength(4);
      expect(config.tiers[0].name).toBe('BRONCE');
    });

    it('returns defaults when tenant_settings is null', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue(null);
      const config = await service.getLoyaltyConfig(TENANT_ID);
      expect(config.enabled).toBe(false);
      expect(config.tiers).toHaveLength(4);
    });
  });

  // --------------------------------------------------------------------------
  // earnPoints
  // --------------------------------------------------------------------------

  describe('earnPoints', () => {
    it('calculates correct points with tier multiplier', async () => {
      const result = await service.earnPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalCents: 5000, // S/50.00
        invoiceId: INVOICE_ID,
        actorId: 'actor-1',
      });

      expect(result).not.toBeNull();
      expect(result!.pointsEarned).toBe(60); // 50 * 1 * 1.2 (PLATA multiplier)
      expect(result!.multiplier).toBe(1.2);
      expect(result!.newBalance).toBe(260); // 200 + 60
      expect(prisma.loyalty_ledger.create).toHaveBeenCalledOnce();
      expect(prisma.customer_profile.upsert).toHaveBeenCalledOnce();
    });

    it('returns null when loyalty is disabled', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        loyalty_enabled: false,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: null,
        loyalty_min_redemption_points: 100,
      });
      // Recreate service to avoid cache
      const svc = new LoyaltyService(prisma);

      const result = await svc.earnPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalCents: 5000,
        invoiceId: INVOICE_ID,
      });

      expect(result).toBeNull();
      expect(prisma.loyalty_ledger.create).not.toHaveBeenCalled();
    });

    it('returns null for very small amounts (< S/1.00)', async () => {
      const result = await service.earnPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalCents: 50, // S/0.50
        invoiceId: INVOICE_ID,
      });

      expect(result).toBeNull();
    });

    it('upgrades tier when lifetime crosses threshold', async () => {
      // Customer at 1900 lifetime, earns enough to cross 2000 → ORO
      prisma.customer_profile.findUnique.mockResolvedValue({
        loyalty_points_balance: 1900,
        loyalty_lifetime_points: 1900,
        loyalty_tier: 'PLATA',
      });

      const result = await service.earnPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalCents: 10000, // S/100 → 100 * 1.2 = 120 pts → lifetime = 2020
        invoiceId: INVOICE_ID,
      });

      expect(result!.tier).toBe('ORO');
    });

    it('creates profile on first earn', async () => {
      prisma.customer_profile.findUnique.mockResolvedValue(null);

      const result = await service.earnPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        totalCents: 2000,
        invoiceId: INVOICE_ID,
      });

      expect(result!.pointsEarned).toBe(20); // 20 * 1.0 (BRONCE) = 20
      expect(result!.tier).toBe('BRONCE');
      expect(prisma.customer_profile.upsert).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // redeemPoints
  // --------------------------------------------------------------------------

  describe('redeemPoints', () => {
    it('redeems points and calculates discount', async () => {
      const result = await service.redeemPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        points: 200,
        orderId: 'order-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.discountCents).toBe(200); // 200 / 100 * 100
        expect(result.data.newBalance).toBe(300); // 500 - 200
      }
    });

    it('rejects when below minimum redemption', async () => {
      const result = await service.redeemPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        points: 50, // min is 100
      });

      expect(result.success).toBe(false);
    });

    it('rejects when insufficient balance', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { loyalty_points_balance: 100, loyalty_tier: 'BRONCE' },
      ]);

      const result = await service.redeemPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        points: 200,
      });

      expect(result.success).toBe(false);
    });

    it('rejects when loyalty is disabled', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        loyalty_enabled: false,
        loyalty_points_per_sol: 1,
        loyalty_redemption_rate: 100,
        loyalty_tiers: null,
        loyalty_min_redemption_points: 100,
      });
      const svc = new LoyaltyService(prisma);

      const result = await svc.redeemPoints(prisma, {
        tenantId: TENANT_ID,
        customerId: CUSTOMER_ID,
        points: 200,
      });

      expect(result.success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // reverseEarnedPoints
  // --------------------------------------------------------------------------

  describe('reverseEarnedPoints', () => {
    it('reverses points for voided invoice', async () => {
      prisma.loyalty_ledger.findMany.mockResolvedValue([
        {
          id: 'ledger-1',
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          type: 'EARN',
          points: 50,
          balance_after: 250,
        },
      ]);

      await service.reverseEarnedPoints(prisma, TENANT_ID, INVOICE_ID);

      expect(prisma.loyalty_ledger.create).toHaveBeenCalledOnce();
      const createCall = prisma.loyalty_ledger.create.mock.calls[0][0].data;
      expect(createCall.type).toBe('VOID_REVERSAL');
      expect(createCall.points).toBe(-50);
      expect(prisma.customer_profile.update).toHaveBeenCalledOnce();
    });

    it('does nothing when no EARN entry exists', async () => {
      prisma.loyalty_ledger.findMany.mockResolvedValue([]);

      await service.reverseEarnedPoints(prisma, TENANT_ID, INVOICE_ID);

      expect(prisma.loyalty_ledger.create).not.toHaveBeenCalled();
      expect(prisma.customer_profile.update).not.toHaveBeenCalled();
    });

    it('ensures balance never goes negative', async () => {
      prisma.loyalty_ledger.findMany.mockResolvedValue([
        {
          id: 'ledger-1',
          tenant_id: TENANT_ID,
          customer_id: CUSTOMER_ID,
          type: 'EARN',
          points: 500,
          balance_after: 500,
        },
      ]);
      // Current balance is only 200
      prisma.customer_profile.findUnique.mockResolvedValue({
        loyalty_points_balance: 200,
        loyalty_lifetime_points: 500,
      });

      await service.reverseEarnedPoints(prisma, TENANT_ID, INVOICE_ID);

      const updateCall = prisma.customer_profile.update.mock.calls[0][0].data;
      expect(updateCall.loyalty_points_balance).toBe(0); // max(0, 200-500) = 0
    });
  });

  // --------------------------------------------------------------------------
  // getBalance
  // --------------------------------------------------------------------------

  describe('getBalance', () => {
    it('returns balance, tier, and next tier info', async () => {
      const result = await service.getBalance(TENANT_ID, CUSTOMER_ID);

      expect(result.balance).toBe(200);
      expect(result.tier).toBe('PLATA');
      expect(result.lifetimePoints).toBe(500);
      expect(result.nextTier).toEqual({
        name: 'ORO',
        minPoints: 2000,
        pointsNeeded: 1500,
      });
    });

    it('returns null nextTier for highest tier', async () => {
      prisma.customer_profile.findUnique.mockResolvedValue({
        loyalty_points_balance: 10000,
        loyalty_lifetime_points: 10000,
        loyalty_tier: 'PLATINO',
      });

      const result = await service.getBalance(TENANT_ID, CUSTOMER_ID);
      expect(result.nextTier).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Property-based tests
  // --------------------------------------------------------------------------

  describe('property tests', () => {
    it('earned points are always non-negative', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 1_000_000 }),
          async (totalCents) => {
            const freshPrisma = createMockPrisma();
            const svc = new LoyaltyService(freshPrisma);
            const result = await svc.earnPoints(freshPrisma, {
              tenantId: TENANT_ID,
              customerId: CUSTOMER_ID,
              totalCents,
              invoiceId: INVOICE_ID,
            });
            if (result !== null) {
              expect(result.pointsEarned).toBeGreaterThanOrEqual(0);
              expect(result.newBalance).toBeGreaterThanOrEqual(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('balance after earn is always >= previous balance', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 1_000_000 }),
          fc.integer({ min: 0, max: 50000 }),
          async (totalCents, currentBalance) => {
            const freshPrisma = createMockPrisma();
            freshPrisma.customer_profile.findUnique.mockResolvedValue({
              loyalty_points_balance: currentBalance,
              loyalty_lifetime_points: currentBalance,
              loyalty_tier: 'BRONCE',
            });
            const svc = new LoyaltyService(freshPrisma);
            const result = await svc.earnPoints(freshPrisma, {
              tenantId: TENANT_ID,
              customerId: CUSTOMER_ID,
              totalCents,
              invoiceId: INVOICE_ID,
            });
            if (result !== null) {
              expect(result.newBalance).toBeGreaterThanOrEqual(currentBalance);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('redemption discount is proportional to points', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 10000 }),
          async (points) => {
            const freshPrisma = createMockPrisma();
            freshPrisma.$queryRawUnsafe.mockResolvedValue([
              { loyalty_points_balance: points + 1000, loyalty_tier: 'BRONCE' },
            ]);
            const svc = new LoyaltyService(freshPrisma);
            const result = await svc.redeemPoints(freshPrisma, {
              tenantId: TENANT_ID,
              customerId: CUSTOMER_ID,
              points,
            });
            if (result.success) {
              // 100 points = S/1.00 = 100 cents
              const expectedCents = Math.floor(points / 100) * 100;
              expect(result.data.discountCents).toBe(expectedCents);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
