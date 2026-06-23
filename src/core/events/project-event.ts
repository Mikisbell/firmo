// src/core/events/project-event.ts
// Proyector de eventos del read-model. Se EXTRAJO del route handler del ingest
// (src/app/api/data-sync/ingest/route.ts) para poder REUTILIZARLO desde otros
// puntos de entrada que también deben entrar por la arquitectura event-sourced
// (p.ej. el portal QR del cliente), siguiendo el mismo patrón ya establecido con
// `markAsProcessed` (ver src/core/events/mark-processed.ts).
//
// REGLA DE INVARIANCIA: este módulo NO cambia el comportamiento del ingest. El
// route handler lo importa y lo invoca EXACTAMENTE como antes. Cualquier caller
// nuevo debe respetar el mismo contrato: correr dentro de una transacción `tx`,
// con dedup previo (`markAsProcessed`) y persistencia del evento en `events`.
import { Prisma } from "@prisma/client";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import type { ParkEvent, PaymentMethod } from "@/src/core/domain/events";
import { deductInventoryForOrder } from "@/src/core/inventory/deduction.service";
import { logger } from "@/src/core/observability/structured-logger";

/**
 * Narrows the payload of a ParkEvent for a given event_type literal.
 * Lets each switch case access strongly-typed payload fields without `any`.
 */
type PayloadOf<T extends ParkEvent["event_type"]> = Extract<
    ParkEvent,
    { event_type: T }
>["payload"];

/**
 * Shape of the `fulfillment` Json column on the `orders` model.
 * The column is typed as `Json?` by Prisma, so we cast to this documented
 * interface instead of `any`. Mirrors FulfillmentSchema in domain/events.ts.
 */
interface OrderFulfillment {
    table_number?: string;
    guest_count?: number;
    pickup_name?: string;
    pickup_phone?: string;
}

// Projections using Prisma (with idempotency check)
// Efectos secundarios de la deducción de inventario que NO deben correr dentro
// de la transacción del ingest (push notifications + Auto-86). Se acumulan
// durante la proyección y el caller los ejecuta DESPUÉS del commit con el
// prisma global. Así evitamos abrir conexiones extra dentro de la transacción.
export type DeductionSideEffect = {
    tenantId: string;
    productIdToReevaluate: string | null;
    alerts: import("@/src/core/inventory/deduction.service").DeductionAlert[];
};

export async function projectEvent(
    tx: Prisma.TransactionClient,
    event: ParkEvent,
    deductionSink?: DeductionSideEffect[],
): Promise<boolean> {
    const { event_type, tenant_id, occurred_at, terminal_id, actor_id } = event;

    // 3. Project the event
    try {
        switch (event_type) {
            case "ORDER_CREATED": {
                const p = event.payload as PayloadOf<"ORDER_CREATED">;
                await tx.orders.upsert({
                    where: { id: p.order_id },
                    create: {
                        id: p.order_id,
                        tenant_id,
                        order_number: p.order_number,
                        order_type: p.order_type,
                        order_status: "OPEN",
                        fulfillment_status: "COOKING",
                        handoff_status: "WAITING",
                        stations_active: [],
                        unpaid_checks_count: 1,
                        subtotal_cents: 0,
                        discount_cents: 0,
                        total_cents: 0,
                        items: p.items || [],
                        checks: p.checks || [],
                        terminal_id,
                        created_at: new Date(occurred_at),
                        updated_at: new Date(occurred_at),
                    },
                    update: {
                        updated_at: new Date(occurred_at),
                    },
                });

                // FIX agujero #2180/#2179 (council bugs/order-created-projection-hole):
                // proyectar CADA item que NACE en ORDER_CREATED a order_item_projections.
                // Antes, el ÚNICO INSERT vivía en ORDER_ITEM_ADDED, así que las líneas
                // creadas en el snapshot inicial quedaban SIN fila en la proyección →
                // invisibles para KDS/ready-items y con status congelado (los UPDATE
                // de STATUS_CHANGED afectaban 0 filas). Replica EXACTAMENTE el INSERT de
                // ORDER_ITEM_ADDED (mismas columnas, status='PENDING' inicial).
                //
                // SEMÁNTICA DE REPLAY — `ON CONFLICT (order_id, line_id) DO NOTHING`
                // (NO `DO UPDATE`): ORDER_CREATED aporta SOLO el status INICIAL. Si la
                // fila YA existe (un ITEM_ADDED/STATUS_CHANGED la creó/avanzó en otro
                // orden de aplicación durante un rebuild/reproceso), ORDER_CREATED NO la
                // toca. Así nunca degrada un status más avanzado (READY/DONE) de vuelta
                // a PENDING. El `table_number` se lee del payload (`p.fulfillment`),
                // porque ORDER_CREATED no persiste la columna `fulfillment` en `orders`.
                const fulfillmentPayload = p.fulfillment as OrderFulfillment | undefined;
                const createdTableNumber: string | null =
                    fulfillmentPayload?.table_number ?? null;
                for (const line of p.items ?? []) {
                    await tx.$executeRaw`
                        INSERT INTO order_item_projections
                            (tenant_id, order_id, line_id, table_number, waiter_id, name, qty, station, status, created_at, updated_at)
                        VALUES (
                            ${tenant_id}::uuid,
                            ${p.order_id}::uuid,
                            ${line.line_id},
                            ${createdTableNumber},
                            ${actor_id ?? null}::uuid,
                            ${line.name},
                            ${line.qty ?? 1},
                            ${line.station ?? 'COCINA'},
                            'PENDING',
                            ${new Date(occurred_at)},
                            ${new Date(occurred_at)}
                        )
                        ON CONFLICT (order_id, line_id) DO NOTHING
                    `;
                }
                break;
            }

            case "ORDER_ITEM_ADDED": {
                const p = event.payload as PayloadOf<"ORDER_ITEM_ADDED">;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const items = (order.items as Prisma.JsonArray) || [];
                    const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            items: [...items, p.line] as Prisma.InputJsonValue,
                            subtotal_cents: order.subtotal_cents + lineCents,
                            total_cents: order.total_cents + lineCents,
                            updated_at: new Date(occurred_at),
                        },
                    });

                    // Project to order_item_projections for fast lifecycle queries
                    // fulfillment is a Json? column; cast to the documented shape.
                    const fulfillment = order.fulfillment as OrderFulfillment | null;
                    const tableNumber: string | null = fulfillment?.table_number ?? null;
                    await tx.$executeRaw`
                        INSERT INTO order_item_projections
                            (tenant_id, order_id, line_id, table_number, waiter_id, name, qty, station, status, created_at, updated_at)
                        VALUES (
                            ${tenant_id}::uuid,
                            ${p.order_id}::uuid,
                            ${p.line.line_id},
                            ${tableNumber},
                            ${actor_id ?? null}::uuid,
                            ${p.line.name},
                            ${p.line.qty ?? 1},
                            ${p.line.station ?? 'COCINA'},
                            'PENDING',
                            ${new Date(occurred_at)},
                            ${new Date(occurred_at)}
                        )
                        ON CONFLICT (order_id, line_id) DO NOTHING
                    `;
                }
                break;
            }

            case "CHECK_CREATED": {
                const p = event.payload as PayloadOf<"CHECK_CREATED">;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const checks = (order.checks as Prisma.JsonArray) || [];
                    const exists = checks.some(
                        (c): boolean =>
                            !!c &&
                            typeof c === "object" &&
                            (c as { check_id?: string }).check_id === p.check?.check_id
                    );
                    if (!exists && p.check) {
                        await tx.orders.update({
                            where: { id: p.order_id },
                            data: {
                                checks: [...checks, p.check] as Prisma.InputJsonValue,
                                unpaid_checks_count: (order.unpaid_checks_count ?? 0) + 1,
                                updated_at: new Date(occurred_at),
                            },
                        });
                    }
                }
                break;
            }

            case "CHECK_PAYMENT_ADDED": {
                // Schema payload nests payment under `payment`; legacy clients sent
                // flat fields (paymentId/amountCents/method/reference). Support both
                // shapes without `any` via a documented legacy-extension type.
                type CheckPaymentLegacy = PayloadOf<"CHECK_PAYMENT_ADDED"> & {
                    payment?: { id?: string };
                    paymentId?: string;
                    amountCents?: number;
                    method?: PaymentMethod;
                    reference?: string | null;
                };
                const p = event.payload as CheckPaymentLegacy;
                const paymentId = p.payment?.id || p.paymentId || uuidv4();
                const amountCents = p.payment?.amount_cents ?? p.amountCents ?? 0;
                const method = p.payment?.method ?? p.method ?? 'CASH';
                await tx.payments.upsert({
                    where: { id: paymentId },
                    create: {
                        id: paymentId,
                        tenant_id,
                        order_id: p.order_id,
                        check_id: p.check_id,
                        amount_cents: amountCents,
                        payment_method: method,
                        reference: p.payment?.ref ?? p.reference ?? null,
                        status: 'COMPLETED',
                        processed_at: new Date(occurred_at),
                        processed_by: actor_id ?? null,
                        shift_id: event.shift_id ?? null,
                        terminal_id: terminal_id ?? '',
                    },
                    update: {},
                });

                // Update order.checks[].payment for CHECK_MARKED_PAID validation
                const payOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (payOrder) {
                    const checks = (payOrder.checks as Prisma.JsonArray) || [];
                    const updated = checks.map((c) => {
                        const check = c as {
                            check_id?: string;
                            payment?: { payments?: unknown[] };
                            [key: string]: unknown;
                        };
                        if (check.check_id !== p.check_id) return c;
                        const existing = check.payment?.payments || [];
                        return {
                            ...check,
                            payment: {
                                status: 'PARTIAL',
                                payments: [...existing, { amount_cents: amountCents, method }],
                            },
                        };
                    });
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: { checks: updated as Prisma.InputJsonValue, updated_at: new Date(occurred_at) },
                    });
                }
                break;
            }

            case "CHECK_MARKED_PAID": {
                const p = event.payload as PayloadOf<"CHECK_MARKED_PAID">;
                // Update check payment status to PAID in order.checks[]
                const paidOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (paidOrder) {
                    const paidChecks = (paidOrder.checks as Prisma.JsonArray) || [];
                    const updatedChecks = paidChecks.map((c) => {
                        const check = c as {
                            check_id?: string;
                            payment?: Record<string, unknown>;
                            [key: string]: unknown;
                        };
                        if (check.check_id !== p.check_id) return c;
                        // Persist change_cents (vuelto) in the check JSON.
                        // No dedicated column exists for it (orders.checks is Json);
                        // the full payload is also retained in the events table.
                        return {
                            ...check,
                            status: 'PAID',
                            change_cents: p.change_cents ?? 0,
                            payment: { ...check.payment, status: 'PAID' },
                        };
                    });
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            checks: updatedChecks as Prisma.InputJsonValue,
                            unpaid_checks_count: { decrement: 1 },
                            updated_at: new Date(occurred_at),
                        },
                    });
                } else {
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            unpaid_checks_count: { decrement: 1 },
                            updated_at: new Date(occurred_at),
                        },
                    });
                }
                break;
            }

            case "INVOICE_ISSUED": {
                const p = event.payload as PayloadOf<"INVOICE_ISSUED">;
                await tx.invoices.upsert({
                    where: {
                        tenant_id_order_id_check_id: {
                            tenant_id,
                            order_id: p.order_id,
                            check_id: p.check_id,
                        },
                    },
                    create: {
                        id: p.invoice_id,
                        tenant_id,
                        order_id: p.order_id,
                        check_id: p.check_id,
                        invoice_type: p.invoice_type,
                        series: p.series || null,
                        invoice_number: p.invoice_number || null,
                        total_cents: p.total_cents,
                        status: "ISSUED",
                        created_at: new Date(occurred_at),
                    },
                    update: {},
                });
                break;
            }

            case "INVOICE_VOIDED": {
                const p = event.payload as PayloadOf<"INVOICE_VOIDED">;
                await tx.invoices.update({
                    where: { id: p.invoice_id },
                    data: {
                        status: "VOIDED",
                        void_reason: p.reason,
                        voided_by: p.approved_by,
                        voided_at: new Date(occurred_at),
                    },
                }).catch((err: unknown) => {
                    logger.warn('INVOICE_VOIDED: invoice not found (out-of-order events)', {
                        invoiceId: p.invoice_id,
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
                break;
            }

            case "CREDIT_NOTE_ISSUED": {
                const p = event.payload as PayloadOf<"CREDIT_NOTE_ISSUED">;
                await tx.credit_notes.upsert({
                    where: { id: p.credit_note_id },
                    create: {
                        id: p.credit_note_id,
                        tenant_id,
                        invoice_id: p.invoice_id,
                        series: p.series,
                        number: p.number,
                        total_cents: p.total_cents,
                        reason: p.reason,
                        status: "ISSUED",
                        sunat_status: "PENDING",
                        created_by: actor_id!,
                    },
                    update: {},
                });
                break;
            }

            case "CREDIT_NOTE_VOIDED": {
                const p = event.payload as PayloadOf<"CREDIT_NOTE_VOIDED">;
                await tx.credit_notes.update({
                    where: { id: p.credit_note_id },
                    data: {
                        status: "VOIDED",
                    },
                }).catch((err: unknown) => {
                    logger.warn('CREDIT_NOTE_VOIDED: credit note not found (out-of-order events)', {
                        creditNoteId: p.credit_note_id,
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
                break;
            }

            case "SALES_NOTE_ISSUED": {
                // Nota de Venta (pre-cuenta interna). Mismo modelo que el registry
                // (sales-note-projections.ts): upsert idempotente por check.
                const p = event.payload as PayloadOf<"SALES_NOTE_ISSUED">;
                await tx.sales_notes.upsert({
                    where: {
                        tenant_id_order_id_check_id: {
                            tenant_id,
                            order_id: p.order_id,
                            check_id: p.check_id,
                        },
                    },
                    create: {
                        id: p.sales_note_id,
                        tenant_id,
                        order_id: p.order_id,
                        check_id: p.check_id,
                        serie: p.serie,
                        numero: p.numero,
                        total_cents: p.total_cents,
                        status: "OPEN",
                        created_at: new Date(occurred_at),
                    },
                    update: {},
                });
                break;
            }

            case "SALES_NOTE_CONVERTED": {
                // Solo afecta notas OPEN (no pisa CONVERTED/VOIDED). Defensa en profundidad.
                const p = event.payload as PayloadOf<"SALES_NOTE_CONVERTED">;
                await tx.sales_notes.updateMany({
                    where: { tenant_id, id: p.sales_note_id, status: "OPEN" },
                    data: {
                        status: "CONVERTED",
                        invoice_id: p.invoice_id,
                        invoice_type: p.invoice_type,
                        converted_at: new Date(occurred_at),
                    },
                });
                break;
            }

            case "SALES_NOTE_VOIDED": {
                const p = event.payload as PayloadOf<"SALES_NOTE_VOIDED">;
                await tx.sales_notes.updateMany({
                    where: { tenant_id, id: p.sales_note_id, status: "OPEN" },
                    data: {
                        status: "VOIDED",
                        void_reason: p.reason,
                        voided_at: new Date(occurred_at),
                    },
                });
                break;
            }

            case "SHIFT_OPENED": {
                const p = event.payload as PayloadOf<"SHIFT_OPENED">;

                // Validate opening cash does not exceed tenant max
                const tenantSettings = await tx.tenant_settings.findFirst({
                    where: { tenant_id },
                    select: { max_cash_opening_cents: true },
                });
                const maxOpening = tenantSettings?.max_cash_opening_cents ?? 50_000;
                if (p.cash_opening_cents > maxOpening) {
                    logger.warn('Monto de apertura excede máximo configurado', {
                        tenantId: tenant_id,
                        cashOpeningCents: p.cash_opening_cents,
                        maxCents: maxOpening,
                    });
                    return false; // Reject this projection
                }

                // H3: Auto-close any existing OPEN shifts on this terminal
                // Prevents overlapping shifts on the same terminal
                await tx.shifts.updateMany({
                    where: {
                        tenant_id,
                        terminal_id,
                        status: "OPEN",
                    },
                    data: {
                        status: "CLOSED",
                        closed_at: new Date(occurred_at),
                        closed_by: actor_id,
                    },
                });

                await tx.shifts.upsert({
                    where: { id: p.shift_id },
                    create: {
                        id: p.shift_id,
                        tenant_id,
                        terminal_id,
                        status: "OPEN",
                        opened_at: new Date(occurred_at),
                        opened_by: actor_id!,
                        cash_opening_cents: p.cash_opening_cents,
                        cash_expected_cents: p.cash_opening_cents,
                    },
                    update: {},
                });
                break;
            }

            case "CASH_ADJUSTED": {
                const p = event.payload as PayloadOf<"CASH_ADJUSTED">;
                const delta = p.delta_cents ?? 0;
                // Adjust cash_expected_cents incrementally
                await tx.shifts.updateMany({
                    where: {
                        id: p.shift_id,
                        tenant_id,
                        status: "OPEN",
                    },
                    data: {
                        cash_expected_cents: { increment: delta },
                    },
                });
                break;
            }

            case "SHIFT_CLOSED": {
                const p = event.payload as PayloadOf<"SHIFT_CLOSED">;
                // Fetch current shift state
                const currentShift = await tx.shifts.findFirst({
                    where: { id: p.shift_id, tenant_id },
                    select: { cash_opening_cents: true, cash_expected_cents: true },
                });

                // Sum CASH payments received during this shift
                const cashPayments = await tx.payments.aggregate({
                    where: {
                        tenant_id,
                        shift_id: p.shift_id,
                        payment_method: "CASH",
                        status: "COMPLETED",
                    },
                    _sum: { amount_cents: true },
                });
                const cashSalesIn = cashPayments._sum.amount_cents ?? 0;

                const openingCents = currentShift?.cash_opening_cents ?? 0;
                // cash_expected_cents tracks opening + CASH_ADJUSTED deltas (via increment)
                // Add CASH sales on top
                const adjustmentsDelta = (currentShift?.cash_expected_cents ?? openingCents) - openingCents;
                const cashExpected = openingCents + cashSalesIn + adjustmentsDelta;

                const cashCounted = p.cash_counted_cents ?? 0;
                const diffCents = cashCounted - cashExpected;

                await tx.shifts.update({
                    where: { id: p.shift_id },
                    data: {
                        status: "CLOSED",
                        closed_at: new Date(occurred_at),
                        closed_by: actor_id,
                        cash_expected_cents: cashExpected,
                        cash_counted_cents: cashCounted,
                        diff_cents: diffCents,
                    },
                });
                break;
            }

            case "REFUND_ISSUED": {
                const p = event.payload as PayloadOf<"REFUND_ISSUED">;
                await tx.refunds.upsert({
                    where: { id: p.refund_id },
                    create: {
                        id: p.refund_id,
                        tenant_id,
                        order_id: p.order_id,
                        check_id: p.check_id,
                        invoice_id: p.invoice_id ?? null,
                        type: p.type,
                        status: "ISSUED",
                        reason_code: p.reason_code,
                        reason_detail: p.reason_detail ?? null,
                        requested_by: actor_id!,
                        authorized_by: actor_id!,
                        original_amount: p.original_amount,
                        refund_amount: p.refund_amount,
                        refund_method: p.refund_method,
                        // items is a nullable Json column; use Prisma.JsonNull sentinel when absent.
                        items: p.items ?? Prisma.JsonNull,
                        issued_at: new Date(occurred_at),
                        authorized_at: new Date(occurred_at),
                    },
                    update: {},
                });
                break;
            }

            case "CHECK_TIP_SET": {
                const p = event.payload as PayloadOf<"CHECK_TIP_SET">;
                const activeShift = await tx.shifts.findFirst({
                    where: { tenant_id, terminal_id, status: "OPEN" },
                    select: { id: true },
                });
                if (!activeShift) {
                    // No open shift — skip tip projection (tip still recorded in event)
                    break;
                }
                const tipOrder = await tx.orders.findUnique({
                    where: { id: p.order_id },
                    select: { location_id: true, waiter_id: true },
                });
                // Use deterministic UUID v5-style ID for upsert idempotency
                const tipId = uuidv5(`${p.order_id}-${p.check_id}-tip`, uuidv5.URL);
                await tx.tips.upsert({
                    where: { id: tipId },
                    create: {
                        id: tipId,
                        tenant_id,
                        location_id: tipOrder?.location_id ?? tenant_id,
                        order_id: p.order_id,
                        shift_id: activeShift.id,
                        amount: p.tip_cents,
                        payment_method: 'CASH',
                        waiter_id: tipOrder?.waiter_id ?? actor_id!,
                    },
                    update: { amount: p.tip_cents },
                });
                break;
            }

            case "CHECK_DISCOUNT_SET": {
                const p = event.payload as PayloadOf<"CHECK_DISCOUNT_SET">;
                const discountOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (discountOrder) {
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            discount_cents: p.discount_cents,
                            total_cents: Math.max(0, discountOrder.subtotal_cents - p.discount_cents),
                        },
                    });
                }
                break;
            }

            case "ORDER_ITEM_QTY_CHANGED": {
                const p = event.payload as PayloadOf<"ORDER_ITEM_QTY_CHANGED">;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    type OrderLineJson = { line_id?: string; qty?: number; unit_price_cents?: number; [key: string]: unknown };
                    const items = ((order.items as Prisma.JsonArray) || []) as OrderLineJson[];
                    const itemIndex = items.findIndex((i) => i.line_id === p.line_id);
                    if (itemIndex >= 0) {
                        const oldItem = items[itemIndex];
                        const oldLineCents = (oldItem.qty || 1) * (oldItem.unit_price_cents || 0);
                        const newLineCents = (p.to_qty) * (oldItem.unit_price_cents || 0);
                        const diff = newLineCents - oldLineCents;
                        const updatedItems = [...items];
                        updatedItems[itemIndex] = { ...oldItem, qty: p.to_qty };
                        await tx.orders.update({
                            where: { id: p.order_id },
                            data: {
                                items: updatedItems as Prisma.InputJsonValue,
                                subtotal_cents: order.subtotal_cents + diff,
                                total_cents: order.total_cents + diff,
                                updated_at: new Date(occurred_at),
                            },
                        });
                    }
                }
                break;
            }

            case "ORDER_ITEM_STATUS_CHANGED": {
                const p = event.payload as PayloadOf<"ORDER_ITEM_STATUS_CHANGED">;
                // When item is marked DONE, deduct inventory based on recipe
                if (p.to === "DONE") {
                    const order = await tx.orders.findUnique({ where: { id: event.aggregate_id } });
                    if (order) {
                        // OrderLine items always carry product_id (OrderLineSchema requires it).
                        type OrderLineJson = { line_id?: string; product_id: string; qty?: number; [key: string]: unknown };
                        const items = ((order.items as Prisma.JsonArray) || []) as unknown as OrderLineJson[];
                        const item = items.find((i) => i.line_id === p.line_id);
                        if (item) {
                            // Get location from order or use default (location_id is a typed column)
                            const locationId = order.location_id || tenant_id;

                            // H5: Await deduction — log failures for reconciliation.
                            // Pasamos `tx` (no el prisma global): la deducción es atómica
                            // con la proyección y comparte la conexión de la transacción,
                            // evitando la transacción anidada que saturaba el pool.
                            const deductionResult = await deductInventoryForOrder(
                                tx,
                                tenant_id,
                                locationId,
                                event.aggregate_id,
                                p.line_id,
                                item.product_id,
                                item.qty || 1
                            ).catch((err) => ({
                                success: false as const,
                                deductions: [],
                                alerts: [],
                                productIdToReevaluate: null,
                                error: err instanceof Error ? err.message : String(err),
                            }));

                            if (!deductionResult.success) {
                                // Log structured failure for reconciliation
                                logger.warn('Deducción de inventario falló', {
                                    orderId: event.aggregate_id,
                                    lineId: p.line_id,
                                    deductionError: deductionResult.error,
                                });
                            } else if (deductionSink) {
                                // Acumula efectos secundarios para ejecutarlos post-commit
                                // (push notifications de stock + Auto-86), fuera de la tx.
                                deductionSink.push({
                                    tenantId: tenant_id,
                                    productIdToReevaluate: deductionResult.productIdToReevaluate,
                                    alerts: deductionResult.alerts,
                                });
                            }
                        }
                    }
                }

                // Project status change to order_item_projections
                {
                    const now = new Date(occurred_at);
                    const readyAt = p.to === 'READY' ? now : null;
                    const servedAt = p.to === 'DONE' ? now : null;
                    await tx.$executeRaw`
                        UPDATE order_item_projections
                        SET
                            status     = ${p.to},
                            ready_at   = COALESCE(ready_at,   ${readyAt}),
                            served_at  = COALESCE(served_at,  ${servedAt}),
                            updated_at = ${now}
                        WHERE order_id = ${p.order_id}::uuid
                          AND line_id  = ${p.line_id}
                    `;
                }
                break;
            }

            case "ORDER_SUBMITTED": {
                // Mark all submitted items as IN_KITCHEN in the projection
                const p = event.payload as PayloadOf<"ORDER_SUBMITTED">;
                const now = new Date(occurred_at);
                // items_by_station: { [station]: [{line_id, ...}] }
                const itemsByStation = p.items_by_station;
                for (const lineItems of Object.values(itemsByStation ?? {})) {
                    for (const item of lineItems) {
                        await tx.$executeRaw`
                            UPDATE order_item_projections
                            SET
                                status       = 'IN_KITCHEN',
                                submitted_at = COALESCE(submitted_at, ${now}),
                                updated_at   = ${now}
                            WHERE order_id = ${p.order_id}::uuid
                              AND line_id  = ${item.line_id}
                              AND status   = 'PENDING'
                        `;
                    }
                }
                break;
            }

            case "ORDER_ITEM_VOIDED": {
                const p = event.payload as PayloadOf<"ORDER_ITEM_VOIDED">;
                await tx.$executeRaw`
                    DELETE FROM order_item_projections
                    WHERE order_id = ${p.order_id}::uuid
                      AND line_id  = ${p.line_id}
                `;
                break;
            }

            case "ORDER_ITEM_NOTE": {
                const p = event.payload as PayloadOf<"ORDER_ITEM_NOTE">;
                await tx.$executeRaw`
                    UPDATE order_item_projections
                    SET notes = ${p.note}, updated_at = ${new Date(occurred_at)}
                    WHERE order_id = ${p.order_id}::uuid
                      AND line_id  = ${p.line_id}
                `;
                break;
            }

            case "ORDER_TABLE_CHANGED": {
                // Update table_number on all projection rows for this order
                const p = event.payload as PayloadOf<"ORDER_TABLE_CHANGED">;
                await tx.$executeRaw`
                    UPDATE order_item_projections
                    SET table_number = ${p.to_table}, updated_at = ${new Date(occurred_at)}
                    WHERE order_id = ${p.order_id}::uuid
                `;
                break;
            }

            case "ORDER_CANCELLED": {
                // Remove all projection rows — order is gone
                const p = event.payload as PayloadOf<"ORDER_CANCELLED">;
                await tx.$executeRaw`
                    DELETE FROM order_item_projections
                    WHERE order_id = ${p.order_id}::uuid
                `;
                break;
            }
        }
    } catch (e) {
        logger.error('Error al proyectar evento', e instanceof Error ? e : new Error(String(e)), {
            eventType: event_type,
            eventId: event.event_id,
        });
        return false; // Projection failed — event should NOT be marked as processed
    }

    return true;
}
