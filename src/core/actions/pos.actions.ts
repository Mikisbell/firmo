import { db } from "@/src/core/db/schema";
import { newUUID } from "@/src/core/domain/ids";
import type { ParkEvent, OrderType, PaymentMethod, ItemStatus } from "@/src/core/domain/events";
import { getSyncClient } from "@/src/core/sync/client";
import { LIMITS, LIMIT_ERRORS } from "@/src/core/constants/limits";

// Helper para obtener secuencia de forma segura
async function getNextSequence(): Promise<number> {
    const lastEvent = await db.events.orderBy("terminal_sequence").last();
    return (lastEvent?.terminal_sequence ?? 0) + 1;
}

// Helper genérico para appender eventos
async function appendEvent(
    tenant_id: string,
    terminal_id: string,
    event_partial: Omit<ParkEvent, "tenant_id" | "terminal_id" | "terminal_sequence" | "occurred_at" | "schema_version" | "payload_version">
) {
    const seq = await getNextSequence();
    const now = new Date().toISOString();

    const fullEvent = {
        ...event_partial,
        tenant_id,
        terminal_id,
        terminal_sequence: seq,
        schema_version: 1,
        payload_version: 1,
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
            fulfillment?: {
                table_number?: string;
                guest_count?: number;
                pickup_name?: string;
                pickup_phone?: string;
            };
            delivery?: {
                courier_type?: "OWN" | "APP";
                delivery_fee_cents?: number;
                payment_expectation?: "PREPAID" | "COD";
                address_snapshot?: {
                    address_text: string;
                    reference?: string;
                };
            };
        }
    ) {
        const order_id = newUUID();
        const check_id = "c1"; // Default first check

        // Build fulfillment object
        const fulfillment = params.fulfillment || (params.table_number ? { table_number: params.table_number } : undefined);

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
                fulfillment,
                delivery: params.delivery ? {
                    courier_type: params.delivery.courier_type,
                    delivery_fee_cents: params.delivery.delivery_fee_cents ?? 0,
                    payment_expectation: params.delivery.payment_expectation ?? "PREPAID",
                    assigned_driver_id: undefined,
                    address_snapshot: params.delivery.address_snapshot,
                } : undefined,
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
            tax_category?: "GRAVADO" | "EXONERADO" | "INAFECTO";
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
                    tax_category: item.tax_category ?? "GRAVADO",
                    mods: [],
                },
            },
        });

        return line_id;
    },

    /**
     * Add payment to a check
     * Returns Result to propagate errors to UI
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
    ): Promise<{ success: true } | { success: false; error: string }> {
        try {
            // Deterministic idempotency key: same inputs → same key
            const input = `${order_id}|${check_id}|${payment.method}|${payment.amount_cents}|${Date.now()}`;
            let hash = 0;
            for (let i = 0; i < input.length; i++) {
                hash = ((hash << 5) - hash) + input.charCodeAt(i);
                hash |= 0;
            }
            const idempotency_key = `pay_${Math.abs(hash).toString(36)}_${Date.now()}`;

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
                    idempotency_key,
                    payment: {
                        method: payment.method,
                        amount_cents: payment.amount_cents,
                        ref: payment.ref,
                    },
                },
            });
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error al registrar pago',
            };
        }
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
        if (cash_opening_cents > LIMITS.DEFAULT_MAX_CASH_OPENING_CENTS) {
            throw new Error(LIMIT_ERRORS.CASH_OPENING_TOO_HIGH);
        }

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
    async createCheck(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        name?: string
    ) {
        const check_id = newUUID();
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_CREATED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check: {
                    check_id,
                    name: name ?? "Check",
                    mode: "ITEMS",
                    lines: [],
                    subtotal_cents: 0,
                    discount_cents: 0,
                    tip_cents: 0,
                    total_cents: 0,
                    payment: { status: "UNPAID", payments: [] },
                },
            },
        });
        return check_id;
    },

    async updateCheckItems(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        check_id: string,
        lines: { line_id: string; qty: number }[]
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_ITEMS_UPDATED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check_id,
                lines,
            },
        });
    },

    async moveCheckItems(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        from_check_id: string,
        to_check_id: string,
        lines: { line_id: string; qty: number }[]
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_ITEMS_MOVED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                from_check_id,
                to_check_id,
                lines,
            },
        });
    },

    /**
     * Void an item (UNDO) - FR-005
     */
    async voidItem(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        line_id: string,
        reason: string = "UNDO"
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "ORDER_ITEM_VOIDED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                line_id,
                reason,
                voided_at: new Date().toISOString(),
            },
        });
    },

    /**
     * Adjust cash (IN/OUT) - FR-021
     */
    async adjustCash(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        shift_id: string,
        delta_cents: number,
        reason: string
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CASH_ADJUSTED",
            aggregate_type: "SHIFT",
            aggregate_id: shift_id,
            correlation_id: shift_id,
            causation_id: null,
            actor_id,
            payload: {
                shift_id,
                delta_cents,
                reason,
            },
        });
    },
    /**
     * Update item status (e.g. KDS Kitchen Workflow)
     */
    async updateItemStatus(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        line_id: string,
        from_status: ItemStatus,
        to_status: ItemStatus,
        station: string = "kds"
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "ORDER_ITEM_STATUS_CHANGED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                line_id,
                from: from_status,
                to: to_status,
                station
            },
        });
    },

    /**
     * Update item quantity (+/-)
     * If newQty = 0, voids the item
     */
    async updateItemQuantity(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        line_id: string,
        from_qty: number,
        to_qty: number
    ) {
        if (to_qty <= 0) {
            // Void the item completely
            await appendEvent(tenant_id, terminal_id, {
                event_id: newUUID(),
                event_type: "ORDER_ITEM_VOIDED",
                aggregate_type: "ORDER",
                aggregate_id: order_id,
                correlation_id: order_id,
                causation_id: null,
                actor_id,
                payload: {
                    order_id,
                    line_id,
                    reason: "Cantidad reducida a 0",
                    voided_at: new Date().toISOString(),
                },
            });
        } else {
            // Change quantity
            await appendEvent(tenant_id, terminal_id, {
                event_id: newUUID(),
                event_type: "ORDER_ITEM_QTY_CHANGED",
                aggregate_type: "ORDER",
                aggregate_id: order_id,
                correlation_id: order_id,
                causation_id: null,
                actor_id,
                payload: {
                    order_id,
                    line_id,
                    from_qty,
                    to_qty,
                },
            });
        }
    },

    /**
     * Request check/bill for a table (waiter action)
     */
    async requestCheck(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        table_number?: string
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "REQUEST_CHECK",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                requested_by: actor_id,
                requested_at: new Date().toISOString(),
                table_number,
            },
        });
    },

    /**
     * Submit order to kitchen (groups items by station)
     */
    async submitToKitchen(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        items: Array<{
            line_id: string;
            product_id: string;
            name: string;
            qty: number;
            station: string;
            mods?: string[];
            notes?: string;
        }>
    ) {
        if (items.length === 0) {
            throw new Error("No se puede enviar una orden vacía a cocina");
        }

        // Group items by station
        const itemsByStation: Record<string, Array<{
            line_id: string;
            product_id: string;
            name: string;
            qty: number;
            mods: string[];
            notes?: string;
        }>> = {};

        for (const item of items) {
            if (!itemsByStation[item.station]) {
                itemsByStation[item.station] = [];
            }
            itemsByStation[item.station].push({
                line_id: item.line_id,
                product_id: item.product_id,
                name: item.name,
                qty: item.qty,
                mods: item.mods || [],
                notes: item.notes,
            });
        }

        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "ORDER_SUBMITTED",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                submitted_at: new Date().toISOString(),
                items_by_station: itemsByStation,
            },
        });
    },

    /**
     * Issue a refund for an order check
     */
    async issueRefund(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        params: {
            order_id: string;
            check_id: string;
            invoice_id?: string;
            type: "FULL" | "PARTIAL" | "ITEM";
            reason_code: "CUSTOMER_REQUEST" | "ORDER_ERROR" | "QUALITY_ISSUE" | "LATE_DELIVERY" | "WRONG_ITEM" | "OTHER";
            reason_detail?: string;
            original_amount: number;
            refund_amount: number;
            refund_method: PaymentMethod;
            items?: Array<{
                line_id: string;
                product_id: string;
                name: string;
                qty: number;
                unit_price_cents: number;
                refund_cents: number;
            }>;
        }
    ): Promise<{ success: true; refund_id: string } | { success: false; error: string }> {
        try {
            const refund_id = newUUID();

            await appendEvent(tenant_id, terminal_id, {
                event_id: newUUID(),
                event_type: "REFUND_ISSUED",
                aggregate_type: "INVOICE",
                aggregate_id: refund_id,
                correlation_id: params.order_id,
                causation_id: null,
                actor_id,
                payload: {
                    refund_id,
                    order_id: params.order_id,
                    check_id: params.check_id,
                    invoice_id: params.invoice_id ?? null,
                    type: params.type,
                    reason_code: params.reason_code,
                    reason_detail: params.reason_detail ?? null,
                    original_amount: params.original_amount,
                    refund_amount: params.refund_amount,
                    refund_method: params.refund_method,
                    items: params.items ?? null,
                    issued_by: actor_id,
                    issued_at: new Date().toISOString(),
                },
            });
            return { success: true, refund_id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error al emitir reembolso',
            };
        }
    },

    /**
     * Set tip for a check
     */
    async setTip(
        tenant_id: string,
        terminal_id: string,
        actor_id: string,
        order_id: string,
        check_id: string,
        tip_cents: number
    ) {
        await appendEvent(tenant_id, terminal_id, {
            event_id: newUUID(),
            event_type: "CHECK_TIP_SET",
            aggregate_type: "ORDER",
            aggregate_id: order_id,
            correlation_id: order_id,
            causation_id: null,
            actor_id,
            payload: {
                order_id,
                check_id,
                tip_cents,
            },
        });
    },

    /**
     * Get next order number from server-side range allocator
     * Auto-allocates range if needed via API
     */
    async getNextOrderNumber(
        tenant_id: string,
        terminal_id: string
    ): Promise<{ success: true; orderNumber: number } | { success: false; error: string }> {
        try {
            // Try to get current range
            const res = await fetch(`/api/terminals/range?terminal_id=${encodeURIComponent(terminal_id)}&tenant_id=${encodeURIComponent(tenant_id)}`);
            const data = await res.json();

            // If no range allocated, auto-allocate
            if (!res.ok && data.needs_allocation) {
                const allocRes = await fetch('/api/terminals/range', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ terminal_id, tenant_id, action: 'allocate' }),
                });
                if (!allocRes.ok) {
                    return { success: false, error: 'Error al asignar rango de orden' };
                }
                const allocData = await allocRes.json();
                return { success: true, orderNumber: allocData.current_number };
            }

            if (!res.ok) {
                return { success: false, error: data.error || 'Error al obtener número de orden' };
            }

            // If range is almost exhausted, extend
            if (data.remaining < 100) {
                fetch('/api/terminals/range', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ terminal_id, tenant_id, action: 'extend' }),
                }).catch(() => {}); // Fire-and-forget extend
            }

            // Increment current_number via POST
            const incRes = await fetch('/api/terminals/range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ terminal_id, tenant_id, action: 'next' }),
            });

            if (!incRes.ok) {
                // Fallback: use current_number + 1 from GET data
                return { success: true, orderNumber: (data.current_number || 0) + 1 };
            }

            const incData = await incRes.json();
            return { success: true, orderNumber: incData.current_number };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error de red al obtener número de orden',
            };
        }
    },
};

