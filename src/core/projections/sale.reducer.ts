import type { ParkEvent } from "@/src/core/domain/events";
import type { ApplyResult, SaleLine, SalePayment, SaleProjection } from "./types";

function computeSubtotal(lines: Record<string, SaleLine>): number {
    let sum = 0;
    for (const k of Object.keys(lines)) sum += lines[k]!.line_total_cents;
    return sum;
}

export function createSaleFromEvent(e: Extract<ParkEvent, { event_type: "sale_created" }>): SaleProjection {
    const { sale_id, catalog_version } = e.payload;
    return {
        sale_id,
        catalog_version,
        status: "OPEN",
        lines: {},
        subtotal_cents: 0,
        payments: [],
        paid_cents: 0,
        change_cents: 0,
        total_cents: null,
        last_event_sequence: e.terminal_sequence,
        correlation_id: e.correlation_id,
    };
}

export function applySaleEvent(
    sale: SaleProjection | null,
    e: ParkEvent
): ApplyResult<SaleProjection | null> {
    const warnings: string[] = [];

    // Ignorar eventos no relacionados a SALE/PAYMENT salvo para warnings
    if (e.event_type === "sale_created") {
        if (sale && sale.status === "OPEN") {
            warnings.push("sale_created recibido mientras hay venta OPEN; reemplazando venta activa.");
        }
        return { state: createSaleFromEvent(e), warnings };
    }

    if (!sale) {
        // Si llega un evento de venta sin sale_created, warning y lo ignoramos (MVP)
        if (e.aggregate_type === "SALE" || e.event_type.startsWith("sale_") || e.event_type === "payment_captured_local") {
            warnings.push(`Evento ${e.event_type} sin venta activa; ignorado.`);
        }
        return { state: sale, warnings };
    }

    // Si la venta ya está confirmada, no aplicar mutaciones (solo warnings)
    if (sale.status === "CONFIRMED") {
        warnings.push(`Evento ${e.event_type} recibido después de CONFIRMED; ignorado.`);
        return { state: sale, warnings };
    }

    switch (e.event_type) {
        case "sale_item_added": {
            const { line_id, product_id, qty, unit_price_cents } = e.payload;
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

        case "sale_item_removed": {
            const { line_id, qty } = e.payload;
            const prev = sale.lines[line_id];
            if (!prev) {
                warnings.push(`sale_item_removed: line_id ${line_id} no existe; ignorado.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            const newQty = prev.qty - qty;
            if (newQty <= 0) {
                delete sale.lines[line_id];
            } else {
                prev.qty = newQty;
                prev.line_total_cents = newQty * prev.unit_price_cents;
                sale.lines[line_id] = prev;
            }

            sale.subtotal_cents = computeSubtotal(sale.lines);
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "payment_captured_local": {
            const { method, amount_cents, change_given_cents } = e.payload;

            // MVP: solo CASH
            const p: SalePayment = {
                method,
                amount_cents,
                change_given_cents,
            };
            sale.payments.push(p);

            sale.paid_cents += amount_cents;
            sale.change_cents += change_given_cents;
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "sale_confirmed": {
            const { total_cents } = e.payload;

            // Invariante mínima: paid - change >= total
            const netPaid = sale.paid_cents - sale.change_cents;
            if (netPaid < total_cents) {
                warnings.push(`sale_confirmed: netPaid(${netPaid}) < total(${total_cents}). Aún así se marca CONFIRMED (revisar flujo).`);
            }

            sale.total_cents = total_cents;
            sale.status = "CONFIRMED";
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        default:
            // eventos de shift no afectan venta
            return { state: sale, warnings };
    }
}
