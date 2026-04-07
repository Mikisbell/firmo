import type { ParkEvent } from "@/src/core/domain/events";
import { eventMigrator } from "@/src/core/domain/event-migrator";
import type { ApplyResult, SaleLine, SalePayment, SaleProjection } from "./types";
import { logger } from "@/src/core/observability/logger";
import { unsafeCentavos, asOrderId, type Centavos } from "@/src/core/types/shared";

// Ensure migrations are registered
import "@/src/core/domain/migrations";

function computeSubtotal(lines: Record<string, SaleLine>): Centavos {
    let sum = 0;
    for (const k of Object.keys(lines)) sum += lines[k]!.line_total_cents;
    return unsafeCentavos(sum);
}

export function createOrderFromEvent(e: Extract<ParkEvent, { event_type: "ORDER_CREATED" }>): SaleProjection {
    const { order_id, order_number, order_type, items, checks, fulfillment } = e.payload;

    // Convert items array to lines record
    const lines: Record<string, SaleLine> = {};
    for (const item of items ?? []) {
        lines[item.line_id] = {
            line_id: item.line_id,
            product_id: item.product_id,
            name: item.name,
            qty: item.qty,
            unit_price_cents: unsafeCentavos(item.unit_price_cents),
            line_total_cents: unsafeCentavos(item.qty * item.unit_price_cents),
            status: item.status ?? "PENDING",
            tax_category: item.tax_category ?? "GRAVADO",
            station: item.station || "COCINA", // Preservar estación
            // Timestamps
            created_at: item.created_at ?? e.occurred_at,
            started_cooking_at: item.started_cooking_at,
            ready_at: item.ready_at,
            served_at: item.served_at,
        };
    }

    const subtotal = computeSubtotal(lines);

    return {
        sale_id: asOrderId(order_id), // Keep sale_id for backward compatibility
        order_id: asOrderId(order_id),
        order_number,
        order_type,
        catalog_version: 1, // TODO: get from context
        status: "OPEN",
        lines,
        subtotal_cents: subtotal,
        payments: [],
        paid_cents: unsafeCentavos(0),
        change_cents: unsafeCentavos(0),
        total_cents: null,
        last_event_sequence: e.terminal_sequence,
        correlation_id: e.correlation_id,
        checks: checks?.map(c => ({
            ...c,
            subtotal_cents: unsafeCentavos(c.subtotal_cents ?? 0),
            discount_cents: unsafeCentavos(c.discount_cents ?? 0),
            tip_cents: unsafeCentavos(c.tip_cents ?? 0),
            total_cents: unsafeCentavos(c.total_cents ?? 0),
            payment: c.payment ? {
                ...c.payment,
                payments: c.payment.payments.map(p => ({
                    ...p,
                    amount_cents: unsafeCentavos(p.amount_cents)
                }))
            } : { status: "UNPAID" as const, payments: [] }
        })) ?? [],
        fulfillment: fulfillment ? {
            table_number: fulfillment.table_number,
            guest_count: fulfillment.guest_count,
            pickup_name: fulfillment.pickup_name,
            pickup_phone: fulfillment.pickup_phone,
        } : undefined,
    };
}

export function applySaleEvent(
    sale: SaleProjection | null,
    e: ParkEvent
): ApplyResult<SaleProjection | null> {
    const warnings: string[] = [];

    // Migrate event to current schema version if needed
    const event = eventMigrator.migrate(e);

    // ORDER_CREATED - creates new order/sale
    if (event.event_type === "ORDER_CREATED") {
        if (sale && sale.status === "OPEN") {
            warnings.push("ORDER_CREATED recibido mientras hay venta OPEN; reemplazando venta activa.");
        }
        return { state: createOrderFromEvent(event), warnings };
    }

    if (!sale) {
        // If event arrives without active order, warn and ignore
        if (e.aggregate_type === "ORDER" || e.event_type.startsWith("ORDER_") || e.event_type.startsWith("CHECK_")) {
            warnings.push(`Evento ${e.event_type} sin orden activa; ignorado.`);
        }
        return { state: sale, warnings };
    }

    // If order already confirmed, don't apply mutations (except voids/credit notes)
    if (sale.status === "CONFIRMED" && e.event_type !== "INVOICE_VOIDED") {
        warnings.push(`Evento ${e.event_type} recibido después de CONFIRMED; ignorado.`);
        return { state: sale, warnings };
    }

    switch (e.event_type) {
        case "ORDER_ITEM_ADDED": {
            const { line } = e.payload;
            const { line_id, product_id, name, qty, unit_price_cents, status, station } = line;
            const prev = sale.lines[line_id];

            const newQty = (prev?.qty ?? 0) + qty;
            const line_total_cents = unsafeCentavos(newQty * unit_price_cents);

            sale.lines[line_id] = {
                line_id,
                product_id,
                name: name || prev?.name || "Unknown",
                qty: newQty,
                unit_price_cents: unsafeCentavos(unit_price_cents),
                line_total_cents,
                status: status ?? prev?.status ?? "PENDING",
                tax_category: line.tax_category ?? prev?.tax_category ?? "GRAVADO",
                station: station || prev?.station || "COCINA", // Preservar estación
                // Set created_at timestamp from event or line
                created_at: prev?.created_at ?? line.created_at ?? e.occurred_at,
                started_cooking_at: prev?.started_cooking_at ?? line.started_cooking_at,
                ready_at: prev?.ready_at ?? line.ready_at,
                served_at: prev?.served_at ?? line.served_at,
            };

            sale.subtotal_cents = computeSubtotal(sale.lines);

            // AUTO-ASSIGN TO DEFAULT CHECK
            // If there's exactly 1 check and it's UNPAID, add the item there too
            if (sale.checks.length >= 1) {
                const defaultCheck = sale.checks[0];
                // Only auto-add if check is not yet paid
                if (defaultCheck.payment?.status !== "PAID") {
                    const existingLineIdx = defaultCheck.lines.findIndex(l => l.line_id === line_id);
                    if (existingLineIdx >= 0) {
                        // Update qty
                        defaultCheck.lines[existingLineIdx].qty = newQty;
                    } else {
                        // Add new line reference
                        defaultCheck.lines.push({ line_id, qty: newQty });
                    }
                    // Recalculate check totals
                    let checkSubtotal = 0;
                    for (const l of defaultCheck.lines) {
                        const masterLine = sale.lines[l.line_id];
                        if (masterLine) {
                            checkSubtotal += masterLine.unit_price_cents * l.qty;
                        }
                    }
                    defaultCheck.subtotal_cents = unsafeCentavos(checkSubtotal);
                    defaultCheck.total_cents = unsafeCentavos(
                        checkSubtotal - defaultCheck.discount_cents + defaultCheck.tip_cents
                    );
                }
            }

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
                prev.line_total_cents = unsafeCentavos(to_qty * prev.unit_price_cents);
                sale.lines[line_id] = prev;
            }

            sale.subtotal_cents = computeSubtotal(sale.lines);
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_ITEM_VOIDED": {
            const { line_id } = e.payload;

            // 1. Remove from master sale lines
            delete sale.lines[line_id];
            sale.subtotal_cents = computeSubtotal(sale.lines);

            // 2. Remove from all checks where it might exist
            for (const check of sale.checks) {
                const initialLen = check.lines.length;
                check.lines = check.lines.filter(l => l.line_id !== line_id);

                // If check changed, recompute its totals
                if (check.lines.length !== initialLen) {
                    let checkSubtotal = 0;
                    for (const l of check.lines) {
                        const masterLine = sale.lines[l.line_id];
                        if (masterLine) {
                            checkSubtotal += masterLine.unit_price_cents * l.qty;
                        }
                    }
                    check.subtotal_cents = unsafeCentavos(checkSubtotal);
                    check.total_cents = unsafeCentavos(
                        checkSubtotal - check.discount_cents + check.tip_cents
                    );
                }
            }

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_CREATED": {
            const { check } = e.payload;
            logger.debug('reducer.check_created', 'CHECK_CREATED received', { check_id: check.check_id });
            // Idempotency check
            if (sale.checks.some(c => c.check_id === check.check_id)) {
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            // Map payload check to projection check (ensure fields)
            sale.checks.push({
                check_id: check.check_id,
                name: check.name,
                mode: check.mode,
                lines: check.lines ?? [],
                subtotal_cents: unsafeCentavos(check.subtotal_cents ?? 0),
                discount_cents: unsafeCentavos(check.discount_cents ?? 0),
                tip_cents: unsafeCentavos(check.tip_cents ?? 0),
                total_cents: unsafeCentavos(check.total_cents ?? 0),
                payment: check.payment ? {
                    ...check.payment,
                    payments: check.payment.payments.map(p => ({
                        ...p,
                        amount_cents: unsafeCentavos(p.amount_cents)
                    }))
                } : { status: "UNPAID" as const, payments: [] }
            });
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_ITEMS_UPDATED": {
            const { check_id, lines } = e.payload;
            const checkIndex = sale.checks.findIndex(c => c.check_id === check_id);
            if (checkIndex === -1) {
                warnings.push(`CHECK_ITEMS_UPDATED: check_id ${check_id} no existe; ignorado.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            // Update lines
            sale.checks[checkIndex].lines = lines;

            // Recalculate totals for this check
            let checkSubtotal = 0;
            for (const l of lines) {
                const masterLine = sale.lines[l.line_id];
                if (masterLine) {
                    checkSubtotal += masterLine.unit_price_cents * l.qty;
                }
            }
            sale.checks[checkIndex].subtotal_cents = unsafeCentavos(checkSubtotal);
            sale.checks[checkIndex].total_cents = unsafeCentavos(
                checkSubtotal - sale.checks[checkIndex].discount_cents + sale.checks[checkIndex].tip_cents
            );

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_ITEMS_MOVED": {
            const { from_check_id, to_check_id, lines } = e.payload;

            const sourceIdx = sale.checks.findIndex(c => c.check_id === from_check_id);
            const targetIdx = sale.checks.findIndex(c => c.check_id === to_check_id);

            if (sourceIdx === -1 || targetIdx === -1) {
                warnings.push(`CHECK_ITEMS_MOVED: Check source(${from_check_id}) or target(${to_check_id}) not found.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            // Logic: Remove from Source, Add to Target
            for (const itemToMove of lines) {
                const { line_id, qty } = itemToMove;

                // 1. Remove from Source
                const sourceCheck = sale.checks[sourceIdx];
                const sourceLineIdx = sourceCheck.lines.findIndex(l => l.line_id === line_id);
                if (sourceLineIdx !== -1) {
                    const sourceLine = sourceCheck.lines[sourceLineIdx];
                    if (sourceLine.qty <= qty) {
                        sourceCheck.lines.splice(sourceLineIdx, 1);
                    } else {
                        sourceLine.qty -= qty;
                        sourceCheck.lines[sourceLineIdx] = sourceLine;
                    }
                }

                // 2. Add to Target
                const targetCheck = sale.checks[targetIdx];
                const targetLineIdx = targetCheck.lines.findIndex(l => l.line_id === line_id);
                if (targetLineIdx !== -1) {
                    targetCheck.lines[targetLineIdx].qty += qty;
                } else {
                    targetCheck.lines.push({ line_id, qty });
                }
            }

            // Recalculate Totals for Both
            [sourceIdx, targetIdx].forEach(idx => {
                const c = sale.checks[idx];
                let sub = 0;
                for (const l of c.lines) {
                    const master = sale.lines[l.line_id];
                    if (master) sub += master.unit_price_cents * l.qty;
                }
                c.subtotal_cents = unsafeCentavos(sub);
                c.total_cents = unsafeCentavos(sub - c.discount_cents + c.tip_cents);
            });

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_PAYMENT_ADDED": {
            const { check_id, payment, idempotency_key } = e.payload;
            const { method, amount_cents } = payment;

            // Idempotency check: skip if this payment was already processed
            if (idempotency_key && sale.payments.some(
                existing => existing.idempotency_key === idempotency_key
            )) {
                warnings.push(`CHECK_PAYMENT_ADDED: idempotency_key ${idempotency_key} already processed; skipped.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            // Global Update
            const p: SalePayment = {
                method,
                amount_cents: unsafeCentavos(amount_cents),
                change_given_cents: unsafeCentavos(0),
                idempotency_key,
            };
            sale.payments.push(p);
            sale.paid_cents = unsafeCentavos(sale.paid_cents + amount_cents);

            // Check Specific Update
            const checkIndex = sale.checks.findIndex(c => c.check_id === check_id);
            if (checkIndex >= 0) {
                const check = sale.checks[checkIndex];
                check.payment.payments.push({ method, amount_cents: unsafeCentavos(amount_cents), ref: payment.ref, idempotency_key });

                // Recalculate Check Status
                const totalPaid = check.payment.payments.reduce((acc, curr) => acc + curr.amount_cents, 0);
                if (totalPaid >= check.total_cents && check.total_cents > 0) {
                    check.payment.status = "PAID";
                } else if (totalPaid > 0) {
                    check.payment.status = "PARTIAL";
                } else {
                    check.payment.status = "UNPAID";
                }
                sale.checks[checkIndex] = check;
            } else {
                warnings.push(`CHECK_PAYMENT_ADDED: check_id ${check_id} not found.`);
            }

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_MARKED_PAID": {
            const { check_id, change_cents } = e.payload;
            sale.change_cents = unsafeCentavos(change_cents ?? 0);

            // Update the specific check's payment status
            const checkIdx = sale.checks.findIndex(c => c.check_id === check_id);
            if (checkIdx >= 0) {
                sale.checks[checkIdx].payment.status = "PAID";
            }

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_DISCOUNT_SET": {
            const { check_id, discount_cents } = e.payload;
            const checkIdx = sale.checks.findIndex(c => c.check_id === check_id);

            if (checkIdx === -1) {
                warnings.push(`CHECK_DISCOUNT_SET: check_id ${check_id} no existe; ignorado.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            const check = sale.checks[checkIdx];
            check.discount_cents = unsafeCentavos(discount_cents);
            check.total_cents = unsafeCentavos(check.subtotal_cents - discount_cents + check.tip_cents);
            sale.checks[checkIdx] = check;

            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "CHECK_TIP_SET": {
            const { check_id, tip_cents } = e.payload;
            const checkIdx = sale.checks.findIndex(c => c.check_id === check_id);

            if (checkIdx === -1) {
                warnings.push(`CHECK_TIP_SET: check_id ${check_id} no existe; ignorado.`);
                sale.last_event_sequence = e.terminal_sequence;
                return { state: sale, warnings };
            }

            // Update tip and recalculate total
            const check = sale.checks[checkIdx];
            check.tip_cents = unsafeCentavos(tip_cents);
            check.total_cents = unsafeCentavos(check.subtotal_cents - check.discount_cents + tip_cents);
            sale.checks[checkIdx] = check;

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

            sale.total_cents = unsafeCentavos(total_cents);
            sale.status = "CONFIRMED";
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "INVOICE_VOIDED": {
            // Revert order back to OPEN so it can be re-invoiced or cancelled
            if (sale.status === "CONFIRMED") {
                sale.status = "OPEN";
                warnings.push("INVOICE_VOIDED: Orden regresada a OPEN.");
            }
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_CANCELLED": {
            sale.status = "CANCELLED";
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_ITEM_STATUS_CHANGED": {
            const { line_id, to } = e.payload;
            const line = sale.lines[line_id];
            if (line) {
                line.status = to;
                // Update timestamp based on new status
                const timestamp = e.occurred_at;
                switch (to) {
                    case "COOKING":
                        line.started_cooking_at = timestamp;
                        break;
                    case "READY":
                        line.ready_at = timestamp;
                        break;
                    case "DONE":
                        line.served_at = timestamp;
                        break;
                }
                sale.lines[line_id] = line;
            } else {
                warnings.push(`ORDER_ITEM_STATUS_CHANGED: line_id ${line_id} not found.`);
            }
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_SUBMITTED": {
            const { items_by_station, submitted_at } = e.payload;
            
            // Flatten all items from all stations
            const allSubmittedItems = Object.values(items_by_station).flat();
            
            // Mark each item as submitted
            for (const item of allSubmittedItems) {
                const line = sale.lines[item.line_id];
                if (line) {
                    // Keep status as PENDING so KDS can see it
                    // Add submitted_at timestamp if not already set (idempotency)
                    if (!line.submitted_at) {
                        line.submitted_at = submitted_at;
                    }
                    sale.lines[item.line_id] = line;
                } else {
                    warnings.push(`ORDER_SUBMITTED: line_id ${item.line_id} not found in order.`);
                }
            }
            
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_ITEM_NOTE": {
            const { line_id, note } = e.payload;
            const line = sale.lines[line_id];
            if (line) {
                line.notes = note;
                sale.lines[line_id] = line;
            } else {
                warnings.push(`ORDER_ITEM_NOTE: line_id ${line_id} not found; ignored.`);
            }
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        case "ORDER_TABLE_CHANGED": {
            const { to_table } = e.payload;
            if (sale.fulfillment) {
                sale.fulfillment.table_number = to_table;
            } else {
                sale.fulfillment = { table_number: to_table };
            }
            sale.last_event_sequence = e.terminal_sequence;
            return { state: sale, warnings };
        }

        default:
            // Events like SHIFT_* don't affect sale
            return { state: sale, warnings };
    }
}
