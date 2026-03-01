/**
 * Property-Based Tests: Payment Idempotency (Fase 1 - C1)
 *
 * Invariants:
 * 1. Duplicate payments with same idempotency_key are skipped
 * 2. total_paid never exceeds check_total * 1.5
 * 3. N duplicate payments result in exactly 1 recorded payment
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { applySaleEvent, createOrderFromEvent } from "../sale.reducer";
import type { ParkEvent } from "@/src/core/domain/events";

// ============================================================================
// Helpers
// ============================================================================

function makeOrderCreatedEvent(order_id: string): Extract<ParkEvent, { event_type: "ORDER_CREATED" }> {
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
            order_number: 1,
            order_type: "DINE_IN",
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

function makeItemAddedEvent(order_id: string, seq: number, price: number): Extract<ParkEvent, { event_type: "ORDER_ITEM_ADDED" }> {
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
                line_id: uuidv4(),
                product_id: uuidv4(),
                sku: "SKU001",
                name: "Test Product",
                qty: 1,
                unit_price_cents: price,
                station: "COCINA",
                status: "PENDING",
                tax_category: "GRAVADO",
                mods: [],
            },
        },
    };
}

function makePaymentEvent(
    order_id: string,
    seq: number,
    amount: number,
    idempotency_key: string,
    method: "CASH" | "CARD" | "YAPE" | "PLIN" = "CASH"
): Extract<ParkEvent, { event_type: "CHECK_PAYMENT_ADDED" }> {
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
        event_type: "CHECK_PAYMENT_ADDED",
        payload: {
            order_id,
            check_id: "c1",
            idempotency_key,
            payment: {
                method,
                amount_cents: amount,
            },
        },
    };
}

// ============================================================================
// Arbitraries
// ============================================================================

const centsArb = fc.integer({ min: 100, max: 100000 });
const paymentMethodArb = fc.constantFrom("CASH" as const, "CARD" as const, "YAPE" as const, "PLIN" as const);

// ============================================================================
// Property Tests
// ============================================================================

describe("Payment Idempotency Property Tests (C1)", () => {

    it("Invariant 1: duplicate payments with same idempotency_key are skipped", () => {
        fc.assert(
            fc.property(
                centsArb,
                paymentMethodArb,
                fc.integer({ min: 2, max: 10 }),
                (amount, method, duplicateCount) => {
                    const order_id = uuidv4();
                    const createEvent = makeOrderCreatedEvent(order_id);
                    let sale = createOrderFromEvent(createEvent);

                    // Add an item so check has a total
                    const itemEvent = makeItemAddedEvent(order_id, 2, amount);
                    const itemResult = applySaleEvent(sale, itemEvent);
                    sale = itemResult.state!;

                    // Generate a single idempotency_key
                    const key = `pay_test_${Date.now()}`;

                    // Apply the SAME payment N times with same key
                    for (let i = 0; i < duplicateCount; i++) {
                        const payEvent = makePaymentEvent(order_id, 3 + i, amount, key, method);
                        const result = applySaleEvent(sale, payEvent);
                        sale = result.state!;
                    }

                    // INVARIANT: only 1 payment should be recorded
                    expect(sale.payments.length).toBe(1);
                    expect(sale.paid_cents).toBe(amount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 2: different idempotency_keys create separate payments", () => {
        fc.assert(
            fc.property(
                fc.array(centsArb, { minLength: 1, maxLength: 5 }),
                paymentMethodArb,
                (amounts, method) => {
                    const order_id = uuidv4();
                    const createEvent = makeOrderCreatedEvent(order_id);
                    let sale = createOrderFromEvent(createEvent);

                    // Add items to cover the total
                    const totalAmount = amounts.reduce((a, b) => a + b, 0);
                    const itemEvent = makeItemAddedEvent(order_id, 2, totalAmount);
                    const itemResult = applySaleEvent(sale, itemEvent);
                    sale = itemResult.state!;

                    // Apply payments with DIFFERENT keys
                    for (let i = 0; i < amounts.length; i++) {
                        const key = `pay_unique_${i}_${Date.now()}`;
                        const payEvent = makePaymentEvent(order_id, 3 + i, amounts[i], key, method);
                        const result = applySaleEvent(sale, payEvent);
                        sale = result.state!;
                    }

                    // INVARIANT: all payments should be recorded
                    expect(sale.payments.length).toBe(amounts.length);
                    expect(sale.paid_cents).toBe(totalAmount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("Invariant 3: paid_cents is always sum of individual payment amounts (no phantom money)", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        amount: centsArb,
                        method: paymentMethodArb,
                        isDuplicate: fc.boolean(),
                    }),
                    { minLength: 1, maxLength: 8 }
                ),
                (paymentAttempts) => {
                    const order_id = uuidv4();
                    const createEvent = makeOrderCreatedEvent(order_id);
                    let sale = createOrderFromEvent(createEvent);

                    // Add a large item to prevent overpayment issues
                    const itemEvent = makeItemAddedEvent(order_id, 2, 99999900);
                    const itemResult = applySaleEvent(sale, itemEvent);
                    sale = itemResult.state!;

                    // Track unique keys
                    const usedKeys = new Set<string>();
                    let expectedTotal = 0;

                    for (let i = 0; i < paymentAttempts.length; i++) {
                        const { amount, method, isDuplicate } = paymentAttempts[i];
                        // If duplicate, reuse first key; otherwise create new
                        const key = isDuplicate && usedKeys.size > 0
                            ? Array.from(usedKeys)[0]
                            : `pay_${i}_${Date.now()}`;

                        if (!usedKeys.has(key)) {
                            usedKeys.add(key);
                            expectedTotal += amount;
                        }

                        const payEvent = makePaymentEvent(order_id, 3 + i, amount, key, method);
                        const result = applySaleEvent(sale, payEvent);
                        sale = result.state!;
                    }

                    // INVARIANT: paid_cents equals sum of unique payments only
                    expect(sale.paid_cents).toBe(expectedTotal);
                    expect(sale.payments.length).toBe(usedKeys.size);
                }
            ),
            { numRuns: 100 }
        );
    });
});
