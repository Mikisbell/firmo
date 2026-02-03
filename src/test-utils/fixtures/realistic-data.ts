/**
 * Realistic Fixtures - Realistic test data generators
 * 
 * These fixtures generate realistic test data that matches production patterns.
 */

import { randomUUID } from 'crypto';
import {
  unsafeCentavos,
  asOrderId,
  asShiftId,
  asTenantId,
  asTerminalId,
  dateToBusinessDate,
  Centavos,
  OrderId,
  ShiftId,
  TenantId,
  TerminalId,
} from '@/src/core/types/shared';

// Default tenant for testing
export const DEFAULT_TEST_TENANT_ID = asTenantId('00000000-0000-0000-0000-000000000001');

/**
 * Generates a realistic order
 */
export function generateRealisticOrder(overrides?: Partial<any>): any {
  const orderId = asOrderId(randomUUID());
  return {
    order_id: orderId,
    order_number: Math.floor(Math.random() * 10000) + 1,
    order_type: 'DINE_IN',
    order_status: 'OPEN',
    fulfillment_status: 'COOKING',
    handoff_status: 'WAITING',
    stations_active: ['PARRILLA', 'BAR'],
    unpaid_checks_count: 1,
    subtotal_cents: unsafeCentavos(5000),
    discount_cents: unsafeCentavos(0),
    total_cents: unsafeCentavos(5000),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    terminal_id: asTerminalId('MOZO-01'),
    created_at: new Date(),
    updated_at: new Date(),
    items: [
      {
        line_id: randomUUID(),
        product_id: randomUUID(),
        sku: 'pollo_1_4',
        name: '1/4 Pollo',
        short_name: '1/4 P',
        qty: 2,
        unit_price_cents: unsafeCentavos(2500),
        station: 'PARRILLA',
        status: 'COOKING',
        mods: [],
        notes: null,
        created_at: new Date().toISOString(),
        started_cooking_at: null,
        ready_at: null,
        served_at: null,
      },
    ],
    checks: [
      {
        check_id: randomUUID(),
        name: 'Mesa 1',
        mode: 'ITEMS',
        lines: [{ line_id: randomUUID(), qty: 2 }],
        subtotal_cents: unsafeCentavos(5000),
        discount_cents: unsafeCentavos(0),
        tip_cents: unsafeCentavos(0),
        total_cents: unsafeCentavos(5000),
        payment: {
          status: 'UNPAID',
          payments: [],
        },
      },
    ],
    ...overrides,
  };
}

/**
 * Generates a realistic shift
 */
export function generateRealisticShift(overrides?: Partial<any>): any {
  return {
    id: asShiftId(randomUUID()),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    terminal_id: asTerminalId('CAJA-01'),
    status: 'OPEN',
    opened_at: new Date(),
    closed_at: null,
    opened_by: randomUUID(),
    closed_by: null,
    cash_opening_cents: unsafeCentavos(10000), // S/100
    cash_expected_cents: null,
    cash_counted_cents: null,
    diff_cents: null,
    ...overrides,
  };
}

/**
 * Generates a realistic order line
 */
export function generateRealisticOrderLine(overrides?: Partial<any>): any {
  return {
    line_id: randomUUID(),
    product_id: randomUUID(),
    sku: 'pollo_1_4',
    name: '1/4 Pollo',
    short_name: '1/4 P',
    qty: 1,
    unit_price_cents: unsafeCentavos(2500),
    station: 'PARRILLA',
    status: 'PENDING',
    mods: [],
    notes: null,
    created_at: new Date().toISOString(),
    started_cooking_at: null,
    ready_at: null,
    served_at: null,
    ...overrides,
  };
}

/**
 * Generates a realistic check
 */
export function generateRealisticCheck(overrides?: Partial<any>): any {
  return {
    check_id: randomUUID(),
    name: 'Mesa 1',
    mode: 'ITEMS',
    lines: [
      {
        line_id: randomUUID(),
        qty: 1,
      },
    ],
    subtotal_cents: unsafeCentavos(2500),
    discount_cents: unsafeCentavos(0),
    tip_cents: unsafeCentavos(0),
    total_cents: unsafeCentavos(2500),
    payment: {
      status: 'UNPAID',
      payments: [],
    },
    ...overrides,
  };
}

/**
 * Generates a realistic payment
 */
export function generateRealisticPayment(overrides?: Partial<any>): any {
  return {
    method: 'CASH',
    amount_cents: unsafeCentavos(5000),
    ref: null,
    ...overrides,
  };
}

/**
 * Generates a realistic inventory item
 */
export function generateRealisticInventoryItem(overrides?: Partial<any>): any {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    sku: 'pollo_1_4',
    name: '1/4 Pollo',
    unit: 'UNIDAD',
    current_qty: 100,
    unit_cost_cents: unsafeCentavos(2500),
    weighted_avg_cost_cents: unsafeCentavos(2500),
    reorder_level: 20,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generates a realistic recipe
 */
export function generateRealisticRecipe(overrides?: Partial<any>): any {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    product_id: randomUUID(),
    ingredients: [
      {
        inventory_item_id: randomUUID(),
        quantity: 1,
      },
    ],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generates a realistic waste log
 */
export function generateRealisticWasteLog(overrides?: Partial<any>): any {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    inventory_item_id: randomUUID(),
    quantity: 5,
    unit_cost_cents: unsafeCentavos(2500),
    reason: 'SPOILAGE',
    recorded_by: randomUUID(),
    recorded_at: new Date(),
    ...overrides,
  };
}

/**
 * Generates a realistic purchase order
 */
export function generateRealisticPurchaseOrder(overrides?: Partial<any>): any {
  return {
    id: randomUUID(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    po_number: Math.floor(Math.random() * 99999) + 1,
    supplier_id: randomUUID(),
    status: 'DRAFT',
    items: [
      {
        inventory_item_id: randomUUID(),
        quantity: 50,
        unit_cost_cents: unsafeCentavos(2500),
      },
    ],
    total_cents: unsafeCentavos(125000),
    received_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generates a realistic event envelope
 */
export function generateRealisticEventEnvelope(overrides?: Partial<any>): any {
  return {
    event_id: randomUUID(),
    tenant_id: DEFAULT_TEST_TENANT_ID,
    terminal_id: asTerminalId('MOZO-01'),
    terminal_sequence: Math.floor(Math.random() * 100000),
    occurred_at: new Date().toISOString(),
    aggregate_type: 'ORDER',
    aggregate_id: randomUUID(),
    correlation_id: randomUUID(),
    causation_id: null,
    actor_id: randomUUID(),
    actor_role_snapshot: 'WAITER',
    schema_version: 1,
    payload_version: 1,
    shift_id: asShiftId(randomUUID()),
    business_date: dateToBusinessDate(new Date()),
    ...overrides,
  };
}

/**
 * Generates a realistic ORDER_CREATED event
 */
export function generateRealisticOrderCreatedEvent(overrides?: Partial<any>): any {
  const order = generateRealisticOrder();
  const envelope = generateRealisticEventEnvelope({
    aggregate_type: 'ORDER',
    aggregate_id: order.order_id,
  });

  return {
    ...envelope,
    payload: {
      order_id: order.order_id,
      order_number: order.order_number,
      order_type: order.order_type,
      items: order.items,
      checks: order.checks,
      fulfillment: null,
      delivery: null,
      promotion_id: null,
    },
    ...overrides,
  };
}

/**
 * Generates a realistic SHIFT_OPENED event
 */
export function generateRealisticShiftOpenedEvent(overrides?: Partial<any>): any {
  const shift = generateRealisticShift();
  const envelope = generateRealisticEventEnvelope({
    aggregate_type: 'SHIFT',
    aggregate_id: shift.id,
  });

  return {
    ...envelope,
    payload: {
      shift_id: shift.id,
      cash_opening_cents: shift.cash_opening_cents,
    },
    ...overrides,
  };
}

/**
 * Generates a realistic CHECK_MARKED_PAID event
 */
export function generateRealisticCheckMarkedPaidEvent(overrides?: Partial<any>): any {
  const order = generateRealisticOrder();
  const check = order.checks[0];
  const envelope = generateRealisticEventEnvelope({
    aggregate_type: 'ORDER',
    aggregate_id: order.order_id,
  });

  return {
    ...envelope,
    payload: {
      order_id: order.order_id,
      check_id: check.check_id,
      paid_at: new Date().toISOString(),
      change_cents: unsafeCentavos(0),
    },
    ...overrides,
  };
}

/**
 * Generates a sequence of realistic orders
 */
export function generateRealisticOrderSequence(count: number): any[] {
  return Array.from({ length: count }, (_, i) =>
    generateRealisticOrder({
      order_number: i + 1,
    })
  );
}

/**
 * Generates a sequence of realistic events
 */
export function generateRealisticEventSequence(count: number): any[] {
  const events: any[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      events.push(generateRealisticOrderCreatedEvent());
    } else if (i % 3 === 1) {
      events.push(generateRealisticShiftOpenedEvent());
    } else {
      events.push(generateRealisticCheckMarkedPaidEvent());
    }
  }
  return events;
}

/**
 * Generates a realistic inventory transaction sequence
 */
export function generateRealisticInventoryTransactionSequence(count: number): any[] {
  const transactions: any[] = [];
  let currentQty = 1000;

  for (let i = 0; i < count; i++) {
    const type = ['PURCHASE', 'DEDUCTION', 'WASTE', 'ADJUSTMENT'][i % 4];

    if (type === 'PURCHASE') {
      transactions.push({
        type: 'PURCHASE',
        item_id: randomUUID(),
        qty: Math.floor(Math.random() * 100) + 1,
        unit_cost_cents: unsafeCentavos(2500),
      });
      currentQty += 50;
    } else if (type === 'DEDUCTION') {
      const deductQty = Math.min(Math.floor(Math.random() * 10) + 1, currentQty);
      transactions.push({
        type: 'DEDUCTION',
        item_id: randomUUID(),
        qty: deductQty,
      });
      currentQty -= deductQty;
    } else if (type === 'WASTE') {
      const wasteQty = Math.min(Math.floor(Math.random() * 5) + 1, currentQty);
      transactions.push({
        type: 'WASTE',
        item_id: randomUUID(),
        qty: wasteQty,
        unit_cost_cents: unsafeCentavos(2500),
      });
      currentQty -= wasteQty;
    } else {
      const adjQty = Math.floor(Math.random() * 20) - 10;
      transactions.push({
        type: 'ADJUSTMENT',
        item_id: randomUUID(),
        qty: adjQty,
      });
      currentQty += adjQty;
    }
  }

  return transactions;
}
