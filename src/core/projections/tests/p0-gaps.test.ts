/**
 * FIRMO POS - Tests for P0 Gaps (UNDO, Cash Movements)
 * Run with: npx vitest run src/core/projections/tests/p0-gaps.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { applySaleEvent, createOrderFromEvent } from "../sale.reducer";
import { applyShiftEvent, emptyShift } from "../shift.reducer";
import type { SaleProjection } from "../types";

// Test Constants
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const TERMINAL_ID = "term_test";
const ACTOR_ID = "00000000-0000-0000-0000-000000000001";

// Default check template
function defaultCheck(checkId: string = "c1"): any {
    return {
        check_id: checkId,
        name: "Cuenta 1",
        mode: "ITEMS",
        lines: [],
        subtotal_cents: 0,
        discount_cents: 0,
        tip_cents: 0,
        total_cents: 0,
        payment: { status: "UNPAID", payments: [] },
    };
}

// Helper to create event envelope
function makeEvent(type: string, payload: any, seq: number, aggregateId = "order_1"): any {
    return {
        event_id: `evt_${type.toLowerCase()}_${seq}`,
        tenant_id: TENANT_ID,
        terminal_id: TERMINAL_ID,
        terminal_sequence: seq,
        occurred_at: new Date().toISOString(),
        event_type: type,
        schema_version: 1,
        aggregate_type: type.includes("SHIFT") ? "SHIFT" : "ORDER",
        aggregate_id: aggregateId,
        correlation_id: "corr_test",
        actor_id: ACTOR_ID,
        payload,
    };
}

// Helper to apply sale event safely
function applySale(state: SaleProjection | null, event: any): SaleProjection | null {
    if (!state && event.event_type === "ORDER_CREATED") {
        return createOrderFromEvent(event);
    }
    if (!state) return null;
    const result = applySaleEvent(state, event);
    return result.state;
}

// Helper to apply shift event safely
function applyShift(state: any, event: any): any {
    const current = state || emptyShift();
    const result = applyShiftEvent(current, event);
    return result.state;
}

describe("P0 Gaps Verification", () => {
    let saleState: SaleProjection | null = null;
    let shiftState: any = null;
    let seq = 1;

    beforeEach(() => {
        saleState = null;
        shiftState = null;
        seq = 1;
    });

    describe("1. UNDO Functionality (FR-005)", () => {
        it("should void an added item and update totals", () => {
            // 1. Create Order
            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1", order_number: 1001, order_type: "DINE_IN",
                items: [], checks: [defaultCheck("c1")],
            }, seq++));

            // 2. Add Item (Pollo: 65.00)
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_1", product_id: "prod_001", name: "Pollo", qty: 1, unit_price_cents: 6500, station: "PARRILLA" },
            }, seq++));

            expect(saleState?.lines["line_1"]).toBeDefined();
            expect(saleState?.subtotal_cents).toBe(6500);
            expect(saleState?.checks[0].total_cents).toBe(6500);

            // 3. Void Item
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_VOIDED", {
                order_id: "order_1",
                line_id: "line_1",
                reason: "Error de digitacion",
                voided_at: new Date().toISOString(),
            }, seq++));

            // Verify item removed from sale.lines
            expect(saleState?.lines["line_1"]).toBeUndefined();

            // Verify item removed from check.lines
            // Note: Our reducer logic might just filter it out or keep it marked as voids depending on implementation.
            // Based on my recent edit, it deletes from sale.lines and filters from check.lines
            expect(saleState?.checks[0].lines.some(l => l.line_id === "line_1")).toBe(false);

            // Verify Totals Updated
            expect(saleState?.subtotal_cents).toBe(0);
            expect(saleState?.checks[0].total_cents).toBe(0);
        });
    });

    describe("2. Cash Movements (FR-021)", () => {
        it("should handle cash IN/OUT and update expected stock", () => {
            // 1. Open Shift with 100.00
            shiftState = applyShift(null, makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1",
                cash_opening_cents: 10000,
            }, seq++, "shift_1"));

            expect(shiftState?.expected_cash_cents).toBe(10000);

            // 2. Add Cash IN (+50.00)
            shiftState = applyShift(shiftState, makeEvent("CASH_ADJUSTED", {
                shift_id: "shift_1",
                delta_cents: 5000,
                reason: "Ingreso Cambio",
            }, seq++, "shift_1"));

            expect(shiftState?.cash_movements).toHaveLength(1);
            expect(shiftState?.cash_movements[0].type).toBe("IN");
            expect(shiftState?.expected_cash_cents).toBe(15000); // 100 + 50

            // 3. Add Cash OUT (-20.00)
            shiftState = applyShift(shiftState, makeEvent("CASH_ADJUSTED", {
                shift_id: "shift_1",
                delta_cents: -2000,
                reason: "Pago Proveedor",
            }, seq++, "shift_1"));

            expect(shiftState?.cash_movements).toHaveLength(2);
            expect(shiftState?.cash_movements[1].type).toBe("OUT");
            expect(shiftState?.expected_cash_cents).toBe(13000); // 150 - 20
        });
    });
});
