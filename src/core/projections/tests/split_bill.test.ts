import { describe, it, expect } from "vitest";
import { applySaleEvent as projectSale } from "../sale.reducer";
import { SaleProjection } from "../types";
import { OrderCreatedEvent, CheckCreatedEvent, CheckItemsUpdatedEvent, CheckPaymentAddedEvent } from "@/src/core/domain/events";

// Wrapper for reducer to match Array.reduce signature
function reducer(state: SaleProjection | null, event: any): SaleProjection | null {
    return projectSale(state, event).state;
}

// Helper to create events
const orderId = "00000000-0000-0000-0000-000000000001";
const tenantId = "00000000-0000-0000-0000-000000000000";
const lineId1 = "line_1";
const lineId2 = "line_2";

const createOrderEvent: OrderCreatedEvent = {
    event_id: "e1",
    tenant_id: tenantId,
    event_type: "ORDER_CREATED",
    aggregate_type: "ORDER",
    aggregate_id: orderId,
    occurred_at: new Date().toISOString(),
    terminal_id: "t1",
    terminal_sequence: 1,
    payload: {
        order_id: orderId,
        order_number: 101,
        order_type: "DINE_IN",
        checks: [
            {
                check_id: "MAIN",
                mode: "ITEMS",
                lines: [{ line_id: lineId1, qty: 2 }, { line_id: lineId2, qty: 1 }], // 2 Beers, 1 Pizza
                payment: { status: "UNPAID", payments: [] },
                subtotal_cents: 0,
                discount_cents: 0,
                total_cents: 3000
            }
        ],
        items: [
            { line_id: lineId1, product_id: "p1", name: "Beer", price_at_order_cents: 500, qty: 2, unit_price_cents: 500, sku: "SKU1", station: "bar" },
            { line_id: lineId2, product_id: "p2", name: "Pizza", price_at_order_cents: 2000, qty: 1, unit_price_cents: 2000, sku: "SKU2", station: "kitchen" }
        ] as any
    }
} as any;

describe("Split Bill Logic", () => {
    it("should initialize with Main Check", () => {
        const events = [createOrderEvent];
        const state = events.reduce(reducer, null);

        expect(state).not.toBeNull();
        expect(state!.checks).toHaveLength(1);
        expect(state!.checks[0].check_id).toBe("MAIN");
        expect(state!.checks[0].lines).toHaveLength(2);
        // Total: 30.00 (Set in payload for test simplicity, usually computed)
        // Wait, createOrderFromEvent usually computes subtotal/total from lines if logic exists there?
        // Let's check logic: createOrderFromEvent computes subtotal, but check totals inside "checks" array?
        // In this test we mock the Check structure in payload.
        // But actual logic relies on Backend providing correct initial checks or Client computing it.
    });

    it("should create a new check", () => {
        const createCheckEvent: CheckCreatedEvent = {
            ...createOrderEvent,
            event_id: "e2",
            event_type: "CHECK_CREATED",
            payload: {
                order_id: orderId,
                check: {
                    check_id: "CHECK_2",
                    lines: [],
                    payment: { status: "UNPAID", payments: [] },
                    total_cents: 0
                } as any
            }
        };

        const state = [createOrderEvent, createCheckEvent].reduce(reducer, null);

        expect(state!.checks).toHaveLength(2);
        expect(state!.checks[1].check_id).toBe("CHECK_2");
        expect(state!.checks[1].lines).toHaveLength(0);
    });

    it("should move items between checks", () => {
        // Create Check 2
        const createCheck2: CheckCreatedEvent = {
            ...createOrderEvent,
            event_id: "e2",
            event_type: "CHECK_CREATED",
            payload: { order_id: orderId, check: { check_id: "CHECK_2", lines: [], total_cents: 0 } as any }
        };

        // Move 1 Beer from Main to Check 2
        const updateMain: CheckItemsUpdatedEvent = {
            ...createOrderEvent,
            event_id: "e3",
            event_type: "CHECK_ITEMS_UPDATED",
            payload: {
                order_id: orderId,
                check_id: "MAIN",
                lines: [{ line_id: lineId1, qty: 1 }, { line_id: lineId2, qty: 1 }] // Left: 1 Beer, 1 Pizza
            }
        };

        const updateCheck2: CheckItemsUpdatedEvent = {
            ...createOrderEvent,
            event_id: "e4",
            event_type: "CHECK_ITEMS_UPDATED",
            payload: {
                order_id: orderId,
                check_id: "CHECK_2",
                lines: [{ line_id: lineId1, qty: 1 }] // Moved: 1 Beer
            }
        };

        const state = [createOrderEvent, createCheck2, updateMain, updateCheck2].reduce(reducer, null);

        // Check Main
        expect(state!.checks[0].lines).toHaveLength(2);
        const mainBeer = state!.checks[0].lines.find(l => l.line_id === lineId1);
        expect(mainBeer?.qty).toBe(1);

        // Check 2
        expect(state!.checks[1].lines).toHaveLength(1);
        expect(state!.checks[1].lines[0].line_id).toBe(lineId1);
    });

    it("should handle partial payments", () => {
        const createCheck2: CheckCreatedEvent = {
            ...createOrderEvent,
            event_id: "e2",
            event_type: "CHECK_CREATED",
            payload: { order_id: orderId, check: { check_id: "CHECK_2", lines: [], total_cents: 0 } as any }
        };

        // Populate Check 2 (5.00)
        const updateCheck2: CheckItemsUpdatedEvent = {
            ...createOrderEvent,
            event_id: "e3",
            event_type: "CHECK_ITEMS_UPDATED",
            payload: { order_id: orderId, check_id: "CHECK_2", lines: [{ line_id: lineId1, qty: 1 }] }
        };

        // Pay Check 2
        const payCheck2: CheckPaymentAddedEvent = {
            ...createOrderEvent,
            event_id: "e5",
            event_type: "CHECK_PAYMENT_ADDED",
            payload: {
                order_id: orderId,
                check_id: "CHECK_2",
                idempotency_key: "test_idem_split_1",
                payment: { method: "CASH", amount_cents: 500 }
            }
        };

        const state = [createOrderEvent, createCheck2, updateCheck2, payCheck2].reduce(reducer, null);

        expect(state!.checks[1].payment.status).toBe("PAID");
        // Wait, does the reducer update status automatically? Let's check logic.
        // sale.reducer.ts: CHECK_PAYMENT_ADDED just adds payment to sale.payments?
        // Wait, sale.payments is GLOBAL for the SaleProjection?
        // Or checks have their own payment status?

        // Let's re-read sale.reducer.ts.
        // It has `sale.payments.push(p)`. It seems it tracks payments GLOBALLY on the sale in the current implementation?
        // But CheckSchema has `payment: { status, payments }`.

        // If the reducer is `sale.reducer.ts`, it seems to be flattening payments to `sale.payments`.
        // This implies the current reducer might NOT be updating the specific CHECK's payment status, but the global ORDER status.
        // This is a Logic Gap if we want per-check payment.

        // Let's Verify:
        // The test expects `stateRef!.checks[1].payment.status` to be PAID.
        // If the reducer doesn't update `check.payment`, this test will fail.
        // And that failing test VALUABLE because it proves we need to update the reducer.
    });
});
