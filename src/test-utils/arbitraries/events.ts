/**
 * Event Arbitraries - fast-check generators for event types
 * 
 * These arbitraries generate random event payloads for property-based testing.
 */

import * as fc from 'fast-check';
import {
  centavosArb,
  positiveCentavosArb,
  orderIdArb,
  shiftIdArb,
  tenantIdArb,
  terminalIdArb,
  businessDateArb,
  paymentMethodArb,
  orderTypeArb,
  itemStatusArb,
  paymentStatusArb,
  splitModeArb,
  stationArb,
  isoDateArb,
  uuidArb,
  shortStringArb,
  mediumStringArb,
  skuArb,
  quantityArb,
  orderNumberArb,
  tableNumberArb,
  guestCountArb,
} from './domain';

/**
 * Generates OrderLine objects
 */
export const orderLineArb = fc.record({
  line_id: uuidArb,
  product_id: uuidArb,
  sku: skuArb,
  name: shortStringArb,
  short_name: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
  qty: quantityArb,
  unit_price_cents: positiveCentavosArb,
  station: stationArb,
  status: itemStatusArb,
  mods: fc.array(fc.string({ maxLength: 30 }), { maxLength: 5 }),
  notes: fc.option(mediumStringArb, { nil: null }),
  created_at: fc.option(isoDateArb, { nil: null }),
  started_cooking_at: fc.option(isoDateArb, { nil: null }),
  ready_at: fc.option(isoDateArb, { nil: null }),
  served_at: fc.option(isoDateArb, { nil: null }),
});

/**
 * Generates Check objects (for split bill)
 */
export const checkArb = fc.record({
  check_id: uuidArb,
  name: fc.option(shortStringArb, { nil: null }),
  mode: splitModeArb,
  lines: fc.array(
    fc.record({
      line_id: uuidArb,
      qty: quantityArb,
    }),
    { minLength: 1, maxLength: 10 }
  ),
  subtotal_cents: centavosArb,
  discount_cents: centavosArb,
  tip_cents: centavosArb,
  total_cents: centavosArb,
  payment: fc.record({
    status: paymentStatusArb,
    payments: fc.array(
      fc.record({
        method: paymentMethodArb,
        amount_cents: positiveCentavosArb,
        ref: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
      }),
      { maxLength: 5 }
    ),
  }),
});

/**
 * Generates OrderCreatedPayload
 */
export const orderCreatedPayloadArb = fc.record({
  order_id: orderIdArb,
  order_number: orderNumberArb,
  order_type: orderTypeArb,
  items: fc.array(orderLineArb, { maxLength: 20 }),
  checks: fc.array(checkArb, { maxLength: 5 }),
  fulfillment: fc.option(
    fc.record({
      table_number: fc.option(fc.string(), { nil: null }),
      guest_count: fc.option(guestCountArb, { nil: null }),
      pickup_name: fc.option(shortStringArb, { nil: null }),
      pickup_phone: fc.option(fc.string({ maxLength: 20 }), { nil: null }),
    }),
    { nil: null }
  ),
  delivery: fc.option(
    fc.record({
      courier_type: fc.option(fc.constantFrom('OWN', 'APP'), { nil: null }),
      delivery_fee_cents: centavosArb,
      assigned_driver_id: fc.option(uuidArb, { nil: null }),
      payment_expectation: fc.constantFrom('PREPAID', 'COD'),
      address_snapshot: fc.option(
        fc.record({
          address_text: mediumStringArb,
          reference: fc.option(mediumStringArb, { nil: null }),
        }),
        { nil: null }
      ),
    }),
    { nil: null }
  ),
  promotion_id: fc.option(uuidArb, { nil: null }),
});

/**
 * Generates OrderItemAddedPayload
 */
export const orderItemAddedPayloadArb = fc.record({
  order_id: orderIdArb,
  line: orderLineArb,
});

/**
 * Generates OrderItemQtyChangedPayload
 */
export const orderItemQtyChangedPayloadArb = fc.record({
  order_id: orderIdArb,
  line_id: uuidArb,
  from_qty: quantityArb,
  to_qty: quantityArb,
});

/**
 * Generates OrderItemStatusChangedPayload
 */
export const orderItemStatusChangedPayloadArb = fc.record({
  order_id: orderIdArb,
  line_id: uuidArb,
  from: itemStatusArb,
  to: itemStatusArb,
  station: stationArb,
});

/**
 * Generates OrderItemVoidedPayload
 */
export const orderItemVoidedPayloadArb = fc.record({
  order_id: orderIdArb,
  line_id: uuidArb,
  reason: mediumStringArb,
  voided_at: isoDateArb,
  approved_by: fc.option(uuidArb, { nil: null }),
});

/**
 * Generates CheckMarkedPaidPayload
 */
export const checkMarkedPaidPayloadArb = fc.record({
  order_id: orderIdArb,
  check_id: uuidArb,
  paid_at: isoDateArb,
  change_cents: centavosArb,
});

/**
 * Generates CheckPaymentAddedPayload
 */
export const checkPaymentAddedPayloadArb = fc.record({
  order_id: orderIdArb,
  check_id: uuidArb,
  payment: fc.record({
    method: paymentMethodArb,
    amount_cents: positiveCentavosArb,
    ref: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  }),
});

/**
 * Generates ShiftOpenedPayload
 */
export const shiftOpenedPayloadArb = fc.record({
  shift_id: shiftIdArb,
  cash_opening_cents: positiveCentavosArb,
});

/**
 * Generates ShiftClosedPayload
 */
export const shiftClosedPayloadArb = fc.record({
  shift_id: shiftIdArb,
  cash_counted_cents: positiveCentavosArb,
  notes: fc.option(mediumStringArb, { nil: null }),
});

/**
 * Generates CashAdjustedPayload
 */
export const cashAdjustedPayloadArb = fc.record({
  shift_id: shiftIdArb,
  delta_cents: fc.integer({ min: -1_000_000, max: 1_000_000 }),
  reason: mediumStringArb,
});

/**
 * Generates base event envelope
 */
export const eventEnvelopeArb = fc.record({
  event_id: uuidArb,
  tenant_id: tenantIdArb,
  terminal_id: terminalIdArb,
  terminal_sequence: fc.integer({ min: 0, max: 100000 }),
  occurred_at: isoDateArb,
  aggregate_type: fc.constantFrom('ORDER', 'SHIFT', 'INVOICE', 'CATALOG'),
  aggregate_id: uuidArb,
  correlation_id: fc.string({ minLength: 1, maxLength: 50 }),
  causation_id: fc.option(uuidArb, { nil: null }),
  actor_id: fc.option(uuidArb, { nil: null }),
  actor_role_snapshot: fc.option(
    fc.constantFrom('ADMIN', 'MANAGER', 'CASHIER', 'WAITER'),
    { nil: null }
  ),
  schema_version: fc.constant(1),
  payload_version: fc.constant(1),
  shift_id: fc.option(shiftIdArb, { nil: null }),
  business_date: fc.option(businessDateArb, { nil: null }),
});

/**
 * Generates complete ORDER_CREATED events
 */
export const orderCreatedEventArb = fc
  .tuple(eventEnvelopeArb, orderCreatedPayloadArb)
  .map(([envelope, payload]) => ({
    ...envelope,
    aggregate_type: 'ORDER' as const,
    aggregate_id: payload.order_id,
    payload,
  }));

/**
 * Generates complete SHIFT_OPENED events
 */
export const shiftOpenedEventArb = fc
  .tuple(eventEnvelopeArb, shiftOpenedPayloadArb)
  .map(([envelope, payload]) => ({
    ...envelope,
    aggregate_type: 'SHIFT' as const,
    aggregate_id: payload.shift_id,
    payload,
  }));

/**
 * Generates complete CHECK_MARKED_PAID events
 */
export const checkMarkedPaidEventArb = fc
  .tuple(eventEnvelopeArb, checkMarkedPaidPayloadArb)
  .map(([envelope, payload]) => ({
    ...envelope,
    aggregate_type: 'ORDER' as const,
    aggregate_id: payload.order_id,
    payload,
  }));
