/**
 * UX Simulation: Cash Register Handover Between Shifts
 * 
 * Simulates real shift handover scenarios:
 * - Morning cashier closes shift, evening cashier opens
 * - Cash count verification between shifts
 * - Pending orders handover
 * - Discrepancy detection and resolution
 * - Manager approval for large variances
 * 
 * This tests SHIFT HANDOVER PROCESS, not just individual shifts.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface ShiftCashCount {
  bill200: number; // S/. 200
  bill100: number; // S/. 100
  bill50: number;  // S/. 50
  bill20: number;  // S/. 20
  bill10: number;  // S/. 10
  coin5: number;   // S/. 5
  coin2: number;   // S/. 2
  coin1: number;   // S/. 1
  coin50: number;  // S/. 0.50
  coin20: number;  // S/. 0.20
  coin10: number;  // S/. 0.10
}

interface Shift {
  shiftId: string;
  cashierId: string;
  cashierName: string;
  openedAt: Date;
  closedAt?: Date;
  openingBalanceCents: Centavos;
  expectedClosingCents: Centavos;
  countedClosingCents: Centavos;
  varianceCents: Centavos;
  salesTotalCents: Centavos;
  ordersCount: number;
  status: 'OPEN' | 'CLOSED';
}

interface HandoverReport {
  outgoingShift: Shift;
  incomingShift: Shift;
  cashCountMatch: boolean;
  varianceCents: Centavos;
  pendingOrdersCount: number;
  notes: string[];
  requiresManagerApproval: boolean;
  approvedBy?: string;
}

function calculateCashTotal(count: ShiftCashCount): Centavos {
  const total = 
    count.bill200 * 20000 +
    count.bill100 * 10000 +
    count.bill50 * 5000 +
    count.bill20 * 2000 +
    count.bill10 * 1000 +
    count.coin5 * 500 +
    count.coin2 * 200 +
    count.coin1 * 100 +
    count.coin50 * 50 +
    count.coin20 * 20 +
    count.coin10 * 10;
  return centavos(total);
}

function createHandoverReport(
  outgoingShift: Shift,
  incomingShift: Shift,
  cashCount: ShiftCashCount,
  pendingOrdersCount: number
): HandoverReport {
  const countedCash = calculateCashTotal(cashCount);
  const variance = centavos(countedCash - outgoingShift.expectedClosingCents);
  const cashCountMatch = Math.abs(variance) <= 1000; // S/. 10 tolerance
  const requiresManagerApproval = Math.abs(variance) > 5000; // S/. 50 threshold

  const notes: string[] = [];
  if (!cashCountMatch) {
    notes.push(`⚠️ Variación de caja: S/. ${(variance / 100).toFixed(2)}`);
  }
  if (pendingOrdersCount > 0) {
    notes.push(`📋 ${pendingOrdersCount} orden(es) pendiente(s) de pago`);
  }
  if (requiresManagerApproval) {
    notes.push(`🔴 Requiere aprobación de gerente (variación > S/. 50)`);
  }

  return {
    outgoingShift,
    incomingShift,
    cashCountMatch,
    varianceCents: variance,
    pendingOrdersCount,
    notes,
    requiresManagerApproval,
  };
}

function centavos(v: number): Centavos {
  return Math.round(v) as Centavos;
}

// ============================================================
// SHIFT HANDOVER SIMULATION TESTS
// ============================================================

describe('Cash Register Handover Between Shifts Simulation', () => {

  it('should simulate complete shift handover with cash count', () => {
    // SCENARIO: Morning cashier (Juan) closes, evening cashier (María) opens
    const outgoingShift: Shift = {
      shiftId: 'shift-morning',
      cashierId: 'emp-juan',
      cashierName: 'Juan Pérez',
      openedAt: new Date('2026-04-09T08:00:00'),
      closedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: 20000 as Centavos, // S/. 200
      expectedClosingCents: 75000 as Centavos, // S/. 750 expected
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 55000 as Centavos, // S/. 550 in sales
      ordersCount: 45,
      status: 'CLOSED',
    };

    // María counts the cash
    const cashCount: ShiftCashCount = {
      bill200: 0,
      bill100: 1,  // S/. 100
      bill50: 4,   // S/. 200
      bill20: 10,  // S/. 200
      bill10: 10,  // S/. 100
      coin5: 2,    // S/. 10
      coin2: 5,    // S/. 10
      coin1: 10,   // S/. 10
      coin50: 4,   // S/. 2
      coin20: 5,   // S/. 1
      coin10: 10,  // S/. 1
    };

    const countedCash = calculateCashTotal(cashCount);
    expect(countedCash).toBe(63400); // S/. 634 (actual calculation)

    const incomingShift: Shift = {
      shiftId: 'shift-evening',
      cashierId: 'emp-maria',
      cashierName: 'María García',
      openedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: countedCash,
      expectedClosingCents: 0 as Centavos,
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 0 as Centavos,
      ordersCount: 0,
      status: 'OPEN',
    };

    const handover = createHandoverReport(outgoingShift, incomingShift, cashCount, 2);

    expect(handover.cashCountMatch).toBe(false); // Variance is S/. 66, outside S/. 10 tolerance
    expect(handover.pendingOrdersCount).toBe(2);
    expect(handover.requiresManagerApproval).toBe(true); // Variance S/. 66 > S/. 50 threshold

    console.log('🔄 Shift Handover Report:');
    console.log(`   Outgoing: ${outgoingShift.cashierName} (${outgoingShift.shiftId})`);
    console.log(`   Incoming: ${incomingShift.cashierName} (${incomingShift.shiftId})`);
    console.log(`   Expected Cash: S/. ${(outgoingShift.expectedClosingCents / 100).toFixed(2)}`);
    console.log(`   Counted Cash: S/. ${(countedCash / 100).toFixed(2)}`);
    console.log(`   Variance: S/. ${(handover.varianceCents / 100).toFixed(2)}`);
    console.log(`   Cash Match: ${handover.cashCountMatch ? '✅' : '❌'}`);
    console.log(`   Pending Orders: ${handover.pendingOrdersCount}`);
    console.log(`   Notes:`);
    for (const note of handover.notes) {
      console.log(`     ${note}`);
    }
  });

  it('should detect cash discrepancy and require manager approval', () => {
    // SCENARIO: Cash count is S/. 80 less than expected
    const outgoingShift: Shift = {
      shiftId: 'shift-morning',
      cashierId: 'emp-carlos',
      cashierName: 'Carlos López',
      openedAt: new Date('2026-04-09T08:00:00'),
      closedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: 20000 as Centavos,
      expectedClosingCents: 80000 as Centavos, // S/. 800
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 60000 as Centavos,
      ordersCount: 50,
      status: 'CLOSED',
    };

    // María counts S/. 720 (S/. 80 missing)
    const cashCount: ShiftCashCount = {
      bill200: 0,
      bill100: 0,
      bill50: 8,   // S/. 400
      bill20: 10,  // S/. 200
      bill10: 8,   // S/. 80
      coin5: 6,    // S/. 30
      coin2: 5,    // S/. 10
      coin1: 0,
      coin50: 0,
      coin20: 0,
      coin10: 0,
    };

    const countedCash = calculateCashTotal(cashCount);
    expect(countedCash).toBe(72000); // S/. 720

    const incomingShift: Shift = {
      shiftId: 'shift-evening',
      cashierId: 'emp-ana',
      cashierName: 'Ana Torres',
      openedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: countedCash,
      expectedClosingCents: 0 as Centavos,
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 0 as Centavos,
      ordersCount: 0,
      status: 'OPEN',
    };

    const handover = createHandoverReport(outgoingShift, incomingShift, cashCount, 0);

    expect(handover.cashCountMatch).toBe(false);
    expect(Math.abs(handover.varianceCents)).toBe(8000); // S/. 80 missing
    expect(handover.requiresManagerApproval).toBe(true);

    console.log('🔴 Cash Discrepancy Detected:');
    console.log(`   Expected: S/. ${(outgoingShift.expectedClosingCents / 100).toFixed(2)}`);
    console.log(`   Counted: S/. ${(countedCash / 100).toFixed(2)}`);
    console.log(`   Missing: S/. ${(Math.abs(handover.varianceCents) / 100).toFixed(2)}`);
    console.log(`   Manager Approval: REQUIRED`);
  });

  it('should handle pending orders during shift handover', () => {
    // SCENARIO: 3 orders pending payment, handover to next cashier
    const outgoingShift: Shift = {
      shiftId: 'shift-morning',
      cashierId: 'emp-juan',
      cashierName: 'Juan Pérez',
      openedAt: new Date('2026-04-09T08:00:00'),
      closedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: 20000 as Centavos,
      expectedClosingCents: 65000 as Centavos,
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 45000 as Centavos,
      ordersCount: 38,
      status: 'CLOSED',
    };

    const cashCount: ShiftCashCount = {
      bill200: 0,
      bill100: 0,
      bill50: 5,   // S/. 250
      bill20: 10,  // S/. 200
      bill10: 10,  // S/. 100
      coin5: 10,   // S/. 50
      coin2: 0,
      coin1: 0,
      coin50: 0,
      coin20: 0,
      coin10: 0,
    };

    const countedCash = calculateCashTotal(cashCount);
    const pendingOrders = 3;

    const incomingShift: Shift = {
      shiftId: 'shift-evening',
      cashierId: 'emp-maria',
      cashierName: 'María García',
      openedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: countedCash,
      expectedClosingCents: 0 as Centavos,
      countedClosingCents: 0 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 0 as Centavos,
      ordersCount: 0,
      status: 'OPEN',
    };

    const handover = createHandoverReport(outgoingShift, incomingShift, cashCount, pendingOrders);

    expect(handover.pendingOrdersCount).toBe(3);
    expect(handover.notes.some(n => n.includes('pendiente'))).toBe(true);

    console.log('📋 Pending Orders Handover:');
    console.log(`   Pending Orders: ${handover.pendingOrdersCount}`);
    console.log(`   Incoming Cashier: ${incomingShift.cashierName}`);
    console.log(`   Action: ${handover.notes.find(n => n.includes('pendiente'))}`);
  });

  it('should calculate daily revenue from multiple shifts', () => {
    // SCENARIO: 2 shifts per day, calculate total daily revenue
    const morningShift: Shift = {
      shiftId: 'shift-morning',
      cashierId: 'emp-juan',
      cashierName: 'Juan Pérez',
      openedAt: new Date('2026-04-09T08:00:00'),
      closedAt: new Date('2026-04-09T16:00:00'),
      openingBalanceCents: 20000 as Centavos,
      expectedClosingCents: 75000 as Centavos,
      countedClosingCents: 75000 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 55000 as Centavos,
      ordersCount: 45,
      status: 'CLOSED',
    };

    const eveningShift: Shift = {
      shiftId: 'shift-evening',
      cashierId: 'emp-maria',
      cashierName: 'María García',
      openedAt: new Date('2026-04-09T16:00:00'),
      closedAt: new Date('2026-04-10T00:00:00'),
      openingBalanceCents: 75000 as Centavos,
      expectedClosingCents: 130000 as Centavos,
      countedClosingCents: 130000 as Centavos,
      varianceCents: 0 as Centavos,
      salesTotalCents: 55000 as Centavos,
      ordersCount: 42,
      status: 'CLOSED',
    };

    const dailyRevenue = morningShift.salesTotalCents + eveningShift.salesTotalCents;
    const dailyOrders = morningShift.ordersCount + eveningShift.ordersCount;
    const avgOrderValue = dailyRevenue / dailyOrders;

    expect(dailyRevenue).toBe(110000); // S/. 1,100
    expect(dailyOrders).toBe(87);

    console.log('💰 Daily Revenue from Multiple Shifts:');
    console.log(`   Morning Shift: S/. ${(morningShift.salesTotalCents / 100).toFixed(2)} (${morningShift.ordersCount} orders)`);
    console.log(`   Evening Shift: S/. ${(eveningShift.salesTotalCents / 100).toFixed(2)} (${eveningShift.ordersCount} orders)`);
    console.log(`   Daily Total: S/. ${(dailyRevenue / 100).toFixed(2)} (${dailyOrders} orders)`);
    console.log(`   Avg Order Value: S/. ${(avgOrderValue / 100).toFixed(2)}`);
  });

  it('should recommend: Shift handover improvements', () => {
    const currentGaps = [
      'No digital handover report',
      'No automated cash counting',
      'No pending orders tracking',
      'No variance trend analysis',
      'No manager notification for discrepancies',
      'No shift performance comparison',
    ];

    const recommendations = [
      'Auto-generate handover report with cash count, pending orders, notes',
      'Smart scale integration: auto-count bills/coins, calculate total',
      'Dashboard showing pending orders per shift, auto-assign to incoming cashier',
      'Track variance per cashier per day/week/month, identify patterns',
      'Auto-SMS manager when variance > S/. 50, photo evidence required',
      'Compare shifts: revenue, orders, avg order value, variance, customer rating',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Shift Handover Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
