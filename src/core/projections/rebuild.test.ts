import { describe, it, expect } from "vitest";
import { rebuildFromEvents } from "./rebuild";
import type { ParkEvent } from "@/src/core/domain/events";

function e<T extends ParkEvent>(x: T): T { return x; }

describe("rebuildFromEvents", () => {
    it("rebuild determinístico: venta cash + shift expected", () => {
        const events: ParkEvent[] = [
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 1,
                event_id: "11111111-1111-1111-1111-111111111111",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SHIFT", aggregate_id: "shift1",
                correlation_id: "c1", causation_id: null,
                event_type: "shift_opened",
                payload: { opening_cash_cents: 10000 },
            }),
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 2,
                event_id: "22222222-2222-2222-2222-222222222222",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SALE", aggregate_id: "sale1",
                correlation_id: "c2", causation_id: null,
                event_type: "sale_created",
                payload: { sale_id: "sale1", catalog_version: 1 },
            }),
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 3,
                event_id: "33333333-3333-3333-3333-333333333333",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SALE", aggregate_id: "sale1",
                correlation_id: "c2", causation_id: null,
                event_type: "sale_item_added",
                payload: { line_id: "l1", product_id: "p1", qty: 2, unit_price_cents: 1500 },
            }),
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 4,
                event_id: "44444444-4444-4444-4444-444444444444",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "PAYMENT", aggregate_id: "pay1",
                correlation_id: "c2", causation_id: null,
                event_type: "payment_captured_local",
                payload: { method: "CASH", amount_cents: 5000, change_given_cents: 2000 },
            }),
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 5,
                event_id: "55555555-5555-5555-5555-555555555555",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SALE", aggregate_id: "sale1",
                correlation_id: "c2", causation_id: null,
                event_type: "sale_confirmed",
                payload: { total_cents: 3000 },
            }),
        ];

        const { state } = rebuildFromEvents(events);

        expect(state.activeSale?.status).toBe("CONFIRMED");
        expect(state.activeSale?.total_cents).toBe(3000);

        // Shift expected: opening 10000 + cash_sales_in 5000 - change 2000 = 13000
        expect(state.shift.expected_cash_cents).toBe(13000);
        expect(state.shift.status).toBe("OPEN");
    });

    it("ignora cash_movement si shift no está OPEN", () => {
        const events: ParkEvent[] = [
            e({
                store_id: "s1", terminal_id: "t1", terminal_sequence: 1,
                event_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                schema_version: 1, occurred_at: new Date().toISOString(),
                aggregate_type: "SHIFT", aggregate_id: "shift1",
                correlation_id: "c1", causation_id: null,
                event_type: "cash_movement",
                payload: { type: "IN", amount_cents: 1000, reason: "test" },
            }),
        ];

        const { state } = rebuildFromEvents(events);
        expect(state.shift.expected_cash_cents).toBe(0);
        expect(state.shift.status).toBe("CLOSED");
    });
});
