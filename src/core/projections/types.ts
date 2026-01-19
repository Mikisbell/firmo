import type { ParkEvent, PaymentMethod, OrderType, ItemStatus } from "@/src/core/domain/events";
import type { Centavos, OrderId, ShiftId } from "@/src/core/types/shared";

export type SaleStatus = "OPEN" | "CONFIRMED" | "CANCELLED";

export type SaleLine = {
    line_id: string;
    product_id: string;
    name: string; // Added for UI
    qty: number;
    unit_price_cents: Centavos;
    line_total_cents: Centavos;
    status: ItemStatus;
    station: string; // Estación de cocina (PARRILLA, COCINA, BAR, etc.)
    // Timestamps for item lifecycle tracking
    created_at?: string;
    submitted_at?: string | null; // When item was sent to kitchen
    started_cooking_at?: string | null;
    ready_at?: string | null;
    served_at?: string | null;
};

export type SalePayment = {
    method: PaymentMethod;
    amount_cents: Centavos;
    change_given_cents: Centavos;
};

export type CheckProjection = {
    check_id: string;
    name?: string;
    mode: "ITEMS" | "PERCENT";
    lines: { line_id: string; qty: number }[];
    subtotal_cents: Centavos;
    discount_cents: Centavos;
    tip_cents: Centavos;
    total_cents: Centavos;
    payment: {
        status: "UNPAID" | "PARTIAL" | "PAID";
        payments: { method: PaymentMethod; amount_cents: Centavos; ref?: string }[];
    };
};

export type SaleProjection = {
    // New order-based fields
    order_id: OrderId;
    order_number: number;
    order_type: OrderType;

    // Legacy field (alias for order_id)
    sale_id: OrderId;

    catalog_version: number;
    status: SaleStatus;

    lines: Record<string, SaleLine>;
    subtotal_cents: Centavos;

    payments: SalePayment[];
    paid_cents: Centavos;
    change_cents: Centavos;

    total_cents: Centavos | null;
    last_event_sequence: number;

    correlation_id: string;

    // Split bill support
    checks: CheckProjection[];
};

export type ShiftStatus = "CLOSED" | "OPEN";

export type CashMovement = {
    type: "IN" | "OUT";
    amount_cents: Centavos;
    reason: string;
    occurred_at: string;
    seq: number;
};

export type ShiftProjection = {
    shift_id: ShiftId;
    status: ShiftStatus;
    opening_cash_cents: Centavos;
    cash_movements: CashMovement[];

    // Calculated from payment events (CASH)
    cash_sales_in_cents: Centavos;
    cash_change_out_cents: Centavos;

    expected_cash_cents: Centavos;
    declared_cash_cents: Centavos | null;
    over_short_cents: Centavos | null;

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
