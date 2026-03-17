/**
 * Loyalty Service - Points accumulation, redemption, and tier management
 *
 * Manages the loyalty points lifecycle:
 * - Earn points on invoice emission (hooked into InvoiceService)
 * - Redeem points for discounts at POS
 * - Reverse points on invoice void
 * - Tier auto-upgrade based on lifetime points
 * - Config management per tenant
 *
 * @module core/services/loyalty.service
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, ValidationError, NotFoundError } from '@/src/core/result';
import { CacheService, generateCacheKey } from '@/src/core/cache/redis.service';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import {
  LoyaltyConfig,
  LoyaltyTier,
  DEFAULT_TIERS,
  LoyaltyConfigSchema,
} from '@/src/core/admin/schemas/loyalty.schema';

// ============================================================================
// Types
// ============================================================================

export interface EarnPointsInput {
  tenantId: string;
  customerId: string;
  totalCents: number;
  invoiceId: string;
  actorId?: string;
}

export interface EarnPointsResult {
  pointsEarned: number;
  multiplier: number;
  newBalance: number;
  tier: string;
}

export interface RedeemPointsInput {
  tenantId: string;
  customerId: string;
  points: number;
  orderId?: string;
  checkId?: string;
  actorId?: string;
}

export interface RedeemPointsResult {
  discountCents: number;
  newBalance: number;
}

export interface CustomerLoyalty {
  balance: number;
  lifetimePoints: number;
  tier: string;
  nextTier: { name: string; minPoints: number; pointsNeeded: number } | null;
}

export interface LoyaltyLedgerEntry {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  multiplier: number;
  createdAt: Date;
}

type PrismaTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const CACHE_TTL_LOYALTY_CONFIG = 300; // 5 minutes
const logger = pinoLogger.child({ service: 'loyalty' });

// ============================================================================
// Service
// ============================================================================

export class LoyaltyService {
  private prisma: PrismaClient;
  private cache: CacheService;

  constructor(
    prismaClient?: PrismaClient,
    cache?: CacheService
  ) {
    this.prisma = prismaClient || prisma;
    this.cache = cache || new CacheService();
  }

  // --------------------------------------------------------------------------
  // Config
  // --------------------------------------------------------------------------

  async getLoyaltyConfig(tenantId: string): Promise<LoyaltyConfig> {
    const cacheKey = generateCacheKey('loyalty-config', tenantId);
    const cached = await this.cache.get<LoyaltyConfig>(cacheKey);
    if (cached) return cached;

    const settings = await this.prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        loyalty_enabled: true,
        loyalty_points_per_sol: true,
        loyalty_redemption_rate: true,
        loyalty_tiers: true,
        loyalty_min_redemption_points: true,
      },
    });

    const config: LoyaltyConfig = {
      enabled: settings?.loyalty_enabled ?? false,
      points_per_sol: settings?.loyalty_points_per_sol ?? 1,
      redemption_rate: settings?.loyalty_redemption_rate ?? 100,
      tiers: parseTiers(settings?.loyalty_tiers),
      min_redemption_points: settings?.loyalty_min_redemption_points ?? 100,
    };

    await this.cache.set(cacheKey, config, CACHE_TTL_LOYALTY_CONFIG);
    return config;
  }

  async updateLoyaltyConfig(
    tenantId: string,
    updates: Partial<LoyaltyConfig>
  ): Promise<Result<LoyaltyConfig, ValidationError>> {
    // Merge with current config and validate
    const current = await this.getLoyaltyConfig(tenantId);
    const merged = { ...current, ...updates };
    const parsed = LoyaltyConfigSchema.safeParse(merged);
    if (!parsed.success) {
      return err(new ValidationError(parsed.error.errors[0]?.message ?? 'Invalid config'));
    }

    const config = parsed.data;
    await this.prisma.tenant_settings.update({
      where: { tenant_id: tenantId },
      data: {
        loyalty_enabled: config.enabled,
        loyalty_points_per_sol: config.points_per_sol,
        loyalty_redemption_rate: config.redemption_rate,
        loyalty_tiers: JSON.stringify(config.tiers),
        loyalty_min_redemption_points: config.min_redemption_points,
      },
    });

    // Invalidate cache
    const cacheKey = generateCacheKey('loyalty-config', tenantId);
    await this.cache.set(cacheKey, config, CACHE_TTL_LOYALTY_CONFIG);

    return ok(config);
  }

  // --------------------------------------------------------------------------
  // Earn Points (called within InvoiceService transaction)
  // --------------------------------------------------------------------------

  async earnPoints(
    tx: PrismaTx,
    input: EarnPointsInput
  ): Promise<EarnPointsResult | null> {
    const config = await this.getLoyaltyConfig(input.tenantId);
    if (!config.enabled) return null;

    // Calculate base points: floor(totalCents / 100) * points_per_sol
    const soles = Math.floor(input.totalCents / 100);
    if (soles <= 0) return null;

    // Get current profile for tier multiplier
    const profile = await tx.customer_profile.findUnique({
      where: {
        tenant_id_customer_id: {
          tenant_id: input.tenantId,
          customer_id: input.customerId,
        },
      },
      select: {
        loyalty_points_balance: true,
        loyalty_lifetime_points: true,
        loyalty_tier: true,
      },
    });

    const currentTier = profile?.loyalty_tier ?? 'BRONCE';
    const tierDef = findTier(config.tiers, currentTier);
    const multiplier = tierDef?.multiplier ?? 1.0;

    const basePoints = soles * config.points_per_sol;
    const pointsEarned = Math.floor(basePoints * multiplier);
    if (pointsEarned <= 0) return null;

    const oldBalance = profile?.loyalty_points_balance ?? 0;
    const oldLifetime = profile?.loyalty_lifetime_points ?? 0;
    const newBalance = oldBalance + pointsEarned;
    const newLifetime = oldLifetime + pointsEarned;

    // Determine tier based on lifetime points
    const newTier = determineTier(config.tiers, newLifetime);
    const tierChanged = newTier !== currentTier;

    // Insert ledger entry
    await (tx as PrismaTx & { loyalty_ledger: { create: Function } }).loyalty_ledger.create({
      data: {
        id: uuidv4(),
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        type: 'EARN',
        points: pointsEarned,
        balance_after: newBalance,
        reference_type: 'INVOICE',
        reference_id: input.invoiceId,
        description: `+${pointsEarned} pts (${multiplier}x) por compra S/${(input.totalCents / 100).toFixed(2)}`,
        multiplier,
        created_by: input.actorId ?? null,
      },
    });

    // Upsert customer_profile
    await tx.customer_profile.upsert({
      where: {
        tenant_id_customer_id: {
          tenant_id: input.tenantId,
          customer_id: input.customerId,
        },
      },
      update: {
        loyalty_points_balance: newBalance,
        loyalty_lifetime_points: newLifetime,
        loyalty_tier: newTier,
        ...(tierChanged ? { loyalty_tier_updated_at: new Date() } : {}),
      },
      create: {
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        loyalty_points_balance: pointsEarned,
        loyalty_lifetime_points: pointsEarned,
        loyalty_tier: newTier,
        loyalty_tier_updated_at: new Date(),
      },
    });

    logger.info({
      tenantId: input.tenantId,
      customerId: input.customerId,
      pointsEarned,
      multiplier,
      newBalance,
      tier: newTier,
      tierChanged,
    }, 'loyalty_points_earned');

    return { pointsEarned, multiplier, newBalance, tier: newTier };
  }

  // --------------------------------------------------------------------------
  // Redeem Points
  // --------------------------------------------------------------------------

  async redeemPoints(
    tx: PrismaTx,
    input: RedeemPointsInput
  ): Promise<Result<RedeemPointsResult, ValidationError | NotFoundError>> {
    const config = await this.getLoyaltyConfig(input.tenantId);
    if (!config.enabled) {
      return err(new ValidationError('Programa de fidelización no está activo'));
    }

    if (input.points < config.min_redemption_points) {
      return err(new ValidationError(
        `Mínimo ${config.min_redemption_points} puntos para canjear`
      ));
    }

    // Lock the profile row for concurrent safety
    const profiles = await (tx as PrismaTx & { $queryRawUnsafe: Function }).$queryRawUnsafe<
      Array<{ loyalty_points_balance: number; loyalty_tier: string }>
    >(
      `SELECT loyalty_points_balance, loyalty_tier
       FROM customer_profile
       WHERE tenant_id = $1 AND customer_id = $2
       FOR UPDATE`,
      input.tenantId,
      input.customerId,
    );

    if (!profiles || profiles.length === 0) {
      return err(new NotFoundError('Perfil de cliente no encontrado'));
    }

    const profile = profiles[0];
    if (profile.loyalty_points_balance < input.points) {
      return err(new ValidationError(
        `Balance insuficiente: ${profile.loyalty_points_balance} puntos disponibles`
      ));
    }

    // Calculate discount: floor(points / redemption_rate) * 100 cents
    const discountCents = Math.floor(input.points / config.redemption_rate) * 100;
    const newBalance = profile.loyalty_points_balance - input.points;

    // Insert ledger entry
    await (tx as PrismaTx & { loyalty_ledger: { create: Function } }).loyalty_ledger.create({
      data: {
        id: uuidv4(),
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        type: 'REDEEM',
        points: -input.points,
        balance_after: newBalance,
        reference_type: input.orderId ? 'ORDER' : 'MANUAL',
        reference_id: input.orderId ?? null,
        description: `-${input.points} pts canjeados → S/${(discountCents / 100).toFixed(2)} descuento`,
        created_by: input.actorId ?? null,
      },
    });

    // Update profile
    await tx.customer_profile.update({
      where: {
        tenant_id_customer_id: {
          tenant_id: input.tenantId,
          customer_id: input.customerId,
        },
      },
      data: {
        loyalty_points_balance: newBalance,
      },
    });

    logger.info({
      tenantId: input.tenantId,
      customerId: input.customerId,
      pointsRedeemed: input.points,
      discountCents,
      newBalance,
    }, 'loyalty_points_redeemed');

    return ok({ discountCents, newBalance });
  }

  // --------------------------------------------------------------------------
  // Reverse Earned Points (void invoice)
  // --------------------------------------------------------------------------

  async reverseEarnedPoints(
    tx: PrismaTx,
    tenantId: string,
    invoiceId: string
  ): Promise<void> {
    // Find the original EARN entry for this invoice
    const entries = await (tx as PrismaTx & { loyalty_ledger: { findMany: Function } }).loyalty_ledger.findMany({
      where: {
        tenant_id: tenantId,
        reference_type: 'INVOICE',
        reference_id: invoiceId,
        type: 'EARN',
      },
    });

    if (!entries || entries.length === 0) return;

    for (const entry of entries) {
      const pointsToReverse = entry.points;
      const customerId = entry.customer_id;

      // Get current balance
      const profile = await tx.customer_profile.findUnique({
        where: {
          tenant_id_customer_id: {
            tenant_id: tenantId,
            customer_id: customerId,
          },
        },
        select: { loyalty_points_balance: true, loyalty_lifetime_points: true },
      });

      if (!profile) continue;

      const newBalance = Math.max(0, profile.loyalty_points_balance - pointsToReverse);
      const newLifetime = Math.max(0, profile.loyalty_lifetime_points - pointsToReverse);

      // Determine new tier after deduction
      const config = await this.getLoyaltyConfig(tenantId);
      const newTier = determineTier(config.tiers, newLifetime);

      // Insert VOID_REVERSAL ledger entry
      await (tx as PrismaTx & { loyalty_ledger: { create: Function } }).loyalty_ledger.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          customer_id: customerId,
          type: 'VOID_REVERSAL',
          points: -pointsToReverse,
          balance_after: newBalance,
          reference_type: 'INVOICE',
          reference_id: invoiceId,
          description: `Anulación de comprobante: -${pointsToReverse} pts`,
          created_by: null,
        },
      });

      // Update profile
      await tx.customer_profile.update({
        where: {
          tenant_id_customer_id: {
            tenant_id: tenantId,
            customer_id: customerId,
          },
        },
        data: {
          loyalty_points_balance: newBalance,
          loyalty_lifetime_points: newLifetime,
          loyalty_tier: newTier,
        },
      });

      logger.info({
        tenantId,
        customerId,
        invoiceId,
        pointsReversed: pointsToReverse,
        newBalance,
        newTier,
      }, 'loyalty_points_reversed');
    }
  }

  // --------------------------------------------------------------------------
  // Query
  // --------------------------------------------------------------------------

  async getBalance(tenantId: string, customerId: string): Promise<CustomerLoyalty> {
    const profile = await this.prisma.customer_profile.findUnique({
      where: {
        tenant_id_customer_id: { tenant_id: tenantId, customer_id: customerId },
      },
      select: {
        loyalty_points_balance: true,
        loyalty_lifetime_points: true,
        loyalty_tier: true,
      },
    });

    const config = await this.getLoyaltyConfig(tenantId);
    const balance = profile?.loyalty_points_balance ?? 0;
    const lifetimePoints = profile?.loyalty_lifetime_points ?? 0;
    const tier = profile?.loyalty_tier ?? 'BRONCE';
    const nextTier = findNextTier(config.tiers, tier, lifetimePoints);

    return { balance, lifetimePoints, tier, nextTier };
  }

  async getHistory(
    tenantId: string,
    customerId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ entries: LoyaltyLedgerEntry[]; total: number }> {
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.loyalty_ledger.findMany({
        where: { tenant_id: tenantId, customer_id: customerId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.loyalty_ledger.count({
        where: { tenant_id: tenantId, customer_id: customerId },
      }),
    ]);

    return {
      entries: entries.map((e) => ({
        id: e.id,
        type: e.type,
        points: e.points,
        balanceAfter: e.balance_after,
        referenceType: e.reference_type,
        referenceId: e.reference_id,
        description: e.description,
        multiplier: Number(e.multiplier),
        createdAt: e.created_at,
      })),
      total,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function parseTiers(raw: unknown): LoyaltyTier[] {
  if (!raw) return DEFAULT_TIERS;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length > 0) return arr as LoyaltyTier[];
  } catch {
    // ignore
  }
  return DEFAULT_TIERS;
}

function findTier(tiers: LoyaltyTier[], tierName: string): LoyaltyTier | undefined {
  return tiers.find((t) => t.name === tierName);
}

function determineTier(tiers: LoyaltyTier[], lifetimePoints: number): string {
  // Sort descending by minPoints, pick highest qualifying
  const sorted = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  for (const tier of sorted) {
    if (lifetimePoints >= tier.minPoints) return tier.name;
  }
  return tiers[0]?.name ?? 'BRONCE';
}

function findNextTier(
  tiers: LoyaltyTier[],
  currentTier: string,
  lifetimePoints: number
): { name: string; minPoints: number; pointsNeeded: number } | null {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  const currentIdx = sorted.findIndex((t) => t.name === currentTier);
  if (currentIdx < 0 || currentIdx >= sorted.length - 1) return null;
  const next = sorted[currentIdx + 1];
  return {
    name: next.name,
    minPoints: next.minPoints,
    pointsNeeded: Math.max(0, next.minPoints - lifetimePoints),
  };
}
