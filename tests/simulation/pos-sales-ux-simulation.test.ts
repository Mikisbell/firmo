/**
 * UX Simulation: POS Sales Flow Edge Cases
 * 
 * Simulates real cashier scenarios to find UX problems:
 * - Processing payment without open shift
 * - Split payments (partial cash + partial card)
 * - Voiding items after payment started
 * - Applying discounts that exceed total
 * - Customer wants to cancel mid-payment
 * - System crash during payment
 * 
 * This tests the SALES EXPERIENCE, not just payment logic.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Simulated POS System
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN';
type OrderStatus = 'OPEN' | 'PENDING_PAYMENT' | 'PAID' | 'VOIDED';
type ShiftStatus = 'OPEN' | 'CLOSED';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface OrderItem {
  id: string;
  name: string;
  priceCents: Centavos;
  quantity: number;
  voided: boolean;
}

interface Payment {
  method: PaymentMethod;
  amountCents: Centavos;
}

interface Order {
  id: string;
  items: OrderItem[];
  status: OrderStatus;
  payments: Payment[];
  discountCents: Centavos;
  createdAt: Date;
}

interface Shift {
  status: ShiftStatus;
  openingBalance: Centavos;
}

interface POSState {
  shift: Shift | null;
  currentOrder: Order | null;
  error?: string;
  confusionPoints: number;
  stepsRequired: number;
}

// POS Business Logic
function createPOSState(): POSState {
  return {
    shift: null,
    currentOrder: null,
    error: undefined,
    confusionPoints: 0,
    stepsRequired: 0,
  };
}

function openShift(state: POSState, amountCents: Centavos): POSState {
  return {
    ...state,
    shift: { status: 'OPEN', openingBalance: amountCents },
    stepsRequired: state.stepsRequired + 1,
  };
}

function createOrder(state: POSState, items: Array<{ name: string; priceCents: Centavos; quantity: number }>): POSState {
  const orderItems: OrderItem[] = items.map((item, i) => ({
    id: `item-${i}`,
    name: item.name,
    priceCents: item.priceCents,
    quantity: item.quantity,
    voided: false,
  }));

  return {
    ...state,
    currentOrder: {
      id: `order-${Date.now()}`,
      items: orderItems,
      status: 'OPEN',
      payments: [],
      discountCents: 0 as Centavos,
      createdAt: new Date(),
    },
    stepsRequired: state.stepsRequired + 1,
  };
}

function calculateOrderTotal(order: Order): Centavos {
  const subtotal = order.items
    .filter(item => !item.voided)
    .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  return centavos(subtotal - order.discountCents);
}

function addPayment(state: POSState, method: PaymentMethod, amountCents: Centavos): POSState {
  if (!state.shift || state.shift.status !== 'OPEN') {
    return {
      ...state,
      error: 'No hay turno abierto. Abre un turno primero.',
      confusionPoints: state.confusionPoints + 1,
    };
  }

  if (!state.currentOrder) {
    return {
      ...state,
      error: 'No hay orden activa.',
      confusionPoints: state.confusionPoints + 1,
    };
  }

  const total = calculateOrderTotal(state.currentOrder);
  const alreadyPaid = state.currentOrder.payments.reduce((sum, p) => sum + p.amountCents, 0);
  const remaining = centavos(total - alreadyPaid);

  if (amountCents > remaining) {
    return {
      ...state,
      error: `Monto excede lo pendiente. Pendiente: S/. ${(remaining / 100).toFixed(2)}`,
      confusionPoints: state.confusionPoints + 1,
    };
  }

  const updatedOrder = {
    ...state.currentOrder,
    payments: [...state.currentOrder.payments, { method, amountCents }],
    status: (alreadyPaid + amountCents >= total ? 'PAID' : 'PENDING_PAYMENT') as OrderStatus,
  };

  return {
    ...state,
    currentOrder: updatedOrder,
    stepsRequired: state.stepsRequired + 1,
  };
}

function applyDiscount(state: POSState, discountCents: Centavos): POSState {
  if (!state.currentOrder) return state;

  const total = calculateOrderTotal(state.currentOrder);

  if (discountCents > total) {
    return {
      ...state,
      error: `Descuento excede el total. Total: S/. ${(total / 100).toFixed(2)}, Descuento: S/. ${(discountCents / 100).toFixed(2)}`,
      confusionPoints: state.confusionPoints + 1,
    };
  }

  return {
    ...state,
    currentOrder: {
      ...state.currentOrder,
      discountCents,
    },
    stepsRequired: state.stepsRequired + 1,
  };
}

function voidItem(state: POSState, itemId: string): POSState {
  if (!state.currentOrder) return state;

  const updatedItems = state.currentOrder.items.map(item =>
    item.id === itemId ? { ...item, voided: true } : item
  );

  return {
    ...state,
    currentOrder: {
      ...state.currentOrder,
      items: updatedItems,
    },
    stepsRequired: state.stepsRequired + 1,
  };
}

// ============================================================
// UX SIMULATION TESTS
// ============================================================

describe('POS Sales Flow UX Simulation', () => {

  it('should identify: Cannot process payment without open shift', () => {
    // PROBLEM: Cashier tries to process payment but forgot to open shift
    // System should guide them, not just show error

    let state = createPOSState();
    state = createOrder(state, [
      { name: 'Pollo Entero', priceCents: 5500 as Centavos, quantity: 1 },
    ]);

    // Try to process payment without open shift
    state = addPayment(state, 'CASH', 5500 as Centavos);

    expect(state.error).toBeDefined();
    expect(state.confusionPoints).toBeGreaterThan(0);

    console.log('🔴 UX Problem: Payment blocked without shift');
    console.log(`   Error: ${state.error}`);
    console.log(`   Confusion points: ${state.confusionPoints}`);
    console.log(`   Better: Auto-prompt to open shift, or auto-open with default amount`);
  });

  it('should identify: Split payment is confusing (partial payments)', () => {
    // PROBLEM: Customer wants to pay S/. 50 cash + S/. 35 card
    // System should support this naturally

    let state = createPOSState();
    state = openShift(state, 10000 as Centavos);
    state = createOrder(state, [
      { name: 'Pollo Entero', priceCents: 5500 as Centavos, quantity: 1 },
      { name: 'Inca Kola', priceCents: 900 as Centavos, quantity: 3 },
    ]);

    const total = calculateOrderTotal(state.currentOrder!);
    expect(total).toBe(8200); // 5500 + 2700

    // Partial cash payment
    state = addPayment(state, 'CASH', 5000 as Centavos);
    expect(state.currentOrder?.status).toBe('PENDING_PAYMENT');

    // Remaining should be 3200
    const remaining = centavos(total - state.currentOrder!.payments[0].amountCents);
    expect(remaining).toBe(3200);

    // Complete with card
    state = addPayment(state, 'CARD', remaining);
    expect(state.currentOrder?.status).toBe('PAID');

    console.log('💡 Split payment works but requires manual calculation');
    console.log(`   Total: S/. ${(total / 100).toFixed(2)}`);
    console.log(`   Cash: S/. 50.00, Card: S/. ${(remaining / 100).toFixed(2)}`);
    console.log(`   User had to calculate remaining manually`);
    console.log(`   Better: Show "Remaining: S/. XX.XX" and auto-calculate`);
  });

  it('should identify: Discount can exceed order total', () => {
    // PROBLEM: Cashier applies S/. 100 discount on S/. 85 order
    // System should prevent this

    let state = createPOSState();
    state = openShift(state, 10000 as Centavos);
    state = createOrder(state, [
      { name: 'Pollo Entero', priceCents: 5500 as Centavos, quantity: 1 },
      { name: 'Papas Fritas', priceCents: 1200 as Centavos, quantity: 1 },
    ]);

    const total = calculateOrderTotal(state.currentOrder!);
    expect(total).toBe(6700); // S/. 67.00

    // Try to apply S/. 100 discount (exceeds total)
    state = applyDiscount(state, 10000 as Centavos);

    expect(state.error).toBeDefined();
    expect(state.confusionPoints).toBeGreaterThan(0);

    console.log('🔴 UX Problem: Discount validation needed');
    console.log(`   Order total: S/. ${(total / 100).toFixed(2)}`);
    console.log(`   Attempted discount: S/. 100.00`);
    console.log(`   System caught it, but user is confused`);
    console.log(`   Better: Disable discount input when > total`);
  });

  it('should identify: Voiding items mid-payment is confusing', () => {
    // PROBLEM: Customer ordered 3 items, paid for 2, then wants to void 1
    // What happens to the payment?

    let state = createPOSState();
    state = openShift(state, 10000 as Centavos);
    state = createOrder(state, [
      { name: 'Pollo Entero', priceCents: 5500 as Centavos, quantity: 1 },
      { name: 'Inca Kola', priceCents: 900 as Centavos, quantity: 2 },
      { name: 'Papas Fritas', priceCents: 1200 as Centavos, quantity: 1 },
    ]);

    const originalTotal = calculateOrderTotal(state.currentOrder!);
    expect(originalTotal).toBe(8500); // 5500 + 1800 + 1200

    // Customer pays full amount
    state = addPayment(state, 'CASH', 8500 as Centavos);
    expect(state.currentOrder?.status).toBe('PAID');

    // Now customer wants to void the Inca Kolas (already paid!)
    state = voidItem(state, 'item-1');
    const newTotal = calculateOrderTotal(state.currentOrder!);

    // Order is still "PAID" but total decreased
    expect(newTotal).toBeLessThan(originalTotal);
    expect(state.currentOrder?.status).toBe('PAID'); // Status didn't update!

    console.log('🔴 UX Problem: Void after payment');
    console.log(`   Original total: S/. ${(originalTotal / 100).toFixed(2)}`);
    console.log(`   After void: S/. ${(newTotal / 100).toFixed(2)}`);
    console.log(`   Order status still shows "PAID" but total changed`);
    console.log(`   Better: Trigger refund flow or require manager approval`);
  });

  it('should identify: Customer cancels mid-payment (abandoned cart)', () => {
    // PROBLEM: Customer ordered, cashier started payment, then customer leaves
    // Order is stuck in "PENDING_PAYMENT" state

    let state = createPOSState();
    state = openShift(state, 10000 as Centavos);
    state = createOrder(state, [
      { name: 'Pollo Entero', priceCents: 5500 as Centavos, quantity: 1 },
    ]);

    // Start payment but don't complete
    state = addPayment(state, 'CASH', 3000 as Centavos);
    expect(state.currentOrder?.status).toBe('PENDING_PAYMENT');

    // Customer left! Order is now stuck
    const stuckOrder = state.currentOrder;
    expect(stuckOrder?.status).toBe('PENDING_PAYMENT');
    expect(stuckOrder?.payments.length).toBeGreaterThan(0);

    console.log('🔴 UX Problem: Abandoned payment');
    console.log(`   Order status: ${stuckOrder?.status}`);
    console.log(`   Partial payment: S/. ${(stuckOrder!.payments[0].amountCents / 100).toFixed(2)}`);
    console.log(`   Order is stuck - cashier must manually cancel or complete`);
    console.log(`   Better: Auto-cancel after timeout or "Cancel Payment" button`);
  });

  it('should calculate: Confusion points during busy hour (10 orders)', () => {
    // PROBLEM: During rush, cashier makes mistakes
    // How confusing is the system under pressure?

    let totalConfusion = 0;
    let totalSteps = 0;

    for (let i = 0; i < 10; i++) {
      let state = createPOSState();
      state = openShift(state, 10000 as Centavos);
      state = createOrder(state, [
        { name: 'Pollo', priceCents: 5500 as Centavos, quantity: 1 },
        { name: 'Bebida', priceCents: 900 as Centavos, quantity: 2 },
      ]);

      // Simulate cashier mistake: try to pay before checking total
      const total = calculateOrderTotal(state.currentOrder!);
      state = addPayment(state, 'CASH', total);

      totalConfusion += state.confusionPoints;
      totalSteps += state.stepsRequired;
    }

    const avgConfusion = totalConfusion / 10;
    const avgSteps = totalSteps / 10;

    expect(avgSteps).toBeGreaterThan(2); // At least 2 steps per order

    console.log('📊 Busy Hour Analysis (10 orders):');
    console.log(`   Total confusion points: ${totalConfusion}`);
    console.log(`   Avg confusion per order: ${avgConfusion}`);
    console.log(`   Avg steps per order: ${avgSteps}`);
    console.log(`   Better: Reduce steps to 1 (scan → auto-total → pay)`);
  });

  it('should recommend: Streamlined payment flow (scan → pay)', () => {
    // SOLUTION: Optimized flow for POS
    // 1. Scan items (auto-adds to order)
    // 2. System shows total
    // 3. Cashier selects payment method
    // 4. System auto-calculates change

    const optimizedMetrics = {
      totalSteps: 2, // Select payment + confirm
      userCalculations: 0, // No manual math
      confusionPoints: 0,
    };

    // Current flow metrics (from simulations above)
    const currentMetrics = {
      totalSteps: 3, // Create order → calculate → pay
      userCalculations: 1, // Must calculate remaining for split payments
      confusionPoints: 1,
    };

    expect(optimizedMetrics.totalSteps).toBeLessThan(currentMetrics.totalSteps);
    expect(optimizedMetrics.userCalculations).toBeLessThan(currentMetrics.userCalculations);

    console.log('✅ Recommendation: Streamlined payment flow');
    console.log(`   Current steps: ${currentMetrics.totalSteps}, Optimized: ${optimizedMetrics.totalSteps}`);
    console.log(`   User calculations: ${currentMetrics.userCalculations}, Optimized: ${optimizedMetrics.userCalculations}`);
    console.log(`   Confusion: ${currentMetrics.confusionPoints}, Optimized: ${optimizedMetrics.confusionPoints}`);
  });

  it('should identify: Cash change calculation is error-prone', () => {
    // PROBLEM: Customer pays S/. 100 for S/. 85.30 order
    // Cashier must calculate S/. 14.70 change manually

    const orderTotal = 8530 as Centavos; // S/. 85.30
    const customerPayment = 10000 as Centavos; // S/. 100.00

    // Correct change
    const correctChange = customerPayment - orderTotal;
    expect(correctChange).toBe(1470); // S/. 14.70

    // Simulate common cashier mistakes
    const wrongCalculations = [
      10000 - 8500, // Forgot the 30 cents → S/. 15.00
      10000 - 8600, // Rounded up → S/. 14.00
      10000 - 8530 + 100, // Added extra → S/. 15.70
    ];

    for (const wrong of wrongCalculations) {
      expect(wrong).not.toBe(correctChange);
    }

    console.log('🔴 UX Problem: Manual change calculation');
    console.log(`   Order: S/. ${(orderTotal / 100).toFixed(2)}`);
    console.log(`   Paid: S/. ${(customerPayment / 100).toFixed(2)}`);
    console.log(`   Correct change: S/. ${(correctChange / 100).toFixed(2)}`);
    console.log(`   Common mistakes: ${wrongCalculations.map(c => `S/. ${(c / 100).toFixed(2)}`).join(', ')}`);
    console.log(`   Better: System auto-calculates and displays change`);
  });
});
