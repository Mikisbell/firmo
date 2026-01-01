import { db } from "@/src/core/db/schema";
import { newUUID, type UUID } from "@/src/core/domain/ids";
import type { ParkEvent, OrderType, PaymentMethod } from "@/src/core/domain/events";
import { getSyncClient } from "@/src/core/sync/client";

// Helper para obtener secuencia de forma segura
async function getNextSequence(): Promise<number> {
    const st = await db.sync_state.get("singleton");
    const count = await db.events.count();
    return (st?.last_terminal_sequence_acked ?? 0) + count + 1;
}

// Helper genérico para appender eventos
async function appendEvent(
    tenant_id: string,
    terminal_id: string,
    event_partial: Omit<ParkEvent, "tenant_id" | "terminal_id" | "terminal_sequence" | "occurred_at" | "schema_version">
) {
    const seq = await getNextSequence();
    const now = new Date().toISOString();

    const fullEvent = {
        ...event_partial,
        tenant_id,
        terminal_id,
        terminal_sequence: seq,
        schema_version: 1,
        occurred_at: now,
        synced: 0, // For Dexie local tracking
    };

    await db.events.add(fullEvent as any);

    // Trigger sync in background
    getSyncClient().start();
}

export const POSActions = {
    /**
     * Create a new order
     */
    async createOrder(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        params: {
            order_type: OrderType;
            order_number: number;
            table_number?: string;
        }
    ) {
        const order_id = newUUID();
        const check_id = "c1"; // Default first check

        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "ORDER_CREATED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                order_number: params.order_number,
                order_type: params.order_type,
                items: [],
                checks: [{
                    check_id,
                    name: "Principal",
                    mode: "ITEMS",
                    lines: [],
                    subtotal_cents: 0,
                    discount_cents: 0,
                    tip_cents: 0,
                    total_cents: 0,
                    payment: { status: "UNPAID", payments: [] },
                }],
                fulfillment: params.table_number ? { table_number: params.table_number } : undefined,
            },
        });

        return { order_id, check_id };
    },

    /**
     * Add item to order
     */
    async addItem(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        item: {
            product_id: string;
            sku: string;
            name: string;
            unit_price_cents: number;
            station: string;
            qty?: number;
        }
    ) {
        const line_id = newUUID();

        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "ORDER_ITEM_ADDED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                line: {
                    line_id,
                    product_id: item.product_id,
                    sku: item.sku,
                    name: item.name,
                    qty: item.qty ?? 1,
                    unit_price_cents: item.unit_price_cents,
                    station: item.station,
                    status: "PENDING",
                    mods: [],
                },
            },
        });

        return line_id;
    },

    /**
     * Add payment to a check
     */
    async addPayment(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        check_id: string,
        payment: {
            method: PaymentMethod;
            amount_cents: number;
            ref?: string;
        }
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_PAYMENT_ADDED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check_id,
                payment: {
                    method: payment.method,
                    amount_cents: payment.amount_cents,
                    ref: payment.ref,
                },
            },
        });
    },

    /**
     * Mark check as paid
     */
    async markCheckPaid(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        check_id: string,
        change_cents: number = 0
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_MARKED_PAID",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check_id,
                paid_at: new Date().toISOString(),
                change_cents,
            },
        });
    },

    /**
     * Issue invoice for a check
     */
    async issueInvoice(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        check_id: string,
        invoice_type: "BOLETA" | "FACTURA",
        total_cents: number
    ) {
        const invoice_id = newUUID();

        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "INVOICE_ISSUED",
            aggregate_type: "INVOICE",
            aggregate_id: invoice_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check_id,
                invoice_id,
                invoice_type,
                total_cents,
            },
        });

        return invoice_id;
    },

    /**
     * Open shift
     */
    async openShift(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        cash_opening_cents: number
    ) {
        const shift_id = newUUID();

        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "SHIFT_OPENED",
            aggregate_type: "SHIFT",
            aggregate_id: shift_id,
            correlation_id: shift_id,
            causation_id: null,
            actor_id,
            payload: {
                shift_id,
                cash_opening_cents,
            },
        });

        return shift_id;
    },

    /**
     * Close shift
     */
    async closeShift(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        shift_id: string,
        cash_counted_cents: number,
        notes?: string
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "SHIFT_CLOSED",
            aggregate_type: "SHIFT",
            aggregate_id: shift_id,
            correlation_id: shift_id,
            causation_id: null,
            actor_id,
            payload: {
                shift_id,
                cash_counted_cents,
                notes,
            },
        });
    },
};
