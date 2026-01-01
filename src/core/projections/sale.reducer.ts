import type { ParkEvent, isEventType } from "@/src/core/domain/events";
import type { ApplyResult, SaleLine, SalePayment, SaleProjection } from "./types";

function computeSubtotal(lines: Record<string, SaleLine>): number {
    let sum = 0;
    for (const k of Object.keys(lines)) sum += lines[k]!.line_total_cents;
    return sum;
}

export function createOrderFromEvent(e: Extract<ParkEvent, { event_type: "ORDER_CREATED" }>): SaleProjection {
    const { order_id, order_number, order_type, items, checks } = e.payload;

    // Convert items array to lines record
    const lines: Record<string, SaleLine> = {};
    for (const item of items ?? []) {
        lines[item.line_id] = {
            line_id: item.line_id,
            product_id: item.product_id,
            qty: item.qty,
            unit_price_cents: item.unit_price_cents,
            line_total_cents: item.qty * item.unit_price_cents,
        };
    }

    const subtotal = computeSubtotal(lines);

    return {
        sale_id: order_id, // Keep sale_id for backward compatibility
        order_id,
        order_number,
        order_type,
        catalog_version: 1, // TODO: get from context
        status: "OPEN",
        lines,
        subtotal_cents: subtotal,
        payments: [],
        paid_cents: 0,
        change_cents: 0,
        total_cents: null,
        last_event_sequence: e.terminal_sequence,
        correlation_id: e.correlation_id,
        checks: checks ?? [],
    };
}

export function applySaleEvent(
    sale: SaleProjection | null,
    e: ParkEvent
): ApplyResult<SaleProjection | null> {
    const warnings: string[] = [];

    // ORDER_CREATED - creates new order/sale
    if (e.event_type === "ORDER_CREATED") {
        if (sale && sale.status === "OPEN") {
            warnings.push("ORDER_CREATED recibido mientras hay venta OPEN; reemplazando venta activa.");
        }
        return { state: createOrderFromEvent(e), warnings };
    }

    if (!sale) {
        // If event arrives without active order, warn and ignore
        if (e.aggregate_type === "ORDER" || e.event_type.startsWith("ORDER_") || e.event_type.startsWith("CHECK_")) {
            warnings.push(`Evento ${e.event_type} sin orden activa; ignorado.`);
        }
        return { state: sale, warnings };
    }

    // If order already confirmed, don't apply mutations
    if (sale.status === "CONFIRMED") {
        warnings.push(`Evento ${e.event_type} recibido después de CONFIRMED; ignorado.`);
        return { state: sale, warnings };
    }

    switch (e.event_type) {
        case "ORDER_ITEM_ADDED": {
            const { line } = e.payload;
            const { line_id, product_id, qty, unit_price_cents } = line;
            const prev = sale.lines[line_id];

            const newQty = (prev?.qty ?? 0) + qty;
            const line_total_cents = newQty * unit_price_cents;

            sale.lines[line_id] = {
                line_id,
                product_id,
                qty: newQty,
                unit_price_cents,
                line_total_cents,
            };

            sale.subtotal_cents = computeSubtotal(sale.lines);
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_ITEM_QTY_CHANGED": {
            const { line_id, to_qty } = e.payload;
            const prev = sale.lines[line_id];
            if (!prev) {
                warnings.push(`ORDER_ITEM_QTY_CHANGED: line_id ${line_id} no existe; ignorado.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            if (to_qty <= 0) {
                delete sale.lines[line_id];
            } else {
                prev.qty = to_qty;
                prev.line_total_cents = to_qty * prev.unit_price_cents;
                sale.lines[line_id] = prev;
            }

            sale.subtotal_cents = computeSubtotal(sale.lines);
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_ITEM_VOIDED": {
            const { line_id } = e.payload;
            delete sale.lines[line_id];
            sale.subtotal_cents = computeSubtotal(sale.lines);
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_PAYMENT_ADDED": {
            const { payment } = e.payload;
            const { method, amount_cents } = payment;

            const p: SalePayment = {
                method,
                amount_cents,
                change_given_cents: 0,
            };
            sale.payments.push(p);

            sale.paid_cents += amount_cents;
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_MARKED_PAID": {
            const { change_cents } = e.payload;
            sale.change_cents = change_cents ?? 0;
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "INVOICE_ISSUED": {
            const { total_cents } = e.payload;

            // Invariante mínima: paid - change >= total
            const netPaid = sale.paid_cents - sale.change_cents;
            if (netPaid < total_cents) {
                warnings.push(`INVOICE_ISSUED: netPaid(${netPaid}) < total(${total_cents}). Aún así se marca CONFIRMED.`);
            }

            sale.total_cents = total_cents;
            sale.status = "CONFIRMED";
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_CANCELLED": {
            sale.status = "CANCELLED";
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        default:
            // Events like SHIFT_* don't affect sale
            return { state: sale, warnings };
    }
}
