import { describe, it, expect } from "vitest";
import { rebuildFromEvents } from "./rebuild";
import type { ParkEvent } from "@/src/core/domain/events";

function e<T extends ParkEvent>(x: T): T { return x; }

describe("rebuildFromEvents", () => {
    it("rebuild determinístico: venta cash + shift expected", () => {
        const events: ParkEvent[] = [
            // EVENT 1: SHIFT_OPENED
            e({
                tenant_id: "t1", terminal_id: "term1", terminal_sequence: 1,
                event_id: "e1",
                schema_version: 1, payload_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SHIFT", aggregate_id: "shift1",
                correlation_id: "c1", causation_id: null,
                actor_id: "user1",
                event_type: "SHIFT_OPENED",
                payload: {
                    shift_id: "shift1",
                    cash_opening_cents: 10000
                },
            }),
            // EVENT 2: ORDER_CREATED
            e({
                tenant_id: "t1", terminal_id: "term1", terminal_sequence: 2,
                event_id: "e2",
                schema_version: 1, payload_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "ORDER", aggregate_id: "order1",
                correlation_id: "c2", causation_id: null,
                actor_id: "user1",
                event_type: "ORDER_CREATED",
                payload: {
                    order_id: "order1",
                    order_number: 101,
                    order_type: "DINE_IN",
                    items: [],
                    checks: [
                        { check_id: "check1", name: "Principal", mode: "ITEMS", lines: [], subtotal_cents: 0, discount_cents: 0, tip_cents: 0, total_cents: 0, payment: { status: "UNPAID", payments: [] } }
                    ]
                },
            }),
            // EVENT 3: ORDER_ITEM_ADDED
            e({
                tenant_id: "t1", terminal_id: "term1", terminal_sequence: 3,
                event_id: "e3",
                schema_version: 1, payload_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "ORDER", aggregate_id: "order1",
                correlation_id: "c2", causation_id: null,
                actor_id: "user1",
                event_type: "ORDER_ITEM_ADDED",
                payload: {
                    order_id: "order1",
                    line: {
                        line_id: "line1",
                        product_id: "p1",
                        sku: "POLLO",
                        name: "Pollo a la Brasa",
                        unit_price_cents: 6500,
                        qty: 1,
                        station: "COCINA",
                        status: "PENDING",
                        mods: [],
                        notes: ""
                    }
                },
            }),
            // EVENT 4: CHECK_PAYMENT_ADDED
            e({
                tenant_id: "t1", terminal_id: "term1", terminal_sequence: 4,
                event_id: "e4",
                schema_version: 1, payload_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "ORDER", aggregate_id: "order1", // UPDATED: Must be ORDER
                correlation_id: "c2", causation_id: null,
                actor_id: "user1",
                event_type: "CHECK_PAYMENT_ADDED",
                payload: {
                    order_id: "order1", // ADDED
                    check_id: "check1",
                    payment: {
                        method: "CASH",
                        amount_cents: 6500,
                        ref: "efectivo"
                    }
                },
            }),
            // EVENT 5: INVOICE_ISSUED (Finalizes Sale)
            e({
                tenant_id: "t1", terminal_id: "term1", terminal_sequence: 5,
                event_id: "e5",
                schema_version: 1, payload_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "INVOICE", aggregate_id: "inv1", // Usually separate aggregate, or ORDER? Check events.ts. Assuming INVOICE is aggregate type.
                correlation_id: "c2", causation_id: null,
                actor_id: "user1",
                event_type: "INVOICE_ISSUED",
                payload: {
                    order_id: "order1",
                    check_id: "check1",
                    invoice_id: "inv1",
                    invoice_type: "BOLETA",
                    total_cents: 6500
                }
            })
        ];

        const { state } = rebuildFromEvents(events);

        // A. Venta Confirmed y Balanceada
        expect(state.activeSale?.status).toBe("CONFIRMED");
        expect(state.activeSale?.total_cents).toBe(6500); // Ahora sí debe ser 6500
        expect(state.activeSale?.paid_cents).toBe(6500); // 65.00 pagado
        expect(state.activeSale?.change_cents).toBe(0); // 0 vuelto

        // B. Shift Balanceado
        expect(state.shift.status).toBe("OPEN");
        expect(state.shift.opening_cash_cents).toBe(10000);
        expect(state.shift.cash_sales_in_cents).toBe(6500);
        expect(state.shift.expected_cash_cents).toBe(16500);
    });
});
