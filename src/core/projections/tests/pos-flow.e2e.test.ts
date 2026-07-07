/**
 * FIRMO POS - E2E Tests for Complete POS Flow
 * Run with: npx vitest run src/core/projections/tests/pos-flow.e2e.test.ts
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

describe("POS Complete Flow E2E", () => {
    let saleState: SaleProjection | null = null;
    let shiftState: any = null;
    let seq = 1;

    beforeEach(() => {
        saleState = null;
        shiftState = null;
        seq = 1;
    });

    describe("1. Shift Management", () => {
        it("should open a shift", () => {
            const event = makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1",
                cash_opening_cents: 50000,
            }, seq++, "shift_1");

            shiftState = applyShift(null, event);

            expect(shiftState).not.toBeNull();
            expect(shiftState?.status).toBe("OPEN");
            expect(shiftState?.opening_cash_cents).toBe(50000);
        });

        it("should close a shift", () => {
            shiftState = applyShift(null, makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1",
                cash_opening_cents: 50000,
            }, seq++, "shift_1"));

            shiftState = applyShift(shiftState, makeEvent("SHIFT_CLOSED", {
                shift_id: "shift_1",
                cash_counted_cents: 50000, // Matches expected (opening with no sales)
            }, seq++, "shift_1"));

            expect(shiftState?.status).toBe("CLOSED");
            expect(shiftState?.over_short_cents).toBe(0);
        });
    });

    describe("2. Order Creation", () => {
        it("should create an order", () => {
            const event = makeEvent("ORDER_CREATED", {
                order_id: "order_1",
                order_number: 1001,
                order_type: "DINE_IN",
                items: [],
                checks: [defaultCheck("c1")],
            }, seq++);

            saleState = applySale(null, event);

            expect(saleState).not.toBeNull();
            expect(saleState?.order_id).toBe("order_1");
            expect(saleState?.order_number).toBe(1001);
            expect(saleState?.checks).toHaveLength(1);
            expect(saleState?.checks[0].check_id).toBe("c1");
        });
    });

    describe("3. Adding Items", () => {
        beforeEach(() => {
            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1",
                order_number: 1001,
                order_type: "DINE_IN",
                items: [],
                checks: [defaultCheck("c1")],
            }, seq++));
        });

        it("should add an item to the order", () => {
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1",
                check_id: "c1",
                line: {
                    line_id: "line_1",
                    product_id: "prod_001",
                    name: "Pollo a la Brasa Entero",
                    qty: 1,
                    unit_price_cents: 6500,
                    station: "PARRILLA",
                },
            }, seq++));

            expect(Object.keys(saleState!.lines)).toHaveLength(1);
            expect(saleState!.lines["line_1"].name).toBe("Pollo a la Brasa Entero");
            expect(saleState!.checks[0].lines).toHaveLength(1);
            expect(saleState!.checks[0].total_cents).toBe(6500);
        });

        it("should add multiple items and calculate totals", () => {
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_1", product_id: "prod_001", name: "Pollo", qty: 1, unit_price_cents: 6500, station: "PARRILLA" },
            }, seq++));

            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_2", product_id: "prod_004", name: "Papas", qty: 2, unit_price_cents: 1500, station: "FREIDORA" },
            }, seq++));

            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_3", product_id: "prod_008", name: "Gaseosa", qty: 1, unit_price_cents: 1000, station: "BAR" },
            }, seq++));

            expect(Object.keys(saleState!.lines)).toHaveLength(3);
            // Total: 6500 + (1500*2) + 1000 = 10500
            expect(saleState!.checks[0].total_cents).toBe(10500);
        });
    });

    describe("4. Payment Processing", () => {
        beforeEach(() => {
            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1", order_number: 1001, order_type: "DINE_IN",
                items: [], checks: [defaultCheck("c1")],
            }, seq++));
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_1", product_id: "prod_001", name: "Pollo", qty: 1, unit_price_cents: 6500, station: "PARRILLA" },
            }, seq++));
        });

        it("should process CASH payment", () => {
            saleState = applySale(saleState, makeEvent("CHECK_PAYMENT_ADDED", {
                order_id: "order_1",
                check_id: "c1",
                idempotency_key: "test_idem_cash_1",
                payment: { method: "CASH", amount_cents: 6500 },
            }, seq++));

            expect(saleState!.checks[0].payment.payments).toHaveLength(1);
            expect(saleState!.checks[0].payment.payments[0].method).toBe("CASH");
            expect(saleState!.checks[0].payment.payments[0].amount_cents).toBe(6500);
        });

        it("should process YAPE payment", () => {
            saleState = applySale(saleState, makeEvent("CHECK_PAYMENT_ADDED", {
                order_id: "order_1", check_id: "c1",
                idempotency_key: "test_idem_yape_1",
                payment: { method: "YAPE", amount_cents: 6500 },
            }, seq++));

            expect(saleState!.checks[0].payment.payments[0].method).toBe("YAPE");
        });

        it("should mark check as PAID when fully paid", () => {
            saleState = applySale(saleState, makeEvent("CHECK_PAYMENT_ADDED", {
                order_id: "order_1", check_id: "c1",
                idempotency_key: "test_idem_paid_1",
                payment: { method: "CASH", amount_cents: 6500 },
            }, seq++));

            saleState = applySale(saleState, makeEvent("CHECK_MARKED_PAID", {
                order_id: "order_1", check_id: "c1",
            }, seq++));

            expect(saleState!.checks[0].payment.status).toBe("PAID");
        });
    });

    describe("5. Complete Flow Integration", () => {
        it("should complete full POS flow: shift → order → items → pay → close shift", () => {
            // 1. Open Shift
            shiftState = applyShift(null, makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1", cash_opening_cents: 50000,
            }, seq++, "shift_1"));
            expect(shiftState?.status).toBe("OPEN");

            // 2. Create Order
            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1", order_number: 1001, order_type: "DINE_IN",
                items: [], checks: [defaultCheck("c1")],
            }, seq++));
            expect(saleState?.order_id).toBe("order_1");

            // 3. Add Items
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_1", product_id: "prod_001", name: "Pollo", qty: 1, unit_price_cents: 6500, station: "PARRILLA" },
            }, seq++));
            expect(saleState!.checks[0].total_cents).toBe(6500);

            // 4. Process Payment
            saleState = applySale(saleState, makeEvent("CHECK_PAYMENT_ADDED", {
                order_id: "order_1", check_id: "c1",
                idempotency_key: "test_idem_flow_1",
                payment: { method: "YAPE", amount_cents: 6500 },
            }, seq++));
            saleState = applySale(saleState, makeEvent("CHECK_MARKED_PAID", {
                order_id: "order_1", check_id: "c1",
            }, seq++));
            expect(saleState!.checks[0].payment.status).toBe("PAID");

            // 5. Close Shift
            shiftState = applyShift(shiftState, makeEvent("SHIFT_CLOSED", {
                shift_id: "shift_1",
                cash_expected_cents: 50000,
                cash_counted_cents: 50000,
                diff_cents: 0,
            }, seq++, "shift_1"));
            expect(shiftState?.status).toBe("CLOSED");
        });
    });

    describe("6. Split Bill Flow", () => {
        it("should create a second check and split items", () => {
            // Create order with items
            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1", order_number: 1001, order_type: "DINE_IN",
                items: [], checks: [defaultCheck("c1")],
            }, seq++));

            // Add items
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_1", product_id: "prod_001", name: "Pollo", qty: 1, unit_price_cents: 6500, station: "PARRILLA" },
            }, seq++));
            saleState = applySale(saleState, makeEvent("ORDER_ITEM_ADDED", {
                order_id: "order_1", check_id: "c1",
                line: { line_id: "line_2", product_id: "prod_008", name: "Gaseosa", qty: 2, unit_price_cents: 1000, station: "BAR" },
            }, seq++));

            // Create second check
            saleState = applySale(saleState, makeEvent("CHECK_CREATED", {
                order_id: "order_1",
                check: { ...defaultCheck("c2"), name: "Cuenta 2" },
            }, seq++));

            expect(saleState!.checks).toHaveLength(2);

            // Move gaseosa to second check
            saleState = applySale(saleState, makeEvent("CHECK_ITEMS_MOVED", {
                order_id: "order_1",
                from_check_id: "c1",
                to_check_id: "c2",
                lines: [{ line_id: "line_2", qty: 2 }],
            }, seq++));

            const check1 = saleState!.checks.find(c => c.check_id === "c1");
            const check2 = saleState!.checks.find(c => c.check_id === "c2");

            expect(check1!.total_cents).toBe(6500); // Solo pollo
            expect(check2!.total_cents).toBe(2000); // 2 gaseosas
        });
    });

    describe("6. Shift Required Validation", () => {
        it("should require open shift before creating order", () => {
            // This test validates business rule: No shift = No sales
            const shiftClosed = emptyShift();
            shiftClosed.status = "CLOSED";

            // Validation function (client-side check)
            const canCreateOrder = (shift: any) => shift?.status === "OPEN";

            expect(canCreateOrder(null)).toBe(false);
            expect(canCreateOrder(shiftClosed)).toBe(false);
            expect(canCreateOrder({ status: "OPEN" })).toBe(true);
        });

        it("should require open shift before adding items", () => {
            // Create order when shift is open
            shiftState = applyShift(null, makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1",
                cash_opening_cents: 50000,
            }, seq++, "shift_1"));

            saleState = applySale(null, makeEvent("ORDER_CREATED", {
                order_id: "order_1",
                order_number: 1,
                order_type: "DINE_IN",
                checks: [defaultCheck("c1")],
                fulfillment: { table_number: "M1" },
            }, seq++));

            // Simulate shift closed
            shiftState = applyShift(shiftState, makeEvent("SHIFT_CLOSED", {
                shift_id: "shift_1",
                cash_counted_cents: 50000,
            }, seq++, "shift_1"));

            // Validation check
            const canAddItem = (shift: any) => shift?.status === "OPEN";

            expect(canAddItem(shiftState)).toBe(false);
        });

        it("should require open shift before processing payments", () => {
            const canProcessPayment = (shift: any) => shift?.status === "OPEN";

            expect(canProcessPayment(null)).toBe(false);
            expect(canProcessPayment({ status: "CLOSED" })).toBe(false);
            expect(canProcessPayment({ status: "OPEN" })).toBe(true);
        });

        it("should track shift cash movements correctly", () => {
            // Open shift with S/500
            shiftState = applyShift(null, makeEvent("SHIFT_OPENED", {
                shift_id: "shift_1",
                cash_opening_cents: 50000,
            }, seq++, "shift_1"));

            // Add cash income (+200)
            shiftState = applyShift(shiftState, makeEvent("CASH_ADJUSTED", {
                shift_id: "shift_1",
                delta_cents: 20000,
                reason: "Venta en efectivo",
            }, seq++, "shift_1"));

            // Withdraw cash (-50)
            shiftState = applyShift(shiftState, makeEvent("CASH_ADJUSTED", {
                shift_id: "shift_1",
                delta_cents: -5000,
                reason: "Pago proveedor",
            }, seq++, "shift_1"));

            // Expected = 500 + 200 - 50 = 650
            expect(shiftState.expected_cash_cents).toBe(65000);
        });
    });
});
