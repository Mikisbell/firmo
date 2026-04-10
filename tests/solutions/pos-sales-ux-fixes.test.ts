/**
 * POS Sales UX Fixes - Implementation
 * 
 * Solves 6 critical POS UX problems found through simulation testing:
 * 1. Payment blocked without open shift → Auto-prompt to open shift
 * 2. Split payment requires manual calculation → Auto-calculate remaining
 * 3. Discount can exceed total → Validate discount <= total
 * 4. Void after payment doesn't trigger refund → Require manager approval
 * 5. Abandoned payment leaves order stuck → Auto-cancel after timeout
 * 6. Manual change calculation error-prone → Auto-calculate change
 * 
 * Each fix includes validation tests.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN';
type OrderStatus = 'OPEN' | 'PENDING_PAYMENT' | 'PAID' | 'VOIDED' | 'ABANDONED';

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
  status: OrderStatus;
  discountCents: Centavos;
  createdAt: Date;
  lastPaymentAt?: Date;
}

interface Shift {
  status: 'OPEN' | 'CLOSED';
  openingBalance: Centavos;
}

interface POSState {
  shift: Shift | null;
  currentOrder: Order | null;
  error?: string;
  warning?: string;
  autoCalculatedChange?: Centavos;
  remainingForSplit?: Centavos;
}

// ============================================================
// FIX 1: Auto-prompt to open shift if trying to pay without shift
// ============================================================

function tryPaymentWithShiftCheck(state: POSState, method: PaymentMethod, amountCents: Centavos): POSState {
  // FIX: Check if shift is open, provide helpful guidance
  if (!state.shift || state.shift.status !== 'OPEN') {
    return {
      ...state,
      error: undefined, // Clear generic error
      warning: '⚠️ No hay turno abierto. ¿Deseas abrir un turno ahora?',
      autoCalculatedChange: undefined,
    };
  }

  // Continue with normal payment flow...
  return state;
}

// ============================================================
// FIX 2: Auto-calculate remaining for split payments
// ============================================================

function calculateSplitPaymentRemaining(order: Order): Centavos {
  const total = order.totalCents;
  const alreadyPaid = order.payments.reduce((sum, p) => sum + p.amountCents, 0);
  return centavos(total - alreadyPaid);
}

function addSplitPayment(state: POSState, method: PaymentMethod, amountCents: Centavos): POSState {
  if (!state.currentOrder) return state;

  const remaining = calculateSplitPaymentRemaining(state.currentOrder);

  // FIX: Validate amount doesn't exceed remaining
  if (amountCents > remaining) {
    return {
      ...state,
      error: `Monto excede lo pendiente. Restante: S/. ${(remaining / 100).toFixed(2)}`,
      remainingForSplit: remaining,
    };
  }

  const updatedOrder: Order = {
    ...state.currentOrder,
    payments: [...state.currentOrder.payments, { method, amountCents, timestamp: new Date() }],
    status: (remaining - amountCents <= 0) ? 'PAID' : 'PENDING_PAYMENT',
    lastPaymentAt: new Date(),
  };

  return {
    ...state,
    currentOrder: updatedOrder,
    remainingForSplit: calculateSplitPaymentRemaining(updatedOrder),
  };
}

// ============================================================
// FIX 3: Validate discount doesn't exceed total
// ============================================================

function applyDiscountValidated(order: Order, discountCents: Centavos): {
  order: Order;
  error?: string;
  success: boolean;
} {
  const total = order.totalCents;

  // FIX: Block discount > total
  if (discountCents > total) {
    return {
      order,
      error: `Descuento (S/. ${(discountCents / 100).toFixed(2)}) no puede exceder el total (S/. ${(total / 100).toFixed(2)})`,
      success: false,
    };
  }

  return {
    order: {
      ...order,
      discountCents,
    },
    success: true,
  };
}

// ============================================================
// FIX 4: Void after payment triggers refund flow
// ============================================================

function voidItemAfterPayment(order: Order, itemId: string): {
  order: Order;
  requiresRefund: boolean;
  refundAmount?: Centavos;
  managerApprovalRequired: boolean;
} {
  const itemIndex = order.items?.findIndex?.((i: any) => i.id === itemId) ?? -1;
  if (itemIndex === -1) {
    return { order, requiresRefund: false, managerApprovalRequired: false };
  }

  const wasPaid = order.status === 'PAID' || order.payments.length > 0;
  const item = order.items?.[itemIndex];

  // FIX: If order was paid, trigger refund flow
  if (wasPaid && item?.priceCents) {
    const refundAmount = centavos(item.priceCents * (item.quantity || 1));

    return {
      order: {
        ...order,
        status: 'PENDING_PAYMENT', // Reset to allow refund processing
      },
      requiresRefund: true,
      refundAmount,
      managerApprovalRequired: true, // Always require manager for refunds
    };
  }

  return {
    order: {
      ...order,
      items: order.items?.map((i: any, idx: number) =>
        idx === itemIndex ? { ...i, voided: true } : i
      ),
    },
    requiresRefund: false,
    managerApprovalRequired: false,
  };
}

// ============================================================
// FIX 5: Auto-cancel abandoned payments after timeout
// ============================================================

function checkAbandonedPayment(order: Order, timeoutMinutes: number = 10): {
  order: Order;
  isAbandoned: boolean;
  minutesSinceLastPayment: number;
} {
  if (!order.lastPaymentAt) {
    return { order, isAbandoned: false, minutesSinceLastPayment: 0 };
  }

  const now = new Date();
  const minutesElapsed = (now.getTime() - order.lastPaymentAt.getTime()) / (1000 * 60);

  if (minutesElapsed > timeoutMinutes && order.status === 'PENDING_PAYMENT') {
    return {
      order: {
        ...order,
        status: 'ABANDONED',
      },
      isAbandoned: true,
      minutesSinceLastPayment: minutesElapsed,
    };
  }

  return {
    order,
    isAbandoned: false,
    minutesSinceLastPayment: minutesElapsed,
  };
}

// ============================================================
// FIX 6: Auto-calculate change for cash payments
// ============================================================

function calculateChangeForCash(paymentAmount: Centavos, orderTotal: Centavos): {
  change: Centavos;
  exact: boolean;
  insufficient: boolean;
  breakdown?: Record<number, number>; // bill/coin → count
} {
  if (paymentAmount < orderTotal) {
    return {
      change: 0 as Centavos,
      exact: false,
      insufficient: true,
    };
  }

  const change = centavos(paymentAmount - orderTotal);
  const exact = change === 0;

  // Auto-calculate optimal bill/coin breakdown
  const breakdown: Record<number, number> = {};
  let remaining = change;

  const denominations = [10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10];

  for (const denom of denominations) {
    if (remaining >= denom) {
      const count = Math.floor(remaining / denom);
      breakdown[denom] = count;
      remaining -= denom * count;
    }
  }

  return {
    change,
    exact,
    insufficient: false,
    breakdown: exact ? undefined : breakdown,
  };
}

// ============================================================
// TESTS
// ============================================================

describe('POS Sales UX Fixes', () => {

  // FIX 1: Auto-prompt for shift
  it('should prompt to open shift instead of showing error', () => {
    const state: POSState = {
      shift: null,
      currentOrder: {
        id: 'order-1',
        totalCents: 8500 as Centavos,
        payments: [],
        status: 'OPEN',
        discountCents: 0 as Centavos,
        createdAt: new Date(),
      },
    };

    const result = tryPaymentWithShiftCheck(state, 'CASH', 8500 as Centavos);

    expect(result.warning).toContain('turno abierto');
    expect(result.error).toBeUndefined(); // No confusing error

    console.log('✅ Fix 1: Shift check');
    console.log(`   Warning: ${result.warning}`);
  });

  // FIX 2: Split payment auto-calculation
  it('should auto-calculate remaining for split payments', () => {
    const order: Order = {
      id: 'order-1',
      totalCents: 8500 as Centavos,
      payments: [{ method: 'CASH', amountCents: 5000 as Centavos, timestamp: new Date() }],
      status: 'PENDING_PAYMENT',
      discountCents: 0 as Centavos,
      createdAt: new Date(),
      lastPaymentAt: new Date(),
    };

    const remaining = calculateSplitPaymentRemaining(order);
    expect(remaining).toBe(3500); // 8500 - 5000

    const state: POSState = {
      shift: { status: 'OPEN', openingBalance: 10000 as Centavos },
      currentOrder: order,
    };

    const result = addSplitPayment(state, 'CARD', remaining);
    expect(result.currentOrder?.status).toBe('PAID');
    expect(result.remainingForSplit).toBe(0);

    console.log('✅ Fix 2: Split payment');
    console.log(`   Remaining after S/. 50.00: S/. ${(remaining / 100).toFixed(2)}`);
  });

  // FIX 3: Discount validation
  it('should block discount exceeding total', () => {
    const order: Order = {
      id: 'order-1',
      totalCents: 8500 as Centavos,
      payments: [],
      status: 'OPEN',
      discountCents: 0 as Centavos,
      createdAt: new Date(),
    };

    // Try S/. 100 discount on S/. 85 order
    const result = applyDiscountValidated(order, 10000 as Centavos);

    expect(result.success).toBe(false);
    expect(result.error).toContain('no puede exceder');

    // Valid discount should work
    const validResult = applyDiscountValidated(order, 500 as Centavos);
    expect(validResult.success).toBe(true);
    expect(validResult.order.discountCents).toBe(500);

    console.log('✅ Fix 3: Discount validation');
    console.log(`   Invalid: S/. 100.00 > S/. 85.00 → Blocked`);
    console.log(`   Valid: S/. 5.00 < S/. 85.00 → Accepted`);
  });

  // FIX 4: Void after payment triggers refund
  it('should require manager approval for void after payment', () => {
    const order: Order = {
      id: 'order-1',
      totalCents: 8500 as Centavos,
      payments: [{ method: 'CASH', amountCents: 8500 as Centavos, timestamp: new Date() }],
      status: 'PAID',
      discountCents: 0 as Centavos,
      createdAt: new Date(),
      items: [{ id: 'item-1', name: 'Pollo', priceCents: 5500 as Centavos, quantity: 1 }],
    };

    const result = voidItemAfterPayment(order, 'item-1');

    expect(result.requiresRefund).toBe(true);
    expect(result.managerApprovalRequired).toBe(true);
    expect(result.refundAmount).toBe(5500);

    console.log('✅ Fix 4: Void after payment');
    console.log(`   Refund required: ${result.requiresRefund}`);
    console.log(`   Refund amount: S/. ${(result.refundAmount! / 100).toFixed(2)}`);
    console.log(`   Manager approval: ${result.managerApprovalRequired}`);
  });

  // FIX 5: Auto-cancel abandoned payments
  it('should auto-cancel abandoned payments after timeout', () => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); // Use 15 min buffer
    const order: Order = {
      id: 'order-1',
      totalCents: 8500 as Centavos,
      payments: [{ method: 'CASH', amountCents: 5000 as Centavos, timestamp: fifteenMinutesAgo }],
      status: 'PENDING_PAYMENT',
      discountCents: 0 as Centavos,
      createdAt: new Date(),
      lastPaymentAt: fifteenMinutesAgo,
    };

    const result = checkAbandonedPayment(order, 10);

    expect(result.isAbandoned).toBe(true);
    expect(result.order.status).toBe('ABANDONED');
    expect(result.minutesSinceLastPayment).toBeGreaterThanOrEqual(10);

    console.log('✅ Fix 5: Abandoned payment detection');
    console.log(`   Abandoned: ${result.isAbandoned}`);
    console.log(`   Minutes since payment: ${result.minutesSinceLastPayment.toFixed(1)}`);
  });

  // FIX 6: Auto-calculate change
  it('should auto-calculate change with optimal breakdown', () => {
    // S/. 100 payment for S/. 85.30 order
    const result = calculateChangeForCash(10000 as Centavos, 8530 as Centavos);

    expect(result.change).toBe(1470); // S/. 14.70
    expect(result.exact).toBe(false);
    expect(result.insufficient).toBe(false);
    expect(result.breakdown).toBeDefined();

    // Optimal breakdown: 1x S/. 10 + 2x S/. 2 + 1x S/. 0.50
    expect(result.breakdown![1000]).toBe(1);  // S/. 10
    expect(result.breakdown![200]).toBeGreaterThanOrEqual(2);   // S/. 4+

    // Test exact payment
    const exactResult = calculateChangeForCash(8530 as Centavos, 8530 as Centavos);
    expect(exactResult.exact).toBe(true);
    expect(exactResult.breakdown).toBeUndefined();

    // Test insufficient payment
    const insufficientResult = calculateChangeForCash(5000 as Centavos, 8530 as Centavos);
    expect(insufficientResult.insufficient).toBe(true);

    console.log('✅ Fix 6: Change calculation');
    console.log(`   Change: S/. ${(result.change / 100).toFixed(2)}`);
    console.log(`   Breakdown: ${JSON.stringify(result.breakdown)}`);
  });
});
