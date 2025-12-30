import type { ParkEvent } from "@/src/core/domain/events";

export type SaleStatus = "OPEN" | "CONFIRMED" | "VOIDED";

export type SaleLine = {
    line_id: string;
    product_id: string;
    qty: number; // int
    unit_price_cents: number; // int
    line_total_cents: number; // qty * price
};

export type SalePayment = {
    method: "CASH";
    amount_cents: number;
    change_given_cents: number;
};

export type SaleProjection = {
    sale_id: string;
    catalog_version: number;
    status: SaleStatus;

    lines: Record<string, SaleLine>;
    subtotal_cents: number;

    payments: SalePayment[];
    paid_cents: number;
    change_cents: number;

    total_cents: number | null; // set al confirmar
    last_event_sequence: number;

    // trazabilidad mínima
    correlation_id: string;
};

export type ShiftStatus = "CLOSED" | "OPEN";

export type CashMovement = {
    type: "IN" | "OUT";
    amount_cents: number;
    reason: string;
    occurred_at: string;
    seq: number;
};

export type ShiftProjection = {
    status: ShiftStatus;
    opening_cash_cents: number;
    cash_movements: CashMovement[];

    // calculados por eventos de pago (CASH)
    cash_sales_in_cents: number;   // suma de cash recibida (amount_cents)
    cash_change_out_cents: number; // suma de change_given_cents

    expected_cash_cents: number;   // opening + in - out + cash_sales_in - change_out
    declared_cash_cents: number | null;
    over_short_cents: number | null;

    opened_at: string | null;
    closed_at: string | null;
    last_event_sequence: number;
};

export type ProjectionsState = {
    activeSale: SaleProjection | null;
    shift: ShiftProjection;
};

export type ApplyResult<T> = {
    state: T;
    warnings: string[];
};

export type EventStream = ParkEvent[];
