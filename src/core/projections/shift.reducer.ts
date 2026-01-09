import type { ParkEvent } from "@/src/core/domain/events";
import { eventMigrator } from "@/src/core/domain/event-migrator";
import type { ApplyResult, ShiftProjection } from "./types";

// Ensure migrations are registered
import "@/src/core/domain/migrations";

export function emptyShift(): ShiftProjection {
    return {
        shift_id: "",
        status: "CLOSED",
        opening_cash_cents: 0,
        cash_movements: [],
        cash_sales_in_cents: 0,
        cash_change_out_cents: 0,
        expected_cash_cents: 0,
        declared_cash_cents: null,
        over_short_cents: null,
        opened_at: null,
        closed_at: null,
        last_event_sequence: 0,
    };
}

function recomputeExpected(s: ShiftProjection): number {
    const inSum = s.cash_movements.filter(m => m.type === "IN").reduce((a, m) => a + m.amount_cents, 0);
    const outSum = s.cash_movements.filter(m => m.type === "OUT").reduce((a, m) => a + m.amount_cents, 0);
    return s.opening_cash_cents + inSum - outSum + s.cash_sales_in_cents - s.cash_change_out_cents;
}

export function applyShiftEvent(shift: ShiftProjection, e: ParkEvent): ApplyResult<ShiftProjection> {
    const warnings: string[] = [];

    // Migrate event to current schema version if needed
    const event = eventMigrator.migrate(e);

    switch (event.event_type) {
        case "SHIFT_OPENED": {
            const { shift_id, cash_opening_cents } = event.payload;
            if (shift.status === "OPEN") warnings.push("SHIFT_OPENED recibido con turno ya OPEN; reiniciando turno.");
            const s = emptyShift();
            s.shift_id = shift_id;
            s.status = "OPEN";
            s.opening_cash_cents = cash_opening_cents;
            s.opened_at = event.occurred_at;
            s.last_event_sequence = event.terminal_sequence;
            s.expected_cash_cents = recomputeExpected(s);
            return { state: s, warnings };
        }

        case "CASH_ADJUSTED": {
            if (shift.status !== "OPEN") {
                warnings.push("CASH_ADJUSTED con turno CLOSED; ignorado.");
                return { state: shift, warnings };
            }
            const { delta_cents, reason } = event.payload;
            const mvtType = delta_cents >= 0 ? "IN" : "OUT";
            shift.cash_movements.push({
                type: mvtType,
                amount_cents: Math.abs(delta_cents),
                reason,
                occurred_at: event.occurred_at,
                seq: event.terminal_sequence
            });
            shift.expected_cash_cents = recomputeExpected(shift);
            shift.last_event_sequence = event.terminal_sequence;
            return { state: shift, warnings };
        }

        case "CHECK_PAYMENT_ADDED": {
            // For shift, only sum CASH payments
            if (shift.status !== "OPEN") {
                warnings.push("CHECK_PAYMENT_ADDED con turno CLOSED; ignorado.");
                return { state: shift, warnings };
            }

            const { payment } = event.payload;
            if (payment.method !== "CASH") return { state: shift, warnings };

            shift.cash_sales_in_cents += payment.amount_cents;
            shift.expected_cash_cents = recomputeExpected(shift);
            shift.last_event_sequence = event.terminal_sequence;
            return { state: shift, warnings };
        }

        case "CHECK_MARKED_PAID": {
            // Track change given
            if (shift.status !== "OPEN") {
                return { state: shift, warnings };
            }

            const { change_cents } = event.payload;
            if (change_cents && change_cents > 0) {
                shift.cash_change_out_cents += change_cents;
                shift.expected_cash_cents = recomputeExpected(shift);
            }
            shift.last_event_sequence = event.terminal_sequence;
            return { state: shift, warnings };
        }

        case "SHIFT_CLOSED": {
            if (shift.status !== "OPEN") warnings.push("SHIFT_CLOSED con turno CLOSED; interpretando como cierre tardío.");
            const { cash_counted_cents, notes: _notes } = event.payload;

            shift.status = "CLOSED";
            shift.declared_cash_cents = cash_counted_cents;
            shift.over_short_cents = cash_counted_cents - shift.expected_cash_cents;
            shift.closed_at = event.occurred_at;
            shift.last_event_sequence = event.terminal_sequence;
            return { state: shift, warnings };
        }

        default:
            return { state: shift, warnings };
    }
}
