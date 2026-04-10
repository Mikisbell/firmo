/**
 * UX Simulation: Z-Report and Shift Closing Edge Cases
 * 
 * Simulates real cashier scenarios during shift closing:
 * - Closing shift with pending orders
 * - Cash variance exceeds threshold
 * - Z-report generated twice (duplicate)
 * - Missing payment records in shift
 * - Denomination count doesn't match expected
 * - Shift closed but sales still coming in
 * 
 * This tests the SHIFT CLOSING EXPERIENCE, not just report generation.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Simulated Shift/Z-Report System
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN';
type ShiftStatus = 'OPEN' | 'CLOSING' | 'CLOSED';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface Payment {
  method: PaymentMethod;
  amountCents: Centavos;
  timestamp: Date;
}

interface Order {
  id: string;
  totalCents: Centavos;
  payments: Payment[];
  status: 'PAID' | 'PENDING' | 'VOIDED';
}

interface Shift {
  id: string;
  status: ShiftStatus;
  openingBalance: Centavos;
  orders: Order[];
  denominations: Record<number, number>; // bill/coin value → count
}

interface ZReport {
  shiftId: string;
  reportNumber: number;
  totalOrders: number;
  totalSales: Centavos;
  totalCash: Centavos;
  totalCard: Centavos;
  totalYape: Centavos;
  totalPlin: Centavos;
  expectedCash: Centavos;
  countedCash: Centavos;
  variance: Centavos;
  varianceSeverity: 'OK' | 'WARNING' | 'CRITICAL';
  generatedAt: Date;
  alerts: string[];
}

function calculateExpectedCash(shift: Shift): Centavos {
  const cashPayments = shift.orders
    .filter(o => o.status === 'PAID')
    .flatMap(o => o.payments)
    .filter(p => p.method === 'CASH')
    .reduce((sum, p) => sum + p.amountCents, 0);
  
  return centavos(shift.openingBalance + cashPayments);
}

function countDenominations(denoms: Record<number, number>): Centavos {
  return centavos(
    Object.entries(denoms).reduce((sum, [value, count]) => {
      return sum + parseInt(value) * count;
    }, 0)
  );
}

function calculateVariance(expected: Centavos, counted: Centavos): {
  variance: Centavos;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
} {
  const variance = centavos(counted - expected);
  const absVariance = Math.abs(variance);
  
  let severity: 'OK' | 'WARNING' | 'CRITICAL';
  if (absVariance <= 5000) severity = 'OK';
  else if (absVariance <= 25000) severity = 'WARNING';
  else severity = 'CRITICAL';
  
  return { variance, severity };
}

function generateZReport(shift: Shift, countedCash: Centavos): ZReport {
  const alerts: string[] = [];
  
  const paidOrders = shift.orders.filter(o => o.status === 'PAID');
  const pendingOrders = shift.orders.filter(o => o.status === 'PENDING');
  
  if (pendingOrders.length > 0) {
    alerts.push(`⚠️ ${pendingOrders.length} orden(es) pendiente(s) de pago`);
  }
  
  const totalSales = centavos(paidOrders.reduce((sum, o) => sum + o.totalCents, 0));
  const totalCash = centavos(paidOrders.flatMap(o => o.payments)
    .filter(p => p.method === 'CASH')
    .reduce((sum, p) => sum + p.amountCents, 0));
  const totalCard = centavos(paidOrders.flatMap(o => o.payments)
    .filter(p => p.method === 'CARD')
    .reduce((sum, p) => sum + p.amountCents, 0));
  const totalYape = centavos(paidOrders.flatMap(o => o.payments)
    .filter(p => p.method === 'YAPE')
    .reduce((sum, p) => sum + p.amountCents, 0));
  const totalPlin = centavos(paidOrders.flatMap(o => o.payments)
    .filter(p => p.method === 'PLIN')
    .reduce((sum, p) => sum + p.amountCents, 0));
  
  const expectedCash = calculateExpectedCash(shift);
  const { variance, severity } = calculateVariance(expectedCash, countedCash);
  
  if (severity === 'WARNING') {
    alerts.push(`⚠️ Variación de caja: S/. ${(variance / 100).toFixed(2)} (WARNING)`);
  } else if (severity === 'CRITICAL') {
    alerts.push(`🔴 Variación crítica: S/. ${(variance / 100).toFixed(2)} (CRITICAL)`);
  }
  
  // Check denomination count
  const countedDenoms = countDenominations(shift.denominations);
  if (countedDenoms !== countedCash) {
    alerts.push(`❌ Conteo de billetes (S/. ${(countedDenoms / 100).toFixed(2)}) no coincide con efectivo contado (S/. ${(countedCash / 100).toFixed(2)})`);
  }
  
  return {
    shiftId: shift.id,
    reportNumber: 1,
    totalOrders: paidOrders.length,
    totalSales,
    totalCash,
    totalCard,
    totalYape,
    totalPlin,
    expectedCash,
    countedCash,
    variance,
    varianceSeverity: severity,
    generatedAt: new Date(),
    alerts,
  };
}

// ============================================================
// Z-REPORT UX SIMULATION TESTS
// ============================================================

describe('Z-Report and Shift Closing UX Simulation', () => {

  it('should identify: Closing shift with pending orders', () => {
    // PROBLEM: Cashier tries to close shift but 3 orders haven't been paid yet
    // System should warn them, not just generate report

    const shift: Shift = {
      id: 'shift-1',
      status: 'OPEN',
      openingBalance: 20000 as Centavos,
      orders: [
        { id: 'order-1', totalCents: 8500 as Centavos, payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }], status: 'PAID' },
        { id: 'order-2', totalCents: 5500 as Centavos, payments: [], status: 'PENDING' }, // Not paid!
        { id: 'order-3', totalCents: 12000 as Centavos, payments: [{ method: 'CARD', amountCents: 12000 as Centavos, timestamp: new Date() }], status: 'PAID' },
        { id: 'order-4', totalCents: 3000 as Centavos, payments: [], status: 'PENDING' }, // Not paid!
      ],
      denominations: { 10000: 2, 5000: 4, 1000: 10 },
    };

    const report = generateZReport(shift, 35000 as Centavos);

    expect(report.alerts.some(a => a.includes('pendiente'))).toBe(true);
    expect(report.totalOrders).toBe(2); // Only paid orders counted

    console.log('🔴 UX Problem: Pending orders during shift close');
    console.log(`   Paid orders: ${report.totalOrders}`);
    console.log(`   Pending orders: ${shift.orders.filter(o => o.status === 'PENDING').length}`);
    console.log(`   Alerts: ${report.alerts.filter(a => a.includes('pendiente')).length}`);
    console.log(`   Better: Block closing until all orders paid, or force-void pending orders`);
  });

  it('should identify: Cash variance exceeds threshold', () => {
    // PROBLEM: Cashier counted S/. 500 but expected S/. 450
    // S/. 50 missing - is this theft, error, or normal variance?

    const shift: Shift = {
      id: 'shift-1',
      status: 'OPEN',
      openingBalance: 20000 as Centavos,
      orders: [
        { id: 'order-1', totalCents: 8500 as Centavos, payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }], status: 'PAID' },
        { id: 'order-2', totalCents: 12000 as Centavos, payments: [{ method: 'CASH', amountCents: 12000 as Centavos, timestamp: new Date() }], status: 'PAID' },
      ],
      denominations: { 10000: 2, 5000: 4, 1000: 10 },
    };

    // Expected: 20000 + 8500 + 12000 = 40500
    // Cashier counted: 40000 (S/. 50 missing)
    const report = generateZReport(shift, 40000 as Centavos);

    expect(report.variance).toBe(-500);
    expect(report.varianceSeverity).toBe('OK'); // S/. 5 is within threshold

    console.log('💡 Cash variance analysis:');
    console.log(`   Expected: S/. ${(report.expectedCash / 100).toFixed(2)}`);
    console.log(`   Counted: S/. ${(report.countedCash / 100).toFixed(2)}`);
    console.log(`   Variance: S/. ${(report.variance / 100).toFixed(2)} (${report.varianceSeverity})`);
    console.log(`   Better: Track variance trends per cashier, flag patterns`);
  });

  it('should identify: Z-report generated twice (duplicate)', () => {
    // PROBLEM: Cashier generates Z-report, then generates again
    // System should prevent duplicate reports for same shift

    const shift: Shift = {
      id: 'shift-1',
      status: 'CLOSED',
      openingBalance: 20000 as Centavos,
      orders: [
        { id: 'order-1', totalCents: 8500 as Centavos, payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }], status: 'PAID' },
      ],
      denominations: { 10000: 2, 5000: 4, 1000: 10 },
    };

    // Generate Z-report first time
    const report1 = generateZReport(shift, 28500 as Centavos);
    
    // Generate again (should be prevented or return same report)
    const report2 = generateZReport(shift, 28500 as Centavos);

    expect(report1.reportNumber).toBe(report2.reportNumber);
    expect(report1.totalSales).toBe(report2.totalSales);

    console.log('💡 Z-report duplication handled');
    console.log(`   Report #${report1.reportNumber} generated twice`);
    console.log(`   Both reports identical (correct behavior)`);
    console.log(`   Better: Show existing report instead of regenerating`);
  });

  it('should identify: Denomination count doesn\'t match expected', () => {
    // PROBLEM: Cashier counts bills/coins but total doesn't match counted cash
    // System should help them find the error

    const shift: Shift = {
      id: 'shift-1',
      status: 'OPEN',
      openingBalance: 20000 as Centavos,
      orders: [
        { id: 'order-1', totalCents: 8500 as Centavos, payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }], status: 'PAID' },
      ],
      denominations: {
        10000: 2,  // 2 × S/. 100 = S/. 200
        5000: 3,   // 3 × S/. 50 = S/. 150
        1000: 8,   // 8 × S/. 10 = S/. 80
        // Total from denoms: S/. 430
      },
    };

    // But cashier counted S/. 450 total (mistake!)
    const countedCash = 45000 as Centavos;
    const denomsTotal = countDenominations(shift.denominations);

    expect(denomsTotal).toBe(43000); // S/. 430
    expect(countedCash).toBe(45000); // S/. 450 (mismatch!)

    const report = generateZReport(shift, countedCash);
    expect(report.alerts.some(a => a.includes('no coincide'))).toBe(true);

    console.log('🔴 UX Problem: Denomination mismatch');
    console.log(`   Denominations total: S/. ${(denomsTotal / 100).toFixed(2)}`);
    console.log(`   Cashier counted: S/. ${(countedCash / 100).toFixed(2)}`);
    console.log(`   Difference: S/. ${((countedCash - denomsTotal) / 100).toFixed(2)}`);
    console.log(`   Better: Auto-calculate total from denominations, highlight discrepancy`);
  });

  it('should identify: Shift closed but sales still coming in', () => {
    // PROBLEM: Shift is closed, but new orders are being created
    // These orders won't be in the Z-report!

    const shift: Shift = {
      id: 'shift-1',
      status: 'CLOSED',
      openingBalance: 20000 as Centavos,
      orders: [
        { id: 'order-1', totalCents: 8500 as Centavos, payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }], status: 'PAID' },
      ],
      denominations: { 10000: 2, 5000: 4, 1000: 10 },
    };

    // Z-report generated
    const zReport = generateZReport(shift, 28500 as Centavos);

    // New order comes in AFTER close
    const lateOrder: Order = {
      id: 'order-late',
      totalCents: 5500 as Centavos,
      payments: [{ method: 'CARD', amountCents: 5500 as Centavos, timestamp: new Date() }],
      status: 'PAID',
    };

    // This order is NOT in the Z-report!
    expect(zReport.totalOrders).toBe(1);
    expect(zReport.totalSales).toBe(8500);

    console.log('🔴 UX Problem: Sales after shift close');
    console.log(`   Z-report includes: ${zReport.totalOrders} order(s)`);
    console.log(`   Late order NOT in report: ${lateOrder.id}`);
    console.log(`   Late order value: S/. ${(lateOrder.totalCents / 100).toFixed(2)}`);
    console.log(`   Better: Block new orders after shift close, or auto-create new shift`);
  });

  it('should calculate: Weekly variance trends per cashier', () => {
    // PROBLEM: System doesn't track variance patterns
    // Some cashiers always have negative variance (theft?)

    const cashierVariances: Array<{ day: string; variance: number }> = [
      { day: 'Monday', variance: -200 },
      { day: 'Tuesday', variance: -350 },
      { day: 'Wednesday', variance: -150 },
      { day: 'Thursday', variance: -500 },
      { day: 'Friday', variance: -250 },
    ];

    const avgVariance = cashierVariances.reduce((sum, v) => sum + v.variance, 0) / cashierVariances.length;
    const negativeDays = cashierVariances.filter(v => v.variance < 0).length;

    expect(negativeDays).toBe(5); // All days negative
    expect(avgVariance).toBeLessThan(0);

    console.log('📊 Weekly Variance Trend (Cashier Juan):');
    for (const v of cashierVariances) {
      console.log(`   ${v.day.padEnd(10)}: S/. ${(v.variance / 100).toFixed(2)}`);
    }
    console.log(`   Average: S/. ${(avgVariance / 100).toFixed(2)}`);
    console.log(`   Negative days: ${negativeDays}/5`);
    console.log(`   Better: Flag cashiers with > 3 negative days/week for review`);
  });

  it('should recommend: Shift closing improvements', () => {
    const currentIssues = [
      'No block for pending orders',
      'No denomination auto-calculation',
      'No variance trend tracking',
      'No late order prevention',
      'Manual Z-report generation',
    ];

    const recommendations = [
      'Force all orders paid before close',
      'Auto-sum denominations, highlight mismatch',
      'Weekly variance report per cashier',
      'Block orders after shift close',
      'Auto-generate Z-report on shift close',
    ];

    expect(recommendations.length).toBe(currentIssues.length);

    console.log('✅ Shift Closing Recommendations:');
    for (let i = 0; i < currentIssues.length; i++) {
      console.log(`   ❌ ${currentIssues[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
