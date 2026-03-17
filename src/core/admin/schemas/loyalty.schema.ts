/**
 * Loyalty Program Schema Validation
 * Zod schemas for loyalty config, tier management, and point redemption
 */

import { z } from 'zod';

export const LOYALTY_TIERS = ['BRONCE', 'PLATA', 'ORO', 'PLATINO'] as const;
export type LoyaltyTierName = (typeof LOYALTY_TIERS)[number];

export const LoyaltyTierSchema = z.object({
  name: z.string().min(1).max(20),
  minPoints: z.number().int().nonnegative(),
  multiplier: z.number().positive().max(10),
});

export type LoyaltyTier = z.infer<typeof LoyaltyTierSchema>;

export const DEFAULT_TIERS: LoyaltyTier[] = [
  { name: 'BRONCE', minPoints: 0, multiplier: 1.0 },
  { name: 'PLATA', minPoints: 500, multiplier: 1.2 },
  { name: 'ORO', minPoints: 2000, multiplier: 1.5 },
  { name: 'PLATINO', minPoints: 5000, multiplier: 2.0 },
];

export const LoyaltyConfigSchema = z.object({
  enabled: z.boolean(),
  points_per_sol: z.number().int().positive().max(100),
  redemption_rate: z.number().int().positive().max(10000),
  tiers: z.array(LoyaltyTierSchema).min(1).max(10),
  min_redemption_points: z.number().int().nonnegative().max(100000),
});

export type LoyaltyConfig = z.infer<typeof LoyaltyConfigSchema>;

export const RedeemPointsSchema = z.object({
  customerId: z.string().uuid(),
  pointsToRedeem: z.number().int().positive(),
  orderId: z.string().uuid().optional(),
  checkId: z.string().uuid().optional(),
});

export type RedeemPointsInput = z.infer<typeof RedeemPointsSchema>;

export const UpdateLoyaltyConfigSchema = LoyaltyConfigSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);
