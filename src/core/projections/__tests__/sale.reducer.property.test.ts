/**
 * Property-Based Tests for sale.reducer.ts
 * 
 * Tests invariants that must hold for ANY sequence of events:
 * 1. Round-trip: createOrder → addItems → subtotal consistency
 * 2. Idempotence: applying same event twice doesn't duplicate items
 * 3. Invariant: subtotal_cents always equals sum of line_total_cents
 * 4. Check totals: check totals match sum of their line items
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from 'uuid';
import { applySaleEvent, createOrderFromEvent } from "../sale.reducer";
import type { ParkEvent } from "@/src/core/domain/events";

// ============================================================================
// Helpers
// ============================================================================

function makeOrderCreatedEvent(overrides: Partial<{
    order_id: string;
    order_number: number;
    order_type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
}> = {}): Extract<ParkEvent, { event_type: "ORDER_CREATED" }> {
    const order_id = overrides.order_id || uuidv4();
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: 1,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: order_id,
        correlation_id: order_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "CASHIER",
        schema_version: 1,
        payload_version: 1,
        event_type: "ORDER_CREATED",
        payload: {
            order_id,
            order_number: overrides.order_number || 1,
            order_type: overrides.order_type || "DINE_IN",
            items: [],
            checks: [{
                check_id: "c1",
                name: "Principal",
                mode: "ITEMS",
                lines: [],
                subtotal_cents: 0,
                discount_cents: 0,
                tip_cents: 0,
                total_cents: 0,
                payment: { status: "UNPAID", payments: [] },
            }],
        },
    };
}

function makeItemAddedEvent(
    order_id: string,
    seq: number,
    item: {
        line_id?: string;
        product_id?: string;
        name?: string;
        qty?: number;
        unit_price_cents?: number;
        station?: string;
    } = {}
): ParkEvent {
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: seq,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: order_id,
        correlation_id: order_id,
        causation_id: null,
        actor_id: uuidv4(),
        actor_role_snapshot: "CASHIER",
        schema_version: 1,
        payload_version: 1,
        event_type: "ORDER_ITEM_ADDED",
        payload: {
            order_id,
                line: {
                line_id: item.line_id || uuidv4(),
                product_id: item.product_id || uuidv4(),
                sku: "SKU001",
                name: item.name || "Test Product",
                qty: item.qty || 1,
                unit_price_cents: item.unit_price_cents || 1000,
                station: item.station || "COCINA",
                status: "PENDING",
                tax_category: "GRAVADO", is_special_sla: false,
                mods: [],
            },
        },
    };
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

const centsArb = fc.integer({ min: 100, max: 100000 }); // 1 to 1000 soles
const qtyArb = fc.integer({ min: 1, max: 20 });
const stationArb = fc.constantFrom("PARRILLA", "COCINA", "BAR", "POSTRES", "BEBIDAS");
const orderTypeArb = fc.constantFrom("DINE_IN" as const, "TAKEOUT" as const, "DELIVERY" as const);

// ============================================================================
// Property Tests
// ============================================================================

describe("sale.reducer Property Tests", () => {
    // Property 1: Subtotal invariant - subtotal_cents always equals sum of line_total_cents
    it("Property 1: subtotal_cents equals sum of all line_total_cents", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 9999 }),
                orderTypeArb,
                fc.array(fc.record({ qty: qtyArb, price: centsArb, station: stationArb }), { minLength: 1, maxLength: 10 }),
                (orderNumber, orderType, items) => {
                    // Create order
                    const createEvent = makeOrderCreatedEvent({ order_number: orderNumber, order_type: orderType });
                    let sale = createOrderFromEvent(createEvent);
                    
                    // Add items
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const ev = makeItemAddedEvent(sale.order_id, i + 2, {
                            qty: item.qty,
                            unit_price_cents: item.price,
                            station: item.station,
                        });
                        const result = applySaleEvent(sale, ev);
                        sale = result.state!;
                    }
                    
                    // INVARIANT: subtotal must equal sum of line totals
                    const sumOfLines = Object.values(sale.lines).reduce(
                        (sum, line) => sum + line.line_total_cents,
                        0
                    );
                    
                    expect(sale.subtotal_cents).toBe(sumOfLines);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 2: Line total invariant - line_total_cents = qty * unit_price_cents
    it("Property 2: line_total_cents equals qty * unit_price_cents for each line", () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ qty: qtyArb, price: centsArb }), { minLength: 1, maxLength: 5 }),
                (items) => {
                    const createEvent = makeOrderCreatedEvent();
                    let sale = createOrderFromEvent(createEvent);
                    
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const ev = makeItemAddedEvent(sale.order_id, i + 2, {
                            qty: item.qty,
                            unit_price_cents: item.price,
                        });
                        const result = applySaleEvent(sale, ev);
                        sale = result.state!;
                    }
                    
                    // INVARIANT: each line's total must be qty * unit_price
                    for (const line of Object.values(sale.lines)) {
                        expect(line.line_total_cents).toBe(line.qty * line.unit_price_cents);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 3: Idempotence - applying same ORDER_ITEM_ADDED twice accumulates qty
    it("Property 3: applying same item event twice accumulates quantity", () => {
        fc.assert(
            fc.property(
                qtyArb,
                centsArb,
                (qty, price) => {
                    const createEvent = makeOrderCreatedEvent();
                    let sale = createOrderFromEvent(createEvent);
                    
            // Create a single item event with fixed line_id
            const lineId = uuidv4();
            const itemEvent = makeItemAddedEvent(sale.order_id, 2, {
                line_id: lineId,
                        qty,
                        unit_price_cents: price,
                    });
                    
                    // Apply once
                    let result = applySaleEvent(sale, itemEvent);
                    sale = result.state!;
                    expect(sale.lines[lineId].qty).toBe(qty);
                    
                    // Apply same event again (same line_id)
                    result = applySaleEvent(sale, itemEvent);
                    sale = result.state!;
                    
                    // Qty should be doubled (accumulated)
                    expect(sale.lines[lineId].qty).toBe(qty * 2);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 4: Check auto-assignment - items added to unpaid check
    it("Property 4: items auto-assigned to unpaid check only", () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ qty: qtyArb, price: centsArb }), { minLength: 1, maxLength: 5 }),
                (items) => {
                    const createEvent = makeOrderCreatedEvent();
                    let sale = createOrderFromEvent(createEvent);
                    
                    // Verify initial check is UNPAID
                    expect(sale.checks[0].payment.status).toBe("UNPAID");
                    
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const ev = makeItemAddedEvent(sale.order_id, i + 2, {
                            qty: item.qty,
                            unit_price_cents: item.price,
                        });
                        const result = applySaleEvent(sale, ev);
                        sale = result.state!;
                    }
                    
                    // INVARIANT: check subtotal should match order subtotal (single check)
                    if (sale.checks.length === 1 && sale.checks[0].payment.status !== "PAID") {
                        expect(sale.checks[0].subtotal_cents).toBe(sale.subtotal_cents);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 5: Order status transitions are valid
    it("Property 5: CONFIRMED status prevents further mutations", () => {
        fc.assert(
            fc.property(
                qtyArb,
                centsArb,
                (qty, price) => {
                    const createEvent = makeOrderCreatedEvent();
                    let sale = createOrderFromEvent(createEvent);
                    
                    // Add an item first
                    const itemEvent = makeItemAddedEvent(sale.order_id, 2, { qty, unit_price_cents: price });
                    let result = applySaleEvent(sale, itemEvent);
                    sale = result.state!;
                    
                    const itemCountBefore = Object.keys(sale.lines).length;
                    
                    // Manually set to CONFIRMED
                    sale.status = "CONFIRMED";
                    
                    // Try to add another item
                    const anotherItem = makeItemAddedEvent(sale.order_id, 3, { qty: 1, unit_price_cents: 500 });
                    result = applySaleEvent(sale, anotherItem);
                    sale = result.state!;
                    
                    // INVARIANT: item count should not change after CONFIRMED
                    expect(Object.keys(sale.lines).length).toBe(itemCountBefore);
                    expect(result.warnings.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property 6: Non-negative totals
    it("Property 6: subtotal_cents is always non-negative", () => {
        fc.assert(
            fc.property(
                fc.array(fc.record({ qty: qtyArb, price: centsArb }), { minLength: 0, maxLength: 10 }),
                (items) => {
                    const createEvent = makeOrderCreatedEvent();
                    let sale = createOrderFromEvent(createEvent);
                    
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const ev = makeItemAddedEvent(sale.order_id, i + 2, {
                            qty: item.qty,
                            unit_price_cents: item.price,
                        });
                        const result = applySaleEvent(sale, ev);
                        sale = result.state!;
                    }
                    
                    // INVARIANT: subtotal must be non-negative
                    expect(sale.subtotal_cents).toBeGreaterThanOrEqual(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});
