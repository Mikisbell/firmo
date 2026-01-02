import type { ParkEvent, PaymentMethod, OrderType } from "@/src/core/domain/events";

export type SaleStatus = "OPEN" | "CONFIRMED" | "CANCELLED";

export type SaleLine = {
    line_id: string;
    product_id: string;
    name: string; // Added for UI
    qty: number;
    unit_price_cents: number;
    line_total_cents: number;
};

export type SalePayment = {
    method: PaymentMethod;
    amount_cents: number;
    change_given_cents: number;
};

export type CheckProjection = {
    check_id: string;
    name?: string;
    mode: "ITEMS" | "PERCENT";
    lines: { line_id: string; qty: number }[];
    subtotal_cents: number;
    discount_cents: number;
    tip_cents: number;
    total_cents: number;
    payment: {
        status: "UNPAID" | "PARTIAL" | "PAID";
        payments: { method: PaymentMethod; amount_cents: number; ref?: string }[];
    };
};

export type SaleProjection = {
    // New order-based fields
    order_id: string;
    order_number: number;
    order_type: OrderType;

    // Legacy field (alias for order_id)
    sale_id: string;

    catalog_version: number;
    status: SaleStatus;

    lines: Record<string, SaleLine>;
    subtotal_cents: number;

    payments: SalePayment[];
    paid_cents: number;
    change_cents: number;

    total_cents: number | null;
    last_event_sequence: number;

    correlation_id: string;

    // Split bill support
    checks: CheckProjection[];
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
    shift_id: string;
    status: ShiftStatus;
    opening_cash_cents: number;
    cash_movements: CashMovement[];

    // Calculated from payment events (CASH)
    cash_sales_in_cents: number;
    cash_change_out_cents: number;

    expected_cash_cents: number;
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
