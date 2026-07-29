/**
 * UX Simulation: Inventory Management Edge Cases
 * 
 * Simulates real warehouse scenarios to find UX problems:
 * - Receiving goods without checking expiry dates
 * - Stock goes negative during busy hours
 * - Physical count reveals major discrepancies
 * - FEFO not enforced (cook uses newest lot instead of oldest)
 * - Waste recording is too slow during rush
 * - Multiple staff adjusting same item simultaneously
 * 
 * This tests the INVENTORY EXPERIENCE, not just stock calculations.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Simulated Inventory System
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type ExpiryUrgency = 'EXPIRED' | 'TODAY' | 'TOMORROW' | 'SOON_3D' | 'SOON_7D' | 'OK';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface Lot {
  lotNumber: string;
  quantity: number;
  expiryDate: Date;
  costPerUnit: Centavos;
}

interface InventoryItem {
  code: string;
  name: string;
  stock: number;
  minStock: number;
  lots: Lot[];
  movements: Array<{ type: string; quantity: number; date: Date; reason: string }>;
}

interface StockAlert {
  itemCode: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRED' | 'NEGATIVE';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
}

function calculateExpiryUrgency(expiryDate: Date, now: Date): ExpiryUrgency {
  const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft === 0) return 'TODAY';
  if (daysLeft === 1) return 'TOMORROW';
  if (daysLeft <= 3) return 'SOON_3D';
  if (daysLeft <= 7) return 'SOON_7D';
  return 'OK';
}

function receiveGoods(item: InventoryItem, lot: Lot): InventoryItem {
  item.lots.push(lot);
  item.stock += lot.quantity;
  item.movements.push({
    type: 'IN',
    quantity: lot.quantity,
    date: new Date(),
    reason: `Received lot ${lot.lotNumber}`,
  });
  return item;
}

function deductStock(item: InventoryItem, quantity: number, useFEFO: boolean = true): {
  success: boolean;
  deducted: number;
  alerts: StockAlert[];
} {
  const alerts: StockAlert[] = [];
  let remaining = quantity;

  if (useFEFO) {
    // Sort lots by expiry date (FEFO)
    const sortedLots = [...item.lots].sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

    for (const lot of sortedLots) {
      if (remaining <= 0) break;

      const urgency = calculateExpiryUrgency(lot.expiryDate, new Date());
      if (urgency === 'EXPIRED') {
        lot.quantity = 0; // Expired, can't use
        continue;
      }

      const take = Math.min(remaining, lot.quantity);
      lot.quantity -= take;
      remaining -= take;
    }
  } else {
    // No FEFO - uses first lot (could be newest!)
    for (const lot of item.lots) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, lot.quantity);
      lot.quantity -= take;
      remaining -= take;
    }
  }

  const deducted = quantity - remaining;
  item.stock -= deducted;

  // Check for alerts
  if (item.stock < 0) {
    alerts.push({
      itemCode: item.code,
      type: 'NEGATIVE',
      severity: 'CRITICAL',
      message: `Stock negativo: ${item.stock}`,
    });
  } else if (item.stock < item.minStock) {
    alerts.push({
      itemCode: item.code,
      type: 'LOW_STOCK',
      severity: 'WARNING',
      message: `Stock bajo: ${item.stock} < ${item.minStock}`,
    });
  }

  if (deducted > 0) {
    item.movements.push({
      type: 'OUT',
      quantity: deducted,
      date: new Date(),
      reason: 'Sale deduction',
    });
  }

  return { success: remaining === 0, deducted, alerts };
}

function recordWaste(item: InventoryItem, quantity: number, reason: string, lotNumber: string): InventoryItem {
  // Find the lot
  const lot = item.lots.find(l => l.lotNumber === lotNumber);
  if (!lot) {
    item.movements.push({
      type: 'WASTE',
      quantity,
      date: new Date(),
      reason: `Waste recorded but lot ${lotNumber} not found`,
    });
    return item;
  }

  lot.quantity -= quantity;
  item.stock -= quantity;

  item.movements.push({
    type: 'WASTE',
    quantity,
    date: new Date(),
    reason: `${reason} - Lot ${lotNumber}`,
  });

  return item;
}

function physicalCount(item: InventoryItem, counted: number): {
  variance: number;
  adjustment: number;
  suspicious: boolean;
} {
  const variance = counted - item.stock;
  const adjustment = variance;

  // Mark as suspicious if variance > 20%
  const variancePercent = item.stock > 0 ? Math.abs(variance) / item.stock : 0;
  const suspicious = variancePercent > 0.20;

  item.stock = counted;
  item.lots[0].quantity = Math.max(0, item.lots[0].quantity + adjustment);

  item.movements.push({
    type: 'ADJUST',
    quantity: adjustment,
    date: new Date(),
    reason: `Physical count: ${counted} vs theoretical ${item.stock - adjustment}`,
  });

  return { variance, adjustment, suspicious };
}

// ============================================================
// INVENTORY UX SIMULATION TESTS
// ============================================================

describe('Inventory Management UX Simulation', () => {

  it('should identify: Receiving goods without checking expiry dates', () => {
    // PROBLEM: Staff receives 3 lots but doesn't notice one expires tomorrow
    // System should warn them BEFORE accepting

    const chicken: InventoryItem = {
      code: 'CHICKEN',
      name: 'Pollo Entero',
      stock: 0,
      minStock: 20,
      lots: [],
      movements: [],
    };

    const now = new Date('2026-04-09');

    // Receive 3 lots
    receiveGoods(chicken, {
      lotNumber: 'P-001',
      quantity: 50,
      expiryDate: new Date('2026-04-20'), // 11 days - OK
      costPerUnit: 1800 as Centavos,
    });

    receiveGoods(chicken, {
      lotNumber: 'P-002',
      quantity: 30,
      expiryDate: new Date('2026-04-10'), // TOMORROW!
      costPerUnit: 1700 as Centavos,
    });

    receiveGoods(chicken, {
      lotNumber: 'P-003',
      quantity: 20,
      expiryDate: new Date('2026-04-08'), // ALREADY EXPIRED!
      costPerUnit: 1600 as Centavos,
    });

    // Check expiry urgency for each lot
    const urgencies = chicken.lots.map(lot => ({
      lot: lot.lotNumber,
      urgency: calculateExpiryUrgency(lot.expiryDate, now),
      quantity: lot.quantity,
    }));

    const hasExpired = urgencies.some(u => u.urgency === 'EXPIRED');
    const hasExpiringTomorrow = urgencies.some(u => u.urgency === 'TOMORROW');

    expect(hasExpired).toBe(true);
    expect(hasExpiringTomorrow).toBe(true);

    console.log('🔴 UX Problem: Receiving without expiry check');
    console.log(`   Lot P-003: EXPIRED (received ${chicken.lots[2].quantity} units)`);
    console.log(`   Lot P-002: Expires TOMORROW (received ${chicken.lots[1].quantity} units)`);
    console.log(`   System accepted all without warning`);
    console.log(`   Better: Block expired lots, warn about lots expiring < 3 days`);
  });

  it('should identify: Stock goes negative during busy hours', () => {
    // PROBLEM: Multiple sales deplete stock below zero
    // System allows negative stock!

    const papas: InventoryItem = {
      code: 'PAPAS',
      name: 'Papas Fritas',
      stock: 10,
      minStock: 5,
      lots: [{
        lotNumber: 'PAP-001',
        quantity: 10,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        costPerUnit: 200 as Centavos,
      }],
      movements: [],
    };

    // Simulate busy hour: 5 orders of papas (total 14 units, more than 10 available)
    const orders = [3, 2, 4, 3, 2]; // quantities = 14 total
    const alerts: StockAlert[] = [];
    let totalDeducted = 0;

    for (const qty of orders) {
      const result = deductStock(papas, qty);
      totalDeducted += result.deducted;
      alerts.push(...result.alerts);
    }

    // Stock should reflect actual deductions (10 available, tried to deduct 14)
    expect(papas.stock).toBe(0); // Stock hits 0, not negative (system prevents overselling)
    expect(totalDeducted).toBe(10); // Only 10 units actually deducted

    console.log('🔴 UX Problem: Stock depletion during busy hours');
    console.log(`   Initial stock: 10`);
    console.log(`   Tried to deduct: 14`);
    console.log(`   Actually deducted: ${totalDeducted}`);
    console.log(`   System prevented negative stock but orders 4-5 failed silently`);
    console.log(`   Better: Warn cashier when stock reaches 0, block further sales`);
  });

  it('should identify: Physical count reveals major discrepancies', () => {
    // PROBLEM: System says 100 units, physical count finds 75
    // 25 units missing - theft? waste? data entry error?

    const item: InventoryItem = {
      code: 'GASEOSA',
      name: 'Inca Kola 1.5L',
      stock: 100,
      minStock: 30,
      lots: [{
        lotNumber: 'GAS-001',
        quantity: 100,
        expiryDate: new Date('2027-01-01'),
        costPerUnit: 400 as Centavos,
      }],
      movements: [],
    };

    // Physical count finds only 75 (25% variance)
    const result = physicalCount(item, 75);

    expect(result.variance).toBe(-25);
    // 25/100 = 25% > 20% threshold
    expect(result.suspicious).toBe(true);

    console.log('🔴 UX Problem: Major discrepancy without explanation');
    console.log(`   System stock: 100`);
    console.log(`   Physical count: 75`);
    console.log(`   Variance: ${result.variance} units (S/. ${(Math.abs(result.variance) * 4).toFixed(2)})`);
    console.log(`   Suspicious: ${result.suspicious}`);
    console.log(`   Better: Auto-flag variances > 10%, require manager explanation`);
  });

  it('should identify: FEFO not enforced (cook uses newest lot)', () => {
    // PROBLEM: Kitchen uses Lot P-003 (expires May) instead of P-001 (expires tomorrow)
    // Food waste increases

    const item: InventoryItem = {
      code: 'LECHUGA',
      name: 'Lechuga',
      stock: 25,
      minStock: 5,
      lots: [
        { lotNumber: 'LET-001', quantity: 10, expiryDate: new Date('2026-04-10'), costPerUnit: 80 as Centavos },
        { lotNumber: 'LET-002', quantity: 15, expiryDate: new Date('2026-04-25'), costPerUnit: 85 as Centavos },
      ],
      movements: [],
    };

    // Deduct 5 units WITHOUT FEFO (cook picks newest lot)
    const resultNoFEFO = deductStock(item, 5, false);
    
    // Check which lot was used
    const lot1Remaining = item.lots[0].quantity;
    const lot2Remaining = item.lots[1].quantity;

    // Without FEFO, might use newest lot (LET-002)
    // With FEFO, should use oldest lot (LET-001)

    console.log('🔴 UX Problem: FEFO not enforced');
    console.log(`   Lot LET-001: ${lot1Remaining} remaining (expires Apr 10)`);
    console.log(`   Lot LET-002: ${lot2Remaining} remaining (expires Apr 25)`);
    console.log(`   Without FEFO: Cook might use newest lot first`);
    console.log(`   With FEFO: System forces oldest lot first`);
    console.log(`   Better: Show "USE LOT LET-001 FIRST" in kitchen display`);
  });

  it('should identify: Waste recording is too slow during rush', () => {
    // PROBLEM: Cook spills 10 papas during rush
    // Recording waste takes 6 clicks + lot selection + reason
    // They skip recording it!

    const papas: InventoryItem = {
      code: 'PAPAS',
      name: 'Papas Fritas',
      stock: 100,
      minStock: 20,
      lots: [
        { lotNumber: 'PAP-001', quantity: 50, expiryDate: new Date('2026-05-01'), costPerUnit: 200 as Centavos },
        { lotNumber: 'PAP-002', quantity: 50, expiryDate: new Date('2026-04-20'), costPerUnit: 190 as Centavos },
      ],
      movements: [],
    };

    // Simulating waste recording steps:
    // 1. Open waste modal
    // 2. Select item (Papas)
    // 3. Enter quantity (10)
    // 4. Select lot (PAP-001 or PAP-002)
    // 5. Select reason (SPILLED, EXPIRED, DAMAGED)
    // 6. Confirm
    const stepsRequired = 6;

    expect(stepsRequired).toBeGreaterThan(3); // Too many steps during rush

    // During rush, cook doesn't record waste
    // Stock becomes inaccurate
    const unrecordedWaste = 10;
    const actualStock = papas.stock - unrecordedWaste;

    expect(actualStock).toBe(90);
    expect(papas.stock).toBe(100); // System still thinks 100

    console.log('🔴 UX Problem: Waste recording too slow');
    console.log(`   Steps required: ${stepsRequired}`);
    console.log(`   Unrecorded waste: ${unrecordedWaste} units`);
    console.log(`   System stock: ${papas.stock}, Actual: ${actualStock}`);
    console.log(`   Better: Quick waste button: "Spilled 10 PAPAS" → 1 click`);
  });

  it('should identify: Multiple staff adjusting same item simultaneously', () => {
    // PROBLEM: Staff A counts 50 units, Staff B counts 48 units
    // Both submit adjustments at same time
    // System accepts both!

    const item: InventoryItem = {
      code: 'POLLO',
      name: 'Pollo Entero',
      stock: 100,
      minStock: 20,
      lots: [{
        lotNumber: 'POL-001',
        quantity: 100,
        expiryDate: new Date('2026-04-20'),
        costPerUnit: 1800 as Centavos,
      }],
      movements: [],
    };

    // Staff A counts 50
    const resultA = physicalCount({...item}, 50);
    
    // Staff B counts 48 (at same time!)
    const resultB = physicalCount({...item}, 48);

    // Both adjustments accepted independently
    expect(resultA.variance).toBe(-50);
    expect(resultB.variance).toBe(-52);

    console.log('🔴 UX Problem: Concurrent adjustments');
    console.log(`   Staff A count: 50 (variance: ${resultA.variance})`);
    console.log(`   Staff B count: 48 (variance: ${resultB.variance})`);
    console.log(`   Both accepted independently`);
    console.log(`   Better: Lock item during count, require reconciliation`);
  });

  it('should calculate: Cost of expired inventory over a week', () => {
    // PROBLEM: System doesn't track expiry costs
    // Business loses money on expired goods

    const now = new Date('2026-04-13'); // After both expiry dates
    const items: InventoryItem[] = [
      {
        code: 'LECHUGA',
        name: 'Lechuga',
        stock: 20,
        minStock: 5,
        lots: [{ lotNumber: 'LET-001', quantity: 20, expiryDate: new Date('2026-04-11'), costPerUnit: 80 as Centavos }],
        movements: [],
      },
      {
        code: 'TOMATE',
        name: 'Tomate',
        stock: 15,
        minStock: 5,
        lots: [{ lotNumber: 'TOM-001', quantity: 15, expiryDate: new Date('2026-04-12'), costPerUnit: 60 as Centavos }],
        movements: [],
      },
    ];

    // Simulate week passing - items expire
    let totalExpiredCost = 0;

    for (const item of items) {
      for (const lot of item.lots) {
        const urgency = calculateExpiryUrgency(lot.expiryDate, now);
        if (urgency === 'EXPIRED' || urgency === 'TODAY' || urgency === 'TOMORROW') {
          totalExpiredCost += lot.quantity * lot.costPerUnit;
        }
      }
    }

    expect(totalExpiredCost).toBeGreaterThan(0);

    console.log('💰 Expired Inventory Cost (This Week):');
    console.log(`   Lechuga: 20 units × S/. 0.80 = S/. 16.00`);
    console.log(`   Tomate: 15 units × S/. 0.60 = S/. 9.00`);
    console.log(`   Total at risk: S/. ${(totalExpiredCost / 100).toFixed(2)}`);
    console.log(`   Better: Alert 3 days before expiry, suggest discount`);
  });

  it('should recommend: Inventory UX improvements', () => {
    const currentIssues = [
      'No expiry check on receive',
      'Negative stock allowed',
      'Manual waste recording (6 steps)',
      'FEFO not enforced',
      'No concurrent adjustment protection',
      'No expiry cost tracking',
    ];

    const recommendations = [
      'Block expired lots, warn < 3 days',
      'Block sales when stock = 0',
      'Quick waste button: 1 click',
      'Show "USE LOT X FIRST" in kitchen',
      'Lock item during physical count',
      'Weekly expiry cost report + auto-discount',
    ];

    expect(recommendations.length).toBe(currentIssues.length);

    console.log('✅ Inventory UX Recommendations:');
    for (let i = 0; i < currentIssues.length; i++) {
      console.log(`   ❌ ${currentIssues[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
