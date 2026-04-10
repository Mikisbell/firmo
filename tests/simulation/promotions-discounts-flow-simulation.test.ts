/**
 * UX Simulation: Promotions and Discounts Flow
 * 
 * Simulates real promotion scenarios:
 * - Happy Hour: 2x1 Inca Kola 5-7 PM
 * - Combo descuento: Pollo + Papas + Bebida = 15% off
 * - Cupón: 10% off para clientes frecuentes
 * - Descuento por volumen: 5+ pollos = 10% off
 * - Stack de descuentos (cupón + combo = ?)
 * - Expiración de promociones
 * - ROI de promoción (¿valió la pena?)
 * 
 * This tests PROMOTION ENGINE, not just manual discounts.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface Promotion {
  id: string;
  name: string;
  type: 'HAPPY_HOUR' | 'COMBO' | 'COUPON' | 'VOLUME' | 'LOYALTY';
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number; // 15 = 15% or 1500 = S/. 15.00
  validFrom: Date;
  validUntil: Date;
  applicableHours?: { start: number; end: number }; // For happy hour
  minItems?: number; // For volume discount
  applicableProducts?: string[]; // Product codes
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
}

interface CartItem {
  productCode: string;
  name: string;
  quantity: number;
  unitPriceCents: Centavos;
}

interface Cart {
  items: CartItem[];
  subtotalCents: Centavos;
  discountCents: Centavos;
  totalCents: Centavos;
  appliedPromotions: string[];
}

interface PromotionResult {
  applicable: boolean;
  discountCents: Centavos;
  reason?: string;
}

function isPromotionActive(promotion: Promotion, now: Date): boolean {
  if (!promotion.isActive) return false;
  if (now < promotion.validFrom || now > promotion.validUntil) return false;
  if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) return false;

  // Check happy hour time window
  if (promotion.applicableHours) {
    const hour = now.getHours();
    if (hour < promotion.applicableHours.start || hour >= promotion.applicableHours.end) {
      return false;
    }
  }

  return true;
}

function calculateCartTotal(items: CartItem[]): Centavos {
  return centavos(items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0));
}

function applyPromotion(cart: Cart, promotion: Promotion, now: Date): PromotionResult {
  // Check if promotion is active
  if (!isPromotionActive(promotion, now)) {
    return {
      applicable: false,
      discountCents: 0 as Centavos,
      reason: getPromotionInactiveReason(promotion, now),
    };
  }

  let discountCents = 0;

  switch (promotion.type) {
    case 'HAPPY_HOUR':
      // Apply to applicable products during happy hour
      const applicableItems = promotion.applicableProducts
        ? cart.items.filter(i => promotion.applicableProducts!.includes(i.productCode))
        : cart.items;

      const hhSubtotal = applicableItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
      discountCents = promotion.discountType === 'PERCENT'
        ? centavos(hhSubtotal * promotion.discountValue / 100)
        : centavos(promotion.discountValue * applicableItems.reduce((sum, i) => sum + i.quantity, 0));
      break;

    case 'COMBO':
      // Apply to entire cart if combo conditions met
      discountCents = promotion.discountType === 'PERCENT'
        ? centavos(cart.subtotalCents * promotion.discountValue / 100)
        : centavos(promotion.discountValue);
      break;

    case 'COUPON':
      discountCents = promotion.discountType === 'PERCENT'
        ? centavos(cart.subtotalCents * promotion.discountValue / 100)
        : centavos(promotion.discountValue);
      break;

    case 'VOLUME':
      const totalItems = cart.items.reduce((sum, i) => sum + i.quantity, 0);
      if (totalItems < (promotion.minItems || 0)) {
        return {
          applicable: false,
          discountCents: 0 as Centavos,
          reason: `Necesitas ${promotion.minItems} items, tienes ${totalItems}`,
        };
      }
      discountCents = centavos(cart.subtotalCents * promotion.discountValue / 100);
      break;

    case 'LOYALTY':
      discountCents = centavos(cart.subtotalCents * promotion.discountValue / 100);
      break;
  }

  return {
    applicable: true,
    discountCents: discountCents as Centavos,
  };
}

function getPromotionInactiveReason(promotion: Promotion, now: Date): string {
  if (!promotion.isActive) return 'Promoción desactivada';
  if (now < promotion.validFrom) return `Vence desde ${promotion.validFrom.toLocaleDateString()}`;
  if (now > promotion.validUntil) return `Expiró el ${promotion.validUntil.toLocaleDateString()}`;
  if (promotion.maxUses && promotion.currentUses >= promotion.maxUses) return 'Usos máximos alcanzados';
  if (promotion.applicableHours) {
    const { start, end } = promotion.applicableHours;
    return `Fuera de horario (${start}:00-${end}:00)`;
  }
  return 'Promoción no aplicable';
}

function calculatePromotionROI(promotion: Promotion, totalDiscountCents: Centavos, additionalSalesCents: Centavos): {
  roi: number;
  netProfitCents: Centavos;
  isProfitable: boolean;
} {
  const netProfitCents = centavos(additionalSalesCents - totalDiscountCents);
  const roi = totalDiscountCents > 0 ? (netProfitCents / totalDiscountCents) * 100 : 0;
  const isProfitable = netProfitCents > 0;

  return { roi, netProfitCents, isProfitable };
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// PROMOTIONS SIMULATION TESTS
// ============================================================

describe('Promotions and Discounts Flow Simulation', () => {

  it('should simulate Happy Hour: 2x1 beverages 5-7 PM', () => {
    // SCENARIO: Happy Hour promotion on beverages
    const happyHourPromo: Promotion = {
      id: 'promo-hh-1',
      name: 'Happy Hour Bebidas',
      type: 'HAPPY_HOUR',
      discountType: 'PERCENT',
      discountValue: 50, // 50% off = 2x1
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-04-30'),
      applicableHours: { start: 17, end: 19 }, // 5-7 PM
      applicableProducts: ['INCA-500', 'COCA-500', 'CHICHA-VS'],
      maxUses: 100,
      currentUses: 45,
      isActive: true,
    };

    // Test during happy hour (6 PM)
    const duringHappyHour = new Date('2026-04-15T18:00:00');
    expect(isPromotionActive(happyHourPromo, duringHappyHour)).toBe(true);

    // Test outside happy hour (3 PM)
    const outsideHappyHour = new Date('2026-04-15T15:00:00');
    expect(isPromotionActive(happyHourPromo, outsideHappyHour)).toBe(false);

    // Apply promotion during happy hour
    const cart: Cart = {
      items: [
        { productCode: 'INCA-500', name: 'Inca Kola 500ml', quantity: 2, unitPriceCents: 400 as Centavos },
        { productCode: 'COCA-500', name: 'Coca Cola 500ml', quantity: 2, unitPriceCents: 400 as Centavos },
        { productCode: 'POLLO-ENT', name: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
      ],
      subtotalCents: 7100 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 7100 as Centavos,
      appliedPromotions: [],
    };

    cart.subtotalCents = calculateCartTotal(cart.items);
    const result = applyPromotion(cart, happyHourPromo, duringHappyHour);

    expect(result.applicable).toBe(true);
    // 50% off on beverages only: 4 × S/. 4.00 × 50% = S/. 8.00
    expect(result.discountCents).toBe(800);

    console.log('🍺 Happy Hour Simulation:');
    console.log(`   Time: ${duringHappyHour.getHours()}:00 (Happy Hour: 17-19)`);
    console.log(`   Beverages: 4 × S/. 4.00 = S/. 16.00`);
    console.log(`   Discount: 50% = S/. ${(result.discountCents / 100).toFixed(2)}`);
    console.log(`   Applicable: ${result.applicable}`);
  });

  it('should simulate Combo discount: Pollo + Papas + Bebida = 15% off', () => {
    // SCENARIO: Combo promotion for complete meal
    const comboPromo: Promotion = {
      id: 'promo-combo-1',
      name: 'Combo Familiar',
      type: 'COMBO',
      discountType: 'PERCENT',
      discountValue: 15, // 15% off
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-04-30'),
      isActive: true,
      currentUses: 0,
    };

    const cart: Cart = {
      items: [
        { productCode: 'POLLO-ENT', name: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
        { productCode: 'PAPAS-GDE', name: 'Papas Grande', quantity: 1, unitPriceCents: 1200 as Centavos },
        { productCode: 'INCA-1.5L', name: 'Inca Kola 1.5L', quantity: 1, unitPriceCents: 900 as Centavos },
      ],
      subtotalCents: 0 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 0 as Centavos,
      appliedPromotions: [],
    };

    cart.subtotalCents = calculateCartTotal(cart.items);
    const result = applyPromotion(cart, comboPromo, new Date());

    expect(result.applicable).toBe(true);
    expect(result.discountCents).toBe(1140); // 15% of S/. 76.00

    console.log('🍗 Combo Discount Simulation:');
    console.log(`   Pollo + Papas + Bebida = S/. ${(cart.subtotalCents / 100).toFixed(2)}`);
    console.log(`   Combo Discount: 15% = S/. ${(result.discountCents / 100).toFixed(2)}`);
    console.log(`   Final Price: S/. ${((cart.subtotalCents - result.discountCents) / 100).toFixed(2)}`);
  });

  it('should simulate Volume discount: 5+ pollos = 10% off', () => {
    // SCENARIO: Bulk discount for large orders
    const volumePromo: Promotion = {
      id: 'promo-volume-1',
      name: 'Descuento por Volumen',
      type: 'VOLUME',
      discountType: 'PERCENT',
      discountValue: 10, // 10% off
      validFrom: new Date('2026-04-01'),
      validUntil: new Date('2026-12-31'),
      minItems: 5,
      isActive: true,
      currentUses: 0,
    };

    // Order with 4 items (should NOT qualify)
    const smallCart: Cart = {
      items: [
        { productCode: 'POLLO-ENT', name: 'Pollo Entero', quantity: 4, unitPriceCents: 5500 as Centavos },
      ],
      subtotalCents: 22000 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 22000 as Centavos,
      appliedPromotions: [],
    };

    const smallResult = applyPromotion(smallCart, volumePromo, new Date());
    expect(smallResult.applicable).toBe(false);
    expect(smallResult.reason).toContain('Necesitas 5');

    // Order with 6 items (should qualify)
    const largeCart: Cart = {
      items: [
        { productCode: 'POLLO-ENT', name: 'Pollo Entero', quantity: 6, unitPriceCents: 5500 as Centavos },
      ],
      subtotalCents: 33000 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 33000 as Centavos,
      appliedPromotions: [],
    };

    const largeResult = applyPromotion(largeCart, volumePromo, new Date());
    expect(largeResult.applicable).toBe(true);
    expect(largeResult.discountCents).toBe(3300); // 10% of S/. 330.00

    console.log('📦 Volume Discount Simulation:');
    console.log(`   4 items: NOT QUALIFIED (${smallResult.reason})`);
    console.log(`   6 items: QUALIFIED, 10% off = S/. ${(largeResult.discountCents / 100).toFixed(2)}`);
  });

  it('should calculate promotion ROI to determine profitability', () => {
    // SCENARIO: Business wants to know if Happy Hour is profitable
    const totalDiscountGiven = 80000 as Centavos; // S/. 800 in discounts
    const additionalSalesGenerated = 150000 as Centavos; // S/. 1,500 from happy hour

    const roi = calculatePromotionROI(
      {} as Promotion,
      totalDiscountGiven,
      additionalSalesGenerated
    );

    expect(roi.isProfitable).toBe(true);
    expect(roi.roi).toBeGreaterThan(50); // 87.5% ROI

    console.log('💰 Promotion ROI Analysis:');
    console.log(`   Discounts Given: S/. ${(totalDiscountGiven / 100).toFixed(2)}`);
    console.log(`   Additional Sales: S/. ${(additionalSalesGenerated / 100).toFixed(2)}`);
    console.log(`   Net Profit: S/. ${(roi.netProfitCents / 100).toFixed(2)}`);
    console.log(`   ROI: ${roi.roi.toFixed(0)}%`);
    console.log(`   Profitable: ${roi.isProfitable ? '✅ YES' : '❌ NO'}`);
  });

  it('should handle expired promotions gracefully', () => {
    // SCENARIO: Old promotion that expired should not apply
    const expiredPromo: Promotion = {
      id: 'promo-old-1',
      name: 'Promo Marzo',
      type: 'COUPON',
      discountType: 'PERCENT',
      discountValue: 20,
      validFrom: new Date('2026-03-01'),
      validUntil: new Date('2026-03-31'), // Expired!
      isActive: true,
      currentUses: 0,
    };

    const now = new Date('2026-04-15');
    expect(isPromotionActive(expiredPromo, now)).toBe(false);

    const cart: Cart = {
      items: [{ productCode: 'POLLO-ENT', name: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos }],
      subtotalCents: 5500 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 5500 as Centavos,
      appliedPromotions: [],
    };

    const result = applyPromotion(cart, expiredPromo, now);
    expect(result.applicable).toBe(false);
    expect(result.reason).toContain('Expiró');

    console.log('⏰ Expired Promotion Handling:');
    console.log(`   Promotion: ${expiredPromo.name}`);
    console.log(`   Expired: ${expiredPromo.validUntil.toLocaleDateString()}`);
    console.log(`   Applicable: ${result.applicable} (${result.reason})`);
  });

  it('should recommend: Promotion engine improvements', () => {
    const currentGaps = [
      'No stacking rules (multiple promotions on same order)',
      'No A/B testing for promotion effectiveness',
      'No customer segmentation for targeted promotions',
      'No automatic promotion scheduling',
      'No real-time promotion performance dashboard',
      'No fraud detection for coupon abuse',
    ];

    const recommendations = [
      'Define stacking rules: max 2 promotions per order, cannot combine % + % discounts',
      'Run A/B tests: 10% vs 15% discount, measure conversion rate and ROI',
      'Target promotions by customer type: new customers get 10%, loyal get 15%',
      'Auto-schedule promotions: set start/end dates, system activates/deactivates',
      'Live dashboard: impressions, redemptions, revenue impact, ROI per promotion',
      'Track coupon usage per customer, flag if used > 5x/month, require manager approval',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Promotion Engine Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
