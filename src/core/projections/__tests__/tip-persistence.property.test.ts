/**
 * Property-Based Tests: Tip Persistence (Caja Crítico 2)
 *
 * Invariants:
 * 1. CHECK_TIP_SET always updates tip_cents in the check (reducer)
 * 2. tip_cents is always positive (Zod positiveCentsSchema)
 * 3. Check total = subtotal - discount + tip
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { v4 as uuidv4 } from "uuid";
import { applySaleEvent } from "../sale.reducer";
import type { ParkEvent } from "@/src/core/domain/events";
import { unsafeCentavos } from "@/src/core/types/shared";

function makeOrderCreatedEvent(orderId: string, checkId: string): ParkEvent {
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: 1,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: orderId,
        correlation_id: orderId,
        causation_id: null,
        actor_id: uuidv4(),
        schema_version: 1,
        payload_version: 1,
        event_type: "ORDER_CREATED",
        payload: {
            order_id: orderId,
            order_number: 1001,
            order_type: "DINE_IN",
            items: [],
            checks: [{
                check_id: checkId,
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
    } as unknown as ParkEvent;
}

function makeItemAddedEvent(orderId: string, priceCents: number, seq: number): ParkEvent {
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: seq,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: orderId,
        correlation_id: orderId,
        causation_id: null,
        actor_id: uuidv4(),
        schema_version: 1,
        payload_version: 1,
        event_type: "ORDER_ITEM_ADDED",
        payload: {
            order_id: orderId,
            line: {
                line_id: uuidv4(),
                product_id: uuidv4(),
                sku: "SKU001",
                name: "Test Product",
                qty: 1,
                unit_price_cents: priceCents,
                station: "COCINA",
                status: "PENDING",
                mods: [],
            },
        },
    } as unknown as ParkEvent;
}

function makeTipEvent(orderId: string, checkId: string, tipCents: number, seq: number): ParkEvent {
    return {
        event_id: uuidv4(),
        tenant_id: uuidv4(),
        terminal_id: "T001",
        terminal_sequence: seq,
        occurred_at: new Date().toISOString(),
        aggregate_type: "ORDER",
        aggregate_id: orderId,
        correlation_id: orderId,
        causation_id: null,
        actor_id: uuidv4(),
        schema_version: 1,
        payload_version: 1,
        event_type: "CHECK_TIP_SET",
        payload: {
            order_id: orderId,
            check_id: checkId,
            tip_cents: tipCents,
        },
    } as unknown as ParkEvent;
}

describe("Tip Persistence Property Tests (Caja C2)", () => {

    it("Invariant 1: CHECK_TIP_SET always updates tip_cents on the check (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 100000 }), // tip amount
                (tipCents) => {
                    const orderId = uuidv4();
                    const checkId = "c1";

                    // Create order
                    let sale = null as any;
                    const createResult = applySaleEvent(sale, makeOrderCreatedEvent(orderId, checkId));
                    sale = createResult.state;

                    // Set tip
                    const tipResult = applySaleEvent(sale, makeTipEvent(orderId, checkId, tipCents, 2));
                    sale = tipResult.state;

                    // INVARIANT: tip_cents on check matches
                    const check = sale.checks.find((c: { check_id: string }) => c.check_id === checkId);
                    expect(check).toBeDefined();
                    expect(check!.tip_cents).toBe(tipCents);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 2: Last tip wins — multiple CHECK_TIP_SET keeps only final value (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 100, max: 50000 }), { minLength: 2, maxLength: 10 }),
                (tipValues) => {
                    const orderId = uuidv4();
                    const checkId = "c1";

                    let sale = null as any;
                    sale = applySaleEvent(sale, makeOrderCreatedEvent(orderId, checkId)).state;

                    // Apply multiple tips
                    for (let i = 0; i < tipValues.length; i++) {
                        sale = applySaleEvent(sale, makeTipEvent(orderId, checkId, tipValues[i], i + 2)).state;
                    }

                    // INVARIANT: Only the last tip value survives
                    const check = sale.checks.find((c: { check_id: string }) => c.check_id === checkId);
                    expect(check!.tip_cents).toBe(tipValues[tipValues.length - 1]);
                }
            ),
            { numRuns: 200 }
        );
    });

    it("Invariant 3: Total = subtotal - discount + tip (200 runs)", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 100, max: 50000 }),  // item price
                fc.integer({ min: 100, max: 20000 }),  // tip
                (priceCents, tipCents) => {
                    const orderId = uuidv4();
                    const checkId = "c1";

                    let sale = null as any;
                    sale = applySaleEvent(sale, makeOrderCreatedEvent(orderId, checkId)).state;
                    sale = applySaleEvent(sale, makeItemAddedEvent(orderId, priceCents, 2)).state;
                    sale = applySaleEvent(sale, makeTipEvent(orderId, checkId, tipCents, 3)).state;

                    // INVARIANT: total = subtotal - discount + tip
                    const check = sale.checks.find((c: { check_id: string }) => c.check_id === checkId);
                    expect(check).toBeDefined();
                    const expectedTotal = check!.subtotal_cents - check!.discount_cents + check!.tip_cents;
                    expect(check!.total_cents).toBe(expectedTotal);
                }
            ),
            { numRuns: 200 }
        );
    });
});
