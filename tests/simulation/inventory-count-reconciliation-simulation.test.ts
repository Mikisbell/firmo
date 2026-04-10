/**
 * UX Simulation: Inventory Physical Count and Reconciliation
 * 
 * Simulates real inventory counting scenarios:
 * - Scheduled monthly physical count
 * - Counters find discrepancies vs system stock
 * - Variance analysis by category/product
 * - Manager investigation of large variances
 * - Stock adjustments after count
 * - Cost impact of discrepancies
 * - Cycle counting (counting subset daily)
 * 
 * This tests INVENTORY ACCURACY, not just stock tracking.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface InventoryItem {
  code: string;
  name: string;
  category: string;
  systemStock: number;
  unit: string;
  costPerUnitCents: Centavos;
}

interface CountResult {
  itemCode: string;
  systemStock: number;
  countedStock: number;
  variance: number;
  variancePercent: number;
  valueVarianceCents: Centavos;
  status: 'MATCH' | 'OVER' | 'UNDER';
  notes?: string;
}

interface CountSession {
  sessionId: string;
  date: Date;
  countedBy: string;
  verifiedBy: string;
  results: CountResult[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
  totalItemsCounted: number;
  totalMatches: number;
  totalOver: number;
  totalUnder: number;
  accuracyRate: number;
  totalValueVarianceCents: Centavos;
}

interface CycleCountPlan {
  category: string;
  itemsCount: number;
  countFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  lastCounted: Date;
  nextCount: Date;
}

function performPhysicalCount(items: InventoryItem[], countedQuantities: Map<string, number>): CountSession {
  const results: CountResult[] = [];
  let totalMatches = 0;
  let totalOver = 0;
  let totalUnder = 0;
  let totalValueVariance = 0;

  for (const item of items) {
    const countedStock = countedQuantities.get(item.code) ?? 0;
    const variance = countedStock - item.systemStock;
    const variancePercent = item.systemStock > 0 ? Math.abs(variance) / item.systemStock * 100 : 0;
    const valueVarianceCents = centavos(variance * item.costPerUnitCents);

    let status: 'MATCH' | 'OVER' | 'UNDER';
    if (variance === 0) {
      status = 'MATCH';
      totalMatches++;
    } else if (variance > 0) {
      status = 'OVER';
      totalOver++;
    } else {
      status = 'UNDER';
      totalUnder++;
    }

    results.push({
      itemCode: item.code,
      systemStock: item.systemStock,
      countedStock,
      variance,
      variancePercent,
      valueVarianceCents,
      status,
    });

    totalValueVariance += valueVarianceCents;
  }

  return {
    sessionId: `count-${Date.now()}`,
    date: new Date(),
    countedBy: 'Carlos López',
    verifiedBy: 'María García',
    results,
    status: 'COMPLETED',
    totalItemsCounted: items.length,
    totalMatches,
    totalOver,
    totalUnder,
    accuracyRate: items.length > 0 ? (totalMatches / items.length) * 100 : 0,
    totalValueVarianceCents: centavos(totalValueVariance),
  };
}

function analyzeVarianceByCategory(session: CountSession): Array<{
  category: string;
  itemsCount: number;
  totalVariance: number;
  totalValueVarianceCents: Centavos;
  accuracyRate: number;
}> {
  const categoryMap = new Map<string, { items: number; variance: number; valueVariance: number; matches: number }>();

  for (const result of session.results) {
    // In real system, we'd join with item data to get category
    // Here we simulate based on code patterns
    let category = 'OTHER';
    if (result.itemCode.startsWith('POLLO')) category = 'POLLOS';
    else if (result.itemCode.startsWith('PAPAS')) category = 'GUARNICIONES';
    else if (result.itemCode.startsWith('BEBIDA') || result.itemCode.startsWith('INCA') || result.itemCode.startsWith('COCA')) category = 'BEBIDAS';
    else if (result.itemCode.startsWith('SALSA')) category = 'SALSAS';

    const cat = categoryMap.get(category) || { items: 0, variance: 0, valueVariance: 0, matches: 0 };
    cat.items++;
    cat.variance += Math.abs(result.variance);
    cat.valueVariance += result.valueVarianceCents;
    if (result.status === 'MATCH') cat.matches++;
    categoryMap.set(category, cat);
  }

  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    itemsCount: data.items,
    totalVariance: data.variance,
    totalValueVarianceCents: centavos(data.valueVariance),
    accuracyRate: data.items > 0 ? (data.matches / data.items) * 100 : 0,
  }));
}

function generateCycleCountPlan(items: InventoryItem[]): CycleCountPlan[] {
  const categoryMap = new Map<string, InventoryItem[]>();
  
  for (const item of items) {
    if (!categoryMap.has(item.category)) categoryMap.set(item.category, []);
    categoryMap.get(item.category)!.push(item);
  }

  const plans: CycleCountPlan[] = [];
  const now = new Date();

  for (const [category, catItems] of categoryMap) {
    // High-value items counted daily, low-value monthly
    const avgCost = catItems.reduce((sum, i) => sum + i.costPerUnitCents, 0) / catItems.length;
    let frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    if (avgCost > 1500) frequency = 'DAILY';
    else if (avgCost > 500) frequency = 'WEEKLY';
    else frequency = 'MONTHLY';

    const nextCount = new Date(now);
    if (frequency === 'DAILY') nextCount.setDate(nextCount.getDate() + 1);
    else if (frequency === 'WEEKLY') nextCount.setDate(nextCount.getDate() + 7);
    else nextCount.setDate(nextCount.getDate() + 30);

    plans.push({
      category,
      itemsCount: catItems.length,
      countFrequency: frequency,
      lastCounted: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      nextCount,
    });
  }

  return plans;
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// INVENTORY COUNT SIMULATION TESTS
// ============================================================

describe('Inventory Physical Count and Reconciliation Simulation', () => {

  it('should simulate monthly physical count with discrepancies', () => {
    // SCENARIO: Monthly count of 20 items, several discrepancies found
    const items: InventoryItem[] = [
      { code: 'POLLO-ENT', name: 'Pollo Entero', category: 'POLLOS', systemStock: 100, unit: 'unit', costPerUnitCents: 1800 as Centavos },
      { code: 'POLLO-1/2', name: '1/2 Pollo', category: 'POLLOS', systemStock: 50, unit: 'unit', costPerUnitCents: 900 as Centavos },
      { code: 'PAPAS-GDE', name: 'Papas Grande', category: 'GUARNICIONES', systemStock: 200, unit: 'kg', costPerUnitCents: 250 as Centavos },
      { code: 'PAPAS-MED', name: 'Papas Mediana', category: 'GUARNICIONES', systemStock: 150, unit: 'kg', costPerUnitCents: 200 as Centavos },
      { code: 'INCA-1.5L', name: 'Inca Kola 1.5L', category: 'BEBIDAS', systemStock: 300, unit: 'unit', costPerUnitCents: 600 as Centavos },
      { code: 'COCA-500', name: 'Coca Cola 500ml', category: 'BEBIDAS', systemStock: 200, unit: 'unit', costPerUnitCents: 350 as Centavos },
      { code: 'SALSA-AJI', name: 'Ají', category: 'SALSAS', systemStock: 50, unit: 'unit', costPerUnitCents: 100 as Centavos },
    ];

    // Counted quantities (some match, some don't)
    const countedQuantities = new Map<string, number>([
      ['POLLO-ENT', 95],    // 5 missing
      ['POLLO-1/2', 50],    // Match!
      ['PAPAS-GDE', 190],   // 10 missing
      ['PAPAS-MED', 155],   // 5 extra
      ['INCA-1.5L', 295],   // 5 missing
      ['COCA-500', 200],    // Match!
      ['SALSA-AJI', 48],    // 2 missing
    ]);

    const session = performPhysicalCount(items, countedQuantities);

    expect(session.totalItemsCounted).toBe(7);
    expect(session.totalMatches).toBe(2);
    expect(session.totalUnder).toBe(4);
    expect(session.totalOver).toBe(1);
    expect(session.accuracyRate).toBeCloseTo(28.6, 0); // 2/7 = 28.6%

    // Find the largest variance
    const largestVariance = session.results.reduce((max, r) => Math.abs(r.variance) > Math.abs(max.variance) ? r : max, session.results[0]);

    console.log('📋 Monthly Physical Count Results:');
    console.log(`   Items Counted: ${session.totalItemsCounted}`);
    console.log(`   Matches: ${session.totalMatches}`);
    console.log(`   Under: ${session.totalUnder}`);
    console.log(`   Over: ${session.totalOver}`);
    console.log(`   Accuracy: ${session.accuracyRate.toFixed(1)}%`);
    console.log(`   Largest Variance: ${largestVariance.itemCode} (${largestVariance.variance} units)`);
    console.log(`   Total Value Variance: S/. ${(Math.abs(session.totalValueVarianceCents) / 100).toFixed(2)}`);
  });

  it('should analyze variances by category to find problem areas', () => {
    // SCENARIO: Business wants to know which categories have the most issues
    const items: InventoryItem[] = [
      { code: 'POLLO-ENT', name: 'Pollo Entero', category: 'POLLOS', systemStock: 100, unit: 'unit', costPerUnitCents: 1800 as Centavos },
      { code: 'POLLO-1/2', name: '1/2 Pollo', category: 'POLLOS', systemStock: 50, unit: 'unit', costPerUnitCents: 900 as Centavos },
      { code: 'PAPAS-GDE', name: 'Papas Grande', category: 'GUARNICIONES', systemStock: 200, unit: 'kg', costPerUnitCents: 250 as Centavos },
      { code: 'INCA-1.5L', name: 'Inca Kola 1.5L', category: 'BEBIDAS', systemStock: 300, unit: 'unit', costPerUnitCents: 600 as Centavos },
    ];

    const countedQuantities = new Map<string, number>([
      ['POLLO-ENT', 90],    // 10 missing
      ['POLLO-1/2', 50],    // Match
      ['PAPAS-GDE', 195],   // 5 missing
      ['INCA-1.5L', 295],   // 5 missing
    ]);

    const session = performPhysicalCount(items, countedQuantities);
    const categoryAnalysis = analyzeVarianceByCategory(session);

    const pollosCategory = categoryAnalysis.find(c => c.category === 'POLLOS');
    expect(pollosCategory).toBeDefined();
    expect(pollosCategory?.accuracyRate).toBe(50); // 1 match out of 2

    console.log('📊 Variance Analysis by Category:');
    for (const cat of categoryAnalysis) {
      console.log(`   ${cat.category}: ${cat.itemsCount} items, ${cat.totalVariance} variance, ${cat.accuracyRate.toFixed(0)}% accuracy`);
    }
  });

  it('should generate cycle counting plan based on item value', () => {
    // SCENARIO: High-value items counted more frequently
    const items: InventoryItem[] = [
      { code: 'POLLO-ENT', name: 'Pollo Entero', category: 'POLLOS', systemStock: 100, unit: 'unit', costPerUnitCents: 1800 as Centavos },
      { code: 'PAPAS-GDE', name: 'Papas Grande', category: 'GUARNICIONES', systemStock: 200, unit: 'kg', costPerUnitCents: 250 as Centavos },
      { code: 'SALSA-AJI', name: 'Ají', category: 'SALSAS', systemStock: 50, unit: 'unit', costPerUnitCents: 100 as Centavos },
    ];

    const plan = generateCycleCountPlan(items);

    // Pollos (S/. 18.00 each) should be counted daily
    const pollosPlan = plan.find(p => p.category === 'POLLOS');
    expect(pollosPlan?.countFrequency).toBe('DAILY');

    // Papas (S/. 2.50 each) should be counted weekly or monthly (based on avg cost logic)
    const papasPlan = plan.find(p => p.category === 'GUARNICIONES');
    expect(papasPlan?.countFrequency === 'WEEKLY' || papasPlan?.countFrequency === 'MONTHLY').toBe(true);

    // Salsas (S/. 1.00 each) should be counted monthly
    const salsasPlan = plan.find(p => p.category === 'SALSAS');
    expect(salsasPlan?.countFrequency).toBe('MONTHLY');

    console.log('📅 Cycle Count Plan:');
    for (const p of plan) {
      console.log(`   ${p.category}: ${p.countFrequency} (${p.itemsCount} items)`);
    }
  });

  it('should calculate financial impact of inventory discrepancies', () => {
    // SCENARIO: Business needs to know $ impact of count variances
    const items: InventoryItem[] = [
      { code: 'POLLO-ENT', name: 'Pollo Entero', category: 'POLLOS', systemStock: 100, unit: 'unit', costPerUnitCents: 1800 as Centavos },
      { code: 'POLLO-1/2', name: '1/2 Pollo', category: 'POLLOS', systemStock: 50, unit: 'unit', costPerUnitCents: 900 as Centavos },
      { code: 'PAPAS-GDE', name: 'Papas Grande', category: 'GUARNICIONES', systemStock: 200, unit: 'kg', costPerUnitCents: 250 as Centavos },
    ];

    const countedQuantities = new Map<string, number>([
      ['POLLO-ENT', 92],    // 8 missing × S/. 18.00 = S/. 144.00
      ['POLLO-1/2', 48],    // 2 missing × S/. 9.00 = S/. 18.00
      ['PAPAS-GDE', 195],   // 5 missing × S/. 2.50 = S/. 12.50
    ]);

    const session = performPhysicalCount(items, countedQuantities);

    const totalMissingValue = session.results
      .filter(r => r.status === 'UNDER')
      .reduce((sum, r) => sum + Math.abs(r.valueVarianceCents), 0);

    expect(totalMissingValue).toBe(17450); // S/. 174.50

    console.log('💰 Financial Impact of Discrepancies:');
    for (const r of session.results.filter(r => r.status !== 'MATCH')) {
      console.log(`   ${r.itemCode}: ${Math.abs(r.variance)} units × S/. ${(r.valueVarianceCents / Math.abs(r.variance) / 100).toFixed(2)} = S/. ${(Math.abs(r.valueVarianceCents) / 100).toFixed(2)}`);
    }
    console.log(`   Total Missing: S/. ${(totalMissingValue / 100).toFixed(2)}`);
    console.log(`   Monthly Loss Rate: ${(totalMissingValue / 100).toFixed(2)} / month`);
    console.log(`   Annual Projection: S/. ${(totalMissingValue * 12 / 100).toFixed(2)}`);
  });

  it('should recommend: Inventory count improvements', () => {
    const currentGaps = [
      'No barcode scanning for counts',
      'No cycle counting automation',
      'No variance investigation workflow',
      'No historical count trend analysis',
      'No automatic stock adjustment after approval',
      'No integration with purchase orders for receiving variances',
    ];

    const recommendations = [
      'Mobile app with barcode scanner, auto-populate system stock, enter count only',
      'Auto-generate daily count list for high-value items, weekly for medium, monthly for low',
      'When variance > 5%, auto-create investigation ticket: root cause, responsible, action',
      'Dashboard showing count accuracy over time by item/category/counter, identify patterns',
      'After manager approval, auto-adjust system stock to counted values, log adjustment',
      'Compare received vs ordered quantities, flag supplier short-shipping, track over time',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Inventory Count Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
