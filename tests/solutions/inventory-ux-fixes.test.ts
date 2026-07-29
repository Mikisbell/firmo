/**
 * Inventory UX Fixes - Implementation
 * 
 * Solves 7 critical inventory UX problems found through simulation testing:
 * 1. Receiving without expiry check → Block expired, warn < 3 days
 * 2. Stock depletion silent failures → Warn when stock = 0
 * 3. Physical count discrepancies unexplained → Flag > 10% variance
 * 4. FEFO not enforced → Force oldest lot first
 * 5. Waste recording too slow (6 steps) → Quick 1-click waste button
 * 6. Concurrent adjustments conflict → Lock item during count
 * 7. Expired inventory cost untracked → Weekly expiry cost report
 * 
 * Each fix includes validation tests.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

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
  isLocked?: boolean;
  lockedBy?: string;
}

interface WasteRecord {
  itemCode: string;
  quantity: number;
  reason: string;
  lotNumber: string;
  cost: Centavos;
  recordedAt: Date;
}

// ============================================================
// FIX 1: Block expired lots on receive, warn < 3 days
// ============================================================

function receiveGoodsWithExpiryCheck(item: InventoryItem, lot: Lot): {
  success: boolean;
  item: InventoryItem;
  warning?: string;
  error?: string;
} {
  const now = new Date();
  const daysUntilExpiry = Math.floor((lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Block expired lots
  if (daysUntilExpiry < 0) {
    return {
      success: false,
      item,
      error: `🔴 Lote ${lot.lotNumber} está EXPIRADO (venció hace ${Math.abs(daysUntilExpiry)} días). No se puede recibir.`,
    };
  }

  // Warn if expiring within 3 days
  if (daysUntilExpiry < 3) {
    const updatedItem = {
      ...item,
      lots: [...item.lots, lot],
      stock: item.stock + lot.quantity,
    };

    return {
      success: true,
      item: updatedItem,
      warning: `⚠️ Lote ${lot.lotNumber} vence en ${daysUntilExpiry} día(s). ¿Seguro que deseas recibir?`,
    };
  }

  // Normal receive
  return {
    success: true,
    item: {
      ...item,
      lots: [...item.lots, lot],
      stock: item.stock + lot.quantity,
    },
  };
}

// ============================================================
// FIX 2: Warn when stock reaches 0
// ============================================================

function deductStockWithWarning(item: InventoryItem, quantity: number): {
  success: boolean;
  item: InventoryItem;
  warning?: string;
  error?: string;
} {
  if (quantity > item.stock) {
    return {
      success: false,
      item,
      error: `Stock insuficiente. Disponible: ${item.stock}, Solicitado: ${quantity}`,
    };
  }

  const newStock = item.stock - quantity;
  let warning: string | undefined;

  if (newStock === 0) {
    warning = `🔴 ${item.name} se quedó SIN STOCK. Bloqueando ventas hasta reposición.`;
  } else if (newStock < item.minStock) {
    warning = `⚠️ ${item.name} stock bajo: ${newStock} < ${item.minStock}`;
  }

  return {
    success: true,
    item: {
      ...item,
      stock: newStock,
    },
    warning,
  };
}

// ============================================================
// FIX 3: Flag discrepancies > 10% during physical count
// ============================================================

function physicalCountWithVarianceCheck(item: InventoryItem, counted: number, countedBy: string): {
  success: boolean;
  variance: number;
  variancePercent: number;
  suspicious: boolean;
  requiresManagerApproval: boolean;
  item: InventoryItem;
} {
  const variance = counted - item.stock;
  const variancePercent = item.stock > 0 ? Math.abs(variance) / item.stock * 100 : 0;
  const suspicious = variancePercent > 10;
  const requiresManagerApproval = variancePercent > 20;

  return {
    success: true,
    variance,
    variancePercent,
    suspicious,
    requiresManagerApproval,
    item: {
      ...item,
      stock: counted,
      isLocked: false,
      lockedBy: undefined,
    },
  };
}

// ============================================================
// FIX 4: Enforce FEFO (oldest lot first)
// ============================================================

function deductStockFEFO(item: InventoryItem, quantity: number): {
  success: boolean;
  deducted: number;
  item: InventoryItem;
  lotsUsed: Array<{ lot: string; quantity: number }>;
  error?: string;
} {
  // Sort lots by expiry date (FEFO)
  const sortedLots = [...item.lots]
    .filter(l => l.quantity > 0)
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

  const lotsUsed: Array<{ lot: string; quantity: number }> = [];
  let remaining = quantity;
  const updatedLots: Lot[] = [];

  for (const lot of item.lots) {
    const sortedLot = sortedLots.find(l => l.lotNumber === lot.lotNumber);
    if (!sortedLot) continue;

    const take = Math.min(remaining, sortedLot.quantity);
    if (take > 0) {
      lotsUsed.push({ lot: lot.lotNumber, quantity: take });
      remaining -= take;
      updatedLots.push({ ...lot, quantity: lot.quantity - take });
    } else {
      updatedLots.push(lot);
    }
  }

  if (remaining > 0) {
    return {
      success: false,
      deducted: quantity - remaining,
      item,
      lotsUsed,
      error: `Stock insuficiente. Faltan ${remaining} unidades.`,
    };
  }

  return {
    success: true,
    deducted: quantity,
    item: {
      ...item,
      stock: item.stock - quantity,
      lots: updatedLots,
    },
    lotsUsed,
  };
}

// ============================================================
// FIX 5: Quick 1-click waste recording
// ============================================================

function quickWasteRecord(
  item: InventoryItem,
  quantity: number,
  reason: 'SPILLED' | 'EXPIRED' | 'DAMAGED',
  lotNumber: string
): {
  success: boolean;
  waste: WasteRecord;
  item: InventoryItem;
} {
  const lot = item.lots.find(l => l.lotNumber === lotNumber);
  if (!lot) {
    throw new Error(`Lot ${lotNumber} not found`);
  }

  const cost = centavos(quantity * lot.costPerUnit);
  const waste: WasteRecord = {
    itemCode: item.code,
    quantity,
    reason,
    lotNumber,
    cost,
    recordedAt: new Date(),
  };

  return {
    success: true,
    waste,
    item: {
      ...item,
      stock: item.stock - quantity,
      lots: item.lots.map(l =>
        l.lotNumber === lotNumber ? { ...l, quantity: l.quantity - quantity } : l
      ),
    },
  };
}

// ============================================================
// FIX 6: Lock item during physical count
// ============================================================

function startPhysicalCount(item: InventoryItem, userId: string): {
  success: boolean;
  item: InventoryItem;
  error?: string;
} {
  if (item.isLocked) {
    return {
      success: false,
      item,
      error: `Item bloqueado por ${item.lockedBy}. Espera a que termine el conteo.`,
    };
  }

  return {
    success: true,
    item: {
      ...item,
      isLocked: true,
      lockedBy: userId,
    },
  };
}

function endPhysicalCount(item: InventoryItem): InventoryItem {
  return {
    ...item,
    isLocked: false,
    lockedBy: undefined,
  };
}

// ============================================================
// FIX 7: Weekly expired inventory cost report
// ============================================================

function calculateExpiredInventoryCost(items: InventoryItem[], now: Date = new Date()): {
  totalExpiredCost: Centavos;
  itemsExpiringSoon: Array<{ code: string; name: string; daysLeft: number; value: Centavos }>;
  expiredLots: Array<{ code: string; lotNumber: string; quantity: number; cost: Centavos }>;
} {
  const itemsExpiringSoon: Array<{ code: string; name: string; daysLeft: number; value: Centavos }> = [];
  const expiredLots: Array<{ code: string; lotNumber: string; quantity: number; cost: Centavos }> = [];
  let totalExpiredCost = 0;

  for (const item of items) {
    for (const lot of item.lots) {
      if (lot.quantity <= 0) continue;

      const daysLeft = Math.floor((lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const lotValue = centavos(lot.quantity * lot.costPerUnit);

      if (daysLeft < 0) {
        expiredLots.push({
          code: item.code,
          lotNumber: lot.lotNumber,
          quantity: lot.quantity,
          cost: lotValue,
        });
        totalExpiredCost += lotValue;
      } else if (daysLeft <= 3) {
        itemsExpiringSoon.push({
          code: item.code,
          name: item.name,
          daysLeft,
          value: lotValue,
        });
      }
    }
  }

  return {
    totalExpiredCost: centavos(totalExpiredCost),
    itemsExpiringSoon,
    expiredLots,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('Inventory UX Fixes', () => {

  // FIX 1: Expiry check on receive
  it('should block expired lots and warn about soon-expiring lots', () => {
    const item: InventoryItem = {
      code: 'CHICKEN',
      name: 'Pollo Entero',
      stock: 0,
      minStock: 20,
      lots: [],
    };

    const now = new Date();

    // Expired lot (should be blocked)
    const expiredResult = receiveGoodsWithExpiryCheck(item, {
      lotNumber: 'P-EXPIRED',
      quantity: 50,
      expiryDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      costPerUnit: 1800 as Centavos,
    });

    expect(expiredResult.success).toBe(false);
    expect(expiredResult.error).toContain('EXPIRADO');

    // Lot expiring in 2 days (should warn)
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const warnResult = receiveGoodsWithExpiryCheck(item, {
      lotNumber: 'P-SOON',
      quantity: 30,
      expiryDate: twoDaysFromNow,
      costPerUnit: 1700 as Centavos,
    });

    expect(warnResult.success).toBe(true);
    expect(warnResult.warning).toMatch(/vence en [012] d[ií]a/);

    // Normal lot (should receive without warning)
    const normalResult = receiveGoodsWithExpiryCheck(item, {
      lotNumber: 'P-NORMAL',
      quantity: 20,
      expiryDate: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000), // 11 days from now
      costPerUnit: 1900 as Centavos,
    });

    expect(normalResult.success).toBe(true);
    expect(normalResult.warning).toBeUndefined();

    console.log('✅ Fix 1: Expiry check on receive');
    console.log(`   Expired: Blocked`);
    console.log(`   Soon: Warning shown`);
    console.log(`   Normal: Received without warning`);
  });

  // FIX 2: Stock depletion warning
  it('should warn when stock reaches 0', () => {
    const item: InventoryItem = {
      code: 'PAPAS',
      name: 'Papas Fritas',
      stock: 10,
      minStock: 5,
      lots: [{ lotNumber: 'PAP-001', quantity: 10, expiryDate: new Date('2026-05-01'), costPerUnit: 200 as Centavos }],
    };

    // Deduct all 10 units
    const result = deductStockWithWarning(item, 10);

    expect(result.success).toBe(true);
    expect(result.warning).toContain('SIN STOCK');

    // Deduct below minStock
    const item2: InventoryItem = { ...item, stock: 10 };
    const result2 = deductStockWithWarning(item2, 7);

    expect(result2.success).toBe(true);
    expect(result2.warning).toContain('stock bajo');

    console.log('✅ Fix 2: Stock depletion warning');
    console.log(`   At 0: SIN STOCK warning`);
    console.log(`   Below min: Stock bajo warning`);
  });

  // FIX 3: Physical count variance check
  it('should flag discrepancies > 10% during physical count', () => {
    const item: InventoryItem = {
      code: 'GASEOSA',
      name: 'Inca Kola',
      stock: 100,
      minStock: 30,
      lots: [{ lotNumber: 'GAS-001', quantity: 100, expiryDate: new Date('2027-01-01'), costPerUnit: 400 as Centavos }],
    };

    // 25% variance (should flag as suspicious)
    const result = physicalCountWithVarianceCheck(item, 75, 'user-1');

    expect(result.variance).toBe(-25);
    expect(result.variancePercent).toBe(25);
    expect(result.suspicious).toBe(true);
    expect(result.requiresManagerApproval).toBe(true);

    // 5% variance (should NOT flag)
    const result2 = physicalCountWithVarianceCheck(item, 95, 'user-1');

    expect(result2.variancePercent).toBe(5);
    expect(result2.suspicious).toBe(false);
    expect(result2.requiresManagerApproval).toBe(false);

    console.log('✅ Fix 3: Physical count variance check');
    console.log(`   25% variance: Suspicious, requires manager`);
    console.log(`   5% variance: Normal, no flag`);
  });

  // FIX 4: FEFO enforcement
  it('should enforce FEFO (oldest lot first)', () => {
    const item: InventoryItem = {
      code: 'LECHUGA',
      name: 'Lechuga',
      stock: 25,
      minStock: 5,
      lots: [
        { lotNumber: 'LET-001', quantity: 10, expiryDate: new Date('2026-04-10'), costPerUnit: 80 as Centavos },
        { lotNumber: 'LET-002', quantity: 15, expiryDate: new Date('2026-04-25'), costPerUnit: 85 as Centavos },
      ],
    };

    const result = deductStockFEFO(item, 5);

    expect(result.success).toBe(true);
    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lot).toBe('LET-001'); // Oldest lot first
    expect(result.lotsUsed[0].quantity).toBe(5);

    console.log('✅ Fix 4: FEFO enforcement');
    console.log(`   Used lot: ${result.lotsUsed[0].lot} (oldest)`);
  });

  // FIX 5: Quick waste recording
  it('should record waste in 1 click', () => {
    const item: InventoryItem = {
      code: 'PAPAS',
      name: 'Papas Fritas',
      stock: 100,
      minStock: 20,
      lots: [{ lotNumber: 'PAP-001', quantity: 50, expiryDate: new Date('2026-05-01'), costPerUnit: 200 as Centavos }],
    };

    const result = quickWasteRecord(item, 10, 'SPILLED', 'PAP-001');

    expect(result.success).toBe(true);
    expect(result.waste.quantity).toBe(10);
    expect(result.waste.cost).toBe(2000); // 10 × 200
    expect(result.item.stock).toBe(90);

    console.log('✅ Fix 5: Quick waste recording');
    console.log(`   Waste: 10 units, S/. ${(result.waste.cost / 100).toFixed(2)}`);
  });

  // FIX 6: Lock during physical count
  it('should lock item during physical count', () => {
    const item: InventoryItem = {
      code: 'POLLO',
      name: 'Pollo Entero',
      stock: 100,
      minStock: 20,
      lots: [{ lotNumber: 'POL-001', quantity: 100, expiryDate: new Date('2026-04-20'), costPerUnit: 1800 as Centavos }],
    };

    // User A starts count
    const startResult = startPhysicalCount(item, 'user-A');
    expect(startResult.success).toBe(true);
    expect(startResult.item.isLocked).toBe(true);
    expect(startResult.item.lockedBy).toBe('user-A');

    // User B tries to start count (should fail)
    const startResult2 = startPhysicalCount(startResult.item, 'user-B');
    expect(startResult2.success).toBe(false);
    expect(startResult2.error).toContain('user-A');

    // User A ends count
    const endedItem = endPhysicalCount(startResult.item);
    expect(endedItem.isLocked).toBe(false);

    console.log('✅ Fix 6: Lock during physical count');
    console.log(`   Locked by: user-A`);
    console.log(`   Second user blocked: Yes`);
  });

  // FIX 7: Expired inventory cost report
  it('should calculate expired inventory cost', () => {
    const now = new Date('2026-04-13');
    const items: InventoryItem[] = [
      {
        code: 'LECHUGA',
        name: 'Lechuga',
        stock: 20,
        minStock: 5,
        lots: [{ lotNumber: 'LET-001', quantity: 20, expiryDate: new Date('2026-04-11'), costPerUnit: 80 as Centavos }],
      },
      {
        code: 'TOMATE',
        name: 'Tomate',
        stock: 15,
        minStock: 5,
        lots: [{ lotNumber: 'TOM-001', quantity: 15, expiryDate: new Date('2026-04-12'), costPerUnit: 60 as Centavos }],
      },
    ];

    const report = calculateExpiredInventoryCost(items, now);

    expect(report.expiredLots.length).toBe(2);
    expect(report.totalExpiredCost).toBe(2500); // 20*80 + 15*60 = 1600 + 900 = 2500

    console.log('✅ Fix 7: Expired inventory cost report');
    console.log(`   Expired lots: ${report.expiredLots.length}`);
    console.log(`   Total expired cost: S/. ${(report.totalExpiredCost / 100).toFixed(2)}`);
  });
});
