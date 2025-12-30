import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult, ShiftProjection } from "./types";

export function emptyShift(): ShiftProjection {
    return {
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

    switch (e.event_type) {
        case "shift_opened": {
            const { opening_cash_cents } = e.payload;
            if (shift.status === "OPEN") warnings.push("shift_opened recibido con turno ya OPEN; reiniciando turno.");
            const s = emptyShift();
            s.status = "OPEN";
            s.opening_cash_cents = opening_cash_cents;
            s.opened_at = e.occurred_at;
            s.last_event_sequence = e.terminal_sequence;
            s.expected_cash_cents = recomputeExpected(s);
            return { state: s, warnings };
        }

        case "cash_movement": {
            if (shift.status !== "OPEN") {
                warnings.push("cash_movement con turno CLOSED; ignorado.");
                return { state: shift, warnings };
            }
            const { type, amount_cents, reason } = e.payload;
            shift.cash_movements.push({ type, amount_cents, reason, occurred_at: e.occurred_at, seq: e.terminal_sequence });
            shift.expected_cash_cents = recomputeExpected(shift);
            shift.last_event_sequence = e.terminal_sequence;
            return { state: shift, warnings };
        }

        case "payment_captured_local": {
            // para caja, solo sumamos CASH
            if (shift.status !== "OPEN") {
                warnings.push("payment_captured_local con turno CLOSED; ignorado.");
                return { state: shift, warnings };
            }

            const { method, amount_cents, change_given_cents } = e.payload;
            if (method !== "CASH") return { state: shift, warnings };

            shift.cash_sales_in_cents += amount_cents;
            shift.cash_change_out_cents += change_given_cents;
            shift.expected_cash_cents = recomputeExpected(shift);
            shift.last_event_sequence = e.terminal_sequence;
            return { state: shift, warnings };
        }

        case "shift_closed": {
            if (shift.status !== "OPEN") warnings.push("shift_closed con turno CLOSED; interpretando como cierre tardío.");
            const { declared_cash_cents, over_short_cents } = e.payload;
            shift.status = "CLOSED";
            shift.declared_cash_cents = declared_cash_cents;
            shift.over_short_cents = over_short_cents;
            shift.closed_at = e.occurred_at;
            shift.last_event_sequence = e.terminal_sequence;
            // expected ya está calculado
            return { state: shift, warnings };
        }

        default:
            return { state: shift, warnings };
    }
}
