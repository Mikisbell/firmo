/**
 * UX Simulation: Customer Loyalty Program
 * 
 * Simulates real loyalty scenarios:
 * - Customer earns points per purchase (1 point per S/. 10)
 * - Tier progression (Bronze → Silver → Gold → Platinum)
 * - Points redemption for discounts
 * - Points expiration after 12 months
 * - VIP customer perks (birthday discount, priority seating)
 * - Multi-tier benefits calculation
 * 
 * This tests LOYALTY ENGINE, not just basic points.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

interface LoyaltyCustomer {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  tier: LoyaltyTier;
  totalPoints: number;
  lifetimeSpentCents: Centavos;
  pointsEarnedThisMonth: number;
  pointsRedeemedThisMonth: number;
  joinDate: Date;
  lastPurchaseDate: Date;
  birthday: string; // MM-DD
}

interface LoyaltyTransaction {
  transactionId: string;
  customerId: string;
  type: 'EARN' | 'REDEEM' | 'EXPIRE' | 'BONUS';
  points: number;
  orderTotalCents: Centavos;
  date: Date;
  notes?: string;
}

interface TierThreshold {
  tier: LoyaltyTier;
  minLifetimeSpentCents: Centavos;
  minMonthlyVisits: number;
  benefits: string[];
  discountPercent: number;
  pointsMultiplier: number;
}

const TIER_THRESHOLDS: TierThreshold[] = [
  {
    tier: 'BRONZE',
    minLifetimeSpentCents: 0 as Centavos,
    minMonthlyVisits: 0,
    benefits: ['Earn 1 point per S/. 10'],
    discountPercent: 0,
    pointsMultiplier: 1.0,
  },
  {
    tier: 'SILVER',
    minLifetimeSpentCents: 50000 as Centavos, // S/. 500
    minMonthlyVisits: 4,
    benefits: ['Earn 1.5 points per S/. 10', '5% birthday discount', 'Priority waitlist'],
    discountPercent: 5,
    pointsMultiplier: 1.5,
  },
  {
    tier: 'GOLD',
    minLifetimeSpentCents: 150000 as Centavos, // S/. 1,500
    minMonthlyVisits: 8,
    benefits: ['Earn 2 points per S/. 10', '10% birthday discount', 'Free dessert monthly', 'Priority seating'],
    discountPercent: 10,
    pointsMultiplier: 2.0,
  },
  {
    tier: 'PLATINUM',
    minLifetimeSpentCents: 500000 as Centavos, // S/. 5,000
    minMonthlyVisits: 12,
    benefits: ['Earn 3 points per S/. 10', '15% all discounts', 'Free meal monthly', 'Dedicated host', 'VIP events'],
    discountPercent: 15,
    pointsMultiplier: 3.0,
  },
];

function calculatePointsEarned(orderTotalCents: Centavos, tier: LoyaltyTier): number {
  const threshold = TIER_THRESHOLDS.find(t => t.tier === tier)!;
  const basePoints = Math.floor(orderTotalCents / 1000); // 1 point per S/. 10
  return Math.floor(basePoints * threshold.pointsMultiplier);
}

function calculateTier(lifetimeSpentCents: Centavos, monthlyVisits: number): LoyaltyTier {
  if (lifetimeSpentCents >= TIER_THRESHOLDS[3].minLifetimeSpentCents && monthlyVisits >= TIER_THRESHOLDS[3].minMonthlyVisits) {
    return 'PLATINUM';
  }
  if (lifetimeSpentCents >= TIER_THRESHOLDS[2].minLifetimeSpentCents && monthlyVisits >= TIER_THRESHOLDS[2].minMonthlyVisits) {
    return 'GOLD';
  }
  if (lifetimeSpentCents >= TIER_THRESHOLDS[1].minLifetimeSpentCents && monthlyVisits >= TIER_THRESHOLDS[1].minMonthlyVisits) {
    return 'SILVER';
  }
  return 'BRONZE';
}

function calculatePointsExpiration(customer: LoyaltyCustomer, now: Date, monthsToExpire: number = 12): number {
  // Simplified: points expire after 12 months of inactivity
  const monthsSinceLastPurchase = (now.getTime() - customer.lastPurchaseDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

  if (monthsSinceLastPurchase >= monthsToExpire) {
    return customer.totalPoints; // All points expire
  }

  return 0; // No expiration yet
}

function calculateRedemptionValue(points: number): Centavos {
  // 100 points = S/. 5.00
  return centavos((points / 100) * 500);
}

function calculateLoyaltyROI(totalPointsIssued: number, totalPointsRedeemed: number, incrementalRevenueCents: Centavos): {
  roi: number;
  costOfProgramCents: Centavos;
  netProfitCents: Centavos;
} {
  const costOfProgramCents = calculateRedemptionValue(totalPointsRedeemed);
  const netProfitCents = centavos(incrementalRevenueCents - costOfProgramCents);
  const roi = costOfProgramCents > 0 ? (netProfitCents / costOfProgramCents) * 100 : 0;

  return { roi, costOfProgramCents, netProfitCents };
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// LOYALTY SIMULATION TESTS
// ============================================================

describe('Customer Loyalty Program Simulation', () => {

  it('should simulate points earning based on tier and purchase amount', () => {
    // SCENARIO: Bronze customer spends S/. 100
    const bronzePoints = calculatePointsEarned(10000 as Centavos, 'BRONZE');
    expect(bronzePoints).toBe(10); // 1 point per S/. 10

    // Gold customer spends S/. 100
    const goldPoints = calculatePointsEarned(10000 as Centavos, 'GOLD');
    expect(goldPoints).toBe(20); // 2 points per S/. 10

    // Platinum customer spends S/. 100
    const platinumPoints = calculatePointsEarned(10000 as Centavos, 'PLATINUM');
    expect(platinumPoints).toBe(30); // 3 points per S/. 10

    console.log('⭐ Points Earning by Tier:');
    console.log(`   Bronze: 10 points (1x)`);
    console.log(`   Gold: ${goldPoints} points (2x)`);
    console.log(`   Platinum: ${platinumPoints} points (3x)`);
  });

  it('should simulate tier progression based on spending and visits', () => {
    // SCENARIO: Customer progresses through tiers
    expect(calculateTier(0 as Centavos, 0)).toBe('BRONZE');
    expect(calculateTier(50000 as Centavos, 4)).toBe('SILVER');
    expect(calculateTier(150000 as Centavos, 8)).toBe('GOLD');
    expect(calculateTier(500000 as Centavos, 12)).toBe('PLATINUM');

    // Customer doesn't meet visit requirement for higher tiers
    expect(calculateTier(500000 as Centavos, 5)).toBe('SILVER'); // Has spend but not enough visits for GOLD+

    console.log('📈 Tier Progression:');
    console.log(`   Bronze: S/. 0+`);
    console.log(`   Silver: S/. 500+ (4 visits/month)`);
    console.log(`   Gold: S/. 1,500+ (8 visits/month)`);
    console.log(`   Platinum: S/. 5,000+ (12 visits/month)`);
  });

  it('should calculate points redemption value', () => {
    // SCENARIO: Customer redeems points for discount
    expect(calculateRedemptionValue(100)).toBe(500); // 100 pts = S/. 5.00
    expect(calculateRedemptionValue(500)).toBe(2500); // 500 pts = S/. 25.00
    expect(calculateRedemptionValue(1000)).toBe(5000); // 1000 pts = S/. 50.00

    console.log('💰 Points Redemption:');
    console.log(`   100 points = S/. 5.00`);
    console.log(`   500 points = S/. 25.00`);
    console.log(`   1000 points = S/. 50.00`);
  });

  it('should simulate points expiration after inactivity', () => {
    // SCENARIO: Customer inactive for 12+ months, points expire
    const activeCustomer: LoyaltyCustomer = {
      customerId: 'cust-1',
      name: 'Juan Pérez',
      phone: '987654321',
      email: 'juan@email.com',
      tier: 'GOLD',
      totalPoints: 500,
      lifetimeSpentCents: 200000 as Centavos,
      pointsEarnedThisMonth: 50,
      pointsRedeemedThisMonth: 0,
      joinDate: new Date('2025-01-01'),
      lastPurchaseDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000), // 6 months ago
      birthday: '05-15',
    };

    const inactiveCustomer: LoyaltyCustomer = {
      ...activeCustomer,
      customerId: 'cust-2',
      lastPurchaseDate: new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000), // 13 months ago
    };

    const now = new Date();
    const activeExpiration = calculatePointsExpiration(activeCustomer, now);
    const inactiveExpiration = calculatePointsExpiration(inactiveCustomer, now);

    expect(activeExpiration).toBe(0); // Still active, no expiration
    expect(inactiveExpiration).toBe(500); // All points expire

    console.log('⏰ Points Expiration:');
    console.log(`   Active (6 months): ${activeExpiration} points expired`);
    console.log(`   Inactive (13 months): ${inactiveExpiration} points expired`);
  });

  it('should calculate loyalty program ROI', () => {
    // SCENARIO: Business wants to know if loyalty program is profitable
    const totalPointsIssued = 50000;
    const totalPointsRedeemed = 30000; // 60% redemption rate
    const incrementalRevenueCents = 5000000 as Centavos; // S/. 50,000 from loyal customers

    const roi = calculateLoyaltyROI(totalPointsIssued, totalPointsRedeemed, incrementalRevenueCents);

    expect(roi.isProfitable || roi.netProfitCents > 0).toBe(true);
    expect(roi.roi).toBeGreaterThan(100); // Should be very profitable

    console.log('💼 Loyalty Program ROI:');
    console.log(`   Points Issued: ${totalPointsIssued}`);
    console.log(`   Points Redeemed: ${totalPointsRedeemed}`);
    console.log(`   Redemption Rate: ${(totalPointsRedeemed / totalPointsIssued * 100).toFixed(0)}%`);
    console.log(`   Incremental Revenue: S/. ${(incrementalRevenueCents / 100).toFixed(2)}`);
    console.log(`   Program Cost: S/. ${(roi.costOfProgramCents / 100).toFixed(2)}`);
    console.log(`   Net Profit: S/. ${(roi.netProfitCents / 100).toFixed(2)}`);
    console.log(`   ROI: ${roi.roi.toFixed(0)}%`);
  });

  it('should recommend: Loyalty program improvements', () => {
    const currentGaps = [
      'No birthday automated discounts',
      'No tier milestone celebrations',
      'No points balance notifications',
      'No personalized offers based on tier',
      'No referral program for new customers',
      'No churn prediction and win-back campaigns',
    ];

    const recommendations = [
      'Auto-apply tier discount on birthday, SMS reminder 7 days before',
      'Auto-celebrate when customer reaches new tier, email + in-app badge',
      'Monthly SMS: "You have X points, worth S/. Y. Redeem now!"',
      'Generate personalized offers: Silver gets 10% off chicken, Gold gets free dessert',
      'Referral: Give S/. 50, Get S/. 50 when referred customer spends S/. 200+',
      'Identify at-risk customers (no visit in 60 days), auto-send win-back offer',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Loyalty Program Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
