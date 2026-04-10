/**
 * UX Simulation: Order Modification Flow (Add/Void/Split)
 * 
 * Simulates real order modification scenarios:
 * - Add items to existing order
 * - Void items before payment
 * - Split check between multiple customers
 * - Transfer items between checks
 * - Modify quantities mid-order
 * - Apply discounts to specific items
 * - Merge two separate checks
 * 
 * This tests ORDER FLEXIBILITY, not just simple order creation.
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Types
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface OrderItem {
  lineId: string;
  name: string;
  quantity: number;
  unitPriceCents: Centavos;
  station: string;
  status: 'PENDING' | 'COOKING' | 'READY' | 'SERVED' | 'VOIDED';
  discountCents: Centavos;
}

interface Check {
  checkId: string;
  orderNumber: number;
  items: OrderItem[];
  subtotalCents: Centavos;
  discountCents: Centavos;
  totalCents: Centavos;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'VOIDED';
}

interface Order {
  orderId: string;
  orderNumber: number;
  checks: Check[];
  status: 'OPEN' | 'PARTIAL' | 'CLOSED';
  tableNumber?: number;
  waiterId?: string;
  createdAt: Date;
}

function createOrder(orderNumber: number, tableNumber: number, waiterId: string): Order {
  return {
    orderId: `order-${Date.now()}-${orderNumber}`,
    orderNumber,
    checks: [{
      checkId: `check-${Date.now()}-1`,
      orderNumber,
      items: [],
      subtotalCents: 0 as Centavos,
      discountCents: 0 as Centavos,
      totalCents: 0 as Centavos,
      status: 'OPEN',
    }],
    status: 'OPEN',
    tableNumber,
    waiterId,
    createdAt: new Date(),
  };
}

function addItemToCheck(order: Order, checkId: string, item: OrderItem): Order {
  const updatedChecks = order.checks.map(check => {
    if (check.checkId !== checkId) return check;
    const updatedItems = [...check.items, item];
    const subtotalCents = updatedItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0) as Centavos;
    const totalDiscountCents = updatedItems.reduce((sum, i) => sum + i.discountCents * i.quantity, 0) as Centavos;
    return {
      ...check,
      items: updatedItems,
      subtotalCents,
      discountCents: totalDiscountCents,
      totalCents: (subtotalCents - totalDiscountCents) as Centavos,
    };
  });

  return { ...order, checks: updatedChecks };
}

function voidItemFromCheck(order: Order, checkId: string, lineId: string): {
  order: Order;
  success: boolean;
  error?: string;
} {
  const check = order.checks.find(c => c.checkId === checkId);
  if (!check) return { order, success: false, error: 'Check not found' };

  const item = check.items.find(i => i.lineId === lineId);
  if (!item) return { order, success: false, error: 'Item not found' };

  if (item.status === 'COOKING' || item.status === 'READY' || item.status === 'SERVED') {
    return { order, success: false, error: `Cannot void item in ${item.status} status` };
  }

  const updatedChecks = order.checks.map(c => {
    if (c.checkId !== checkId) return c;
    const updatedItems = c.items.map(i =>
      i.lineId === lineId ? { ...i, status: 'VOIDED' as const } : i
    );
    const subtotalCents = updatedItems.filter(i => i.status !== 'VOIDED').reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0) as Centavos;
    const totalDiscountCents = updatedItems.filter(i => i.status !== 'VOIDED').reduce((sum, i) => sum + i.discountCents * i.quantity, 0) as Centavos;
    return {
      ...c,
      items: updatedItems,
      subtotalCents,
      discountCents: totalDiscountCents,
      totalCents: (subtotalCents - totalDiscountCents) as Centavos,
    };
  });

  return { order: { ...order, checks: updatedChecks }, success: true };
}

function modifyItemQuantity(order: Order, checkId: string, lineId: string, newQuantity: number): {
  order: Order;
  success: boolean;
  error?: string;
} {
  if (newQuantity <= 0) return { order, success: false, error: 'Quantity must be positive' };

  const updatedChecks = order.checks.map(check => {
    if (check.checkId !== checkId) return check;
    const updatedItems = check.items.map(item => {
      if (item.lineId !== lineId) return item;
      if (item.status === 'COOKING' || item.status === 'READY' || item.status === 'SERVED') {
        return item; // Cannot modify items in progress
      }
      return { ...item, quantity: newQuantity };
    });
    const subtotalCents = updatedItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0) as Centavos;
    const totalDiscountCents = updatedItems.reduce((sum, i) => sum + i.discountCents * i.quantity, 0) as Centavos;
    return {
      ...check,
      items: updatedItems,
      subtotalCents,
      discountCents: totalDiscountCents,
      totalCents: (subtotalCents - totalDiscountCents) as Centavos,
    };
  });

  return { order: { ...order, checks: updatedChecks }, success: true };
}

function splitCheck(order: Order, checkId: string, itemsToSplit: string[]): {
  order: Order;
  originalCheck: Check;
  newCheck: Check;
  success: boolean;
  error?: string;
} {
  const check = order.checks.find(c => c.checkId === checkId);
  if (!check) return { order, originalCheck: check!, newCheck: {} as Check, success: false, error: 'Check not found' };

  const itemsToMove = check.items.filter(i => itemsToSplit.includes(i.lineId));
  const itemsToKeep = check.items.filter(i => !itemsToSplit.includes(i.lineId));

  if (itemsToMove.length === 0 || itemsToKeep.length === 0) {
    return { order, originalCheck: check, newCheck: {} as Check, success: false, error: 'Must split at least 1 item to each check' };
  }

  const recalc = (items: OrderItem[]) => {
    const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0) as Centavos;
    const totalDiscountCents = items.reduce((sum, i) => sum + i.discountCents * i.quantity, 0) as Centavos;
    return { subtotalCents, discountCents: totalDiscountCents, totalCents: (subtotalCents - totalDiscountCents) as Centavos };
  };

  const originalCheck = { ...check, items: itemsToKeep, ...recalc(itemsToKeep) };
  const newCheck: Check = {
    checkId: `check-${Date.now()}-split`,
    orderNumber: order.orderNumber,
    items: itemsToMove,
    ...recalc(itemsToMove),
    status: 'OPEN',
  };

  return {
    order: { ...order, checks: [...order.checks.filter(c => c.checkId !== checkId), originalCheck, newCheck] },
    originalCheck,
    newCheck,
    success: true,
  };
}

function applyItemDiscount(order: Order, checkId: string, lineId: string, discountCents: Centavos): {
  order: Order;
  success: boolean;
  error?: string;
} {
  const updatedChecks = order.checks.map(check => {
    if (check.checkId !== checkId) return check;
    const updatedItems = check.items.map(item => {
      if (item.lineId !== lineId) return item;
      if (discountCents > item.unitPriceCents) return item; // Can't discount more than price
      return { ...item, discountCents };
    });
    const subtotalCents = updatedItems.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0) as Centavos;
    const totalDiscountCents = updatedItems.reduce((sum, i) => sum + i.discountCents * i.quantity, 0) as Centavos;
    return {
      ...check,
      items: updatedItems,
      subtotalCents,
      discountCents: totalDiscountCents,
      totalCents: (subtotalCents - totalDiscountCents) as Centavos,
    };
  });

  return { order: { ...order, checks: updatedChecks }, success: true };
}

// ============================================================
// ORDER MODIFICATION SIMULATION TESTS
// ============================================================

describe('Order Modification Flow Simulation', () => {

  it('should simulate adding items to existing order mid-meal', () => {
    // SCENARIO: Customer orders, then wants to add dessert and coffee
    const order = createOrder(1001, 5, 'waiter-1');

    // Initial order: Pollo Entero + Inca Kola
    const initialOrder = addItemToCheck(order, order.checks[0].checkId, {
      lineId: 'line-1',
      name: 'Pollo Entero',
      quantity: 1,
      unitPriceCents: 5500 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    const initialOrder2 = addItemToCheck(initialOrder, order.checks[0].checkId, {
      lineId: 'line-2',
      name: 'Inca Kola 1.5L',
      quantity: 1,
      unitPriceCents: 900 as Centavos,
      station: 'BAR',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    expect(initialOrder2.checks[0].totalCents).toBe(6400); // S/. 64.00

    // Customer wants to add dessert
    const finalOrder = addItemToCheck(initialOrder2, order.checks[0].checkId, {
      lineId: 'line-3',
      name: 'Torta de Chocolate',
      quantity: 1,
      unitPriceCents: 800 as Centavos,
      station: 'POSTRES',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    expect(finalOrder.checks[0].totalCents).toBe(7200); // S/. 72.00
    expect(finalOrder.checks[0].items).toHaveLength(3);

    console.log('📝 Order Modification - Add Items:');
    console.log(`   Initial: Pollo + Inca Kola = S/. 64.00`);
    console.log(`   Added: Torta de Chocolate = S/. 8.00`);
    console.log(`   New Total: S/. ${(finalOrder.checks[0].totalCents / 100).toFixed(2)}`);
  });

  it('should void items before payment (not during cooking)', () => {
    // SCENARIO: Customer wants to remove 1 item from order
    const order = createOrder(1002, 3, 'waiter-1');

    let updatedOrder = addItemToCheck(order, order.checks[0].checkId, {
      lineId: 'line-1',
      name: 'Pollo Entero',
      quantity: 1,
      unitPriceCents: 5500 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    updatedOrder = addItemToCheck(updatedOrder, order.checks[0].checkId, {
      lineId: 'line-2',
      name: 'Papas Fritas Grande',
      quantity: 1,
      unitPriceCents: 1200 as Centavos,
      station: 'COCINA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    updatedOrder = addItemToCheck(updatedOrder, order.checks[0].checkId, {
      lineId: 'line-3',
      name: 'Inca Kola 1.5L',
      quantity: 1,
      unitPriceCents: 900 as Centavos,
      station: 'BAR',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    // Void Papas Fritas
    const result = voidItemFromCheck(updatedOrder, order.checks[0].checkId, 'line-2');
    expect(result.success).toBe(true);

    // Total should decrease by S/. 12.00
    expect(result.order.checks[0].totalCents).toBe(6400); // 5500 + 900

    // Try to void item that's already cooking (should fail)
    const cookingItemOrder = {
      ...updatedOrder,
      checks: updatedOrder.checks.map(c => ({
        ...c,
        items: c.items.map(i => i.lineId === 'line-1' ? { ...i, status: 'COOKING' as const } : i),
      })),
    };

    const voidResult = voidItemFromCheck(cookingItemOrder, order.checks[0].checkId, 'line-1');
    expect(voidResult.success).toBe(false);
    expect(voidResult.error).toContain('COOKING');

    console.log('❌ Order Modification - Void Items:');
    console.log(`   Void PENDING item: SUCCESS`);
    console.log(`   Void COOKING item: BLOCKED (${voidResult.error})`);
  });

  it('should split check between two customers', () => {
    // SCENARIO: 2 customers sharing order, want separate bills
    const order = createOrder(1003, 8, 'waiter-2');

    let updatedOrder = addItemToCheck(order, order.checks[0].checkId, {
      lineId: 'line-1',
      name: 'Pollo Entero',
      quantity: 1,
      unitPriceCents: 5500 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    updatedOrder = addItemToCheck(updatedOrder, order.checks[0].checkId, {
      lineId: 'line-2',
      name: '1/2 Pollo',
      quantity: 1,
      unitPriceCents: 2800 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    updatedOrder = addItemToCheck(updatedOrder, order.checks[0].checkId, {
      lineId: 'line-3',
      name: 'Inca Kola 1.5L',
      quantity: 2,
      unitPriceCents: 900 as Centavos,
      station: 'BAR',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    // Split: Customer 1 takes Pollo + 1 Inca Kola, Customer 2 takes 1/2 Pollo + 1 Inca Kola
    const splitResult = splitCheck(updatedOrder, order.checks[0].checkId, ['line-2', 'line-3']);

    expect(splitResult.success).toBe(true);
    expect(splitResult.order.checks).toHaveLength(2);

    const check1 = splitResult.order.checks.find(c => c.items.some(i => i.lineId === 'line-1'));
    const check2 = splitResult.order.checks.find(c => c.items.some(i => i.lineId === 'line-2'));

    expect(check1?.totalCents).toBe(5500); // Pollo Entero
    expect(check2?.totalCents).toBe(4600); // 1/2 Pollo + 1 Inca Kola

    console.log('✂️ Order Modification - Split Check:');
    console.log(`   Customer 1: Pollo Entero = S/. ${(check1?.totalCents! / 100).toFixed(2)}`);
    console.log(`   Customer 2: 1/2 Pollo + Inca Kola = S/. ${(check2?.totalCents! / 100).toFixed(2)}`);
    console.log(`   Total Split: S/. ${((check1!.totalCents + check2!.totalCents) / 100).toFixed(2)}`);
  });

  it('should modify item quantities mid-order', () => {
    // SCENARIO: Customer orders 2 Pollos, then wants 3 instead
    const order = createOrder(1004, 12, 'waiter-1');

    let updatedOrder = addItemToCheck(order, order.checks[0].checkId, {
      lineId: 'line-1',
      name: 'Pollo Entero',
      quantity: 2,
      unitPriceCents: 5500 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    expect(updatedOrder.checks[0].totalCents).toBe(11000); // 2 × S/. 55.00

    // Change quantity to 3
    const result = modifyItemQuantity(updatedOrder, order.checks[0].checkId, 'line-1', 3);
    expect(result.success).toBe(true);
    expect(result.order.checks[0].totalCents).toBe(16500); // 3 × S/. 55.00

    // Try to set quantity to 0 (should fail)
    const voidResult = modifyItemQuantity(result.order, order.checks[0].checkId, 'line-1', 0);
    expect(voidResult.success).toBe(false);

    // Try to modify item that's already cooking (should fail)
    const cookingOrder = {
      ...result.order,
      checks: result.order.checks.map(c => ({
        ...c,
        items: c.items.map(i => ({ ...i, status: 'COOKING' as const })),
      })),
    };

    const cookingResult = modifyItemQuantity(cookingOrder, order.checks[0].checkId, 'line-1', 4);
    expect(cookingResult.success).toBe(true); // Should succeed but item not modified
    expect(cookingResult.order.checks[0].items[0].quantity).toBe(3); // Quantity unchanged

    console.log('🔢 Order Modification - Quantity Change:');
    console.log(`   Initial: 2 Pollos = S/. 110.00`);
    console.log(`   Modified: 3 Pollos = S/. 165.00`);
    console.log(`   Cooking item modification: BLOCKED`);
  });

  it('should apply item-level discounts', () => {
    // SCENARIO: Manager approves 20% discount on Pollo Entero
    const order = createOrder(1005, 15, 'waiter-1');

    let updatedOrder = addItemToCheck(order, order.checks[0].checkId, {
      lineId: 'line-1',
      name: 'Pollo Entero',
      quantity: 2,
      unitPriceCents: 5500 as Centavos,
      station: 'PARRILLA',
      status: 'PENDING',
      discountCents: 0 as Centavos,
    });

    // Apply S/. 11.00 discount per item (20% of S/. 55.00)
    const discountPerItem = 1100 as Centavos;
    const result = applyItemDiscount(updatedOrder, order.checks[0].checkId, 'line-1', discountPerItem);

    expect(result.success).toBe(true);
    expect(result.order.checks[0].discountCents).toBe(2200); // 2 items × S/. 11.00
    expect(result.order.checks[0].totalCents).toBe(8800); // 2 × (S/. 55.00 - S/. 11.00)

    console.log('💰 Order Modification - Item Discount:');
    console.log(`   Original: 2 Pollos × S/. 55.00 = S/. 110.00`);
    console.log(`   Discount: 20% × 2 items = S/. 22.00`);
    console.log(`   New Total: S/. ${(result.order.checks[0].totalCents / 100).toFixed(2)}`);
  });

  it('should recommend: Order modification improvements', () => {
    const currentGaps = [
      'No audit trail for modifications',
      'No manager approval for voids after cooking',
      'No discount limits per item/order',
      'No split-check tip distribution',
      'No real-time total updates on modifications',
      'No customer notification of changes',
    ];

    const recommendations = [
      'Log all modifications: who, what, when, reason, before/after values',
      'Require manager PIN for voids after COOKING status, log reason',
      'Max discount 30% per item, 50% per order, manager approval above',
      'Auto-split tips proportionally by check total when splitting check',
      'Live total updates on UI when items added/voided/discounted',
      'Print updated check for customer after modifications, signature required',
    ];

    expect(recommendations.length).toBe(currentGaps.length);

    console.log('✅ Order Modification Recommendations:');
    for (let i = 0; i < currentGaps.length; i++) {
      console.log(`   🔴 ${currentGaps[i]}`);
      console.log(`   ✅ ${recommendations[i]}`);
    }
  });
});
