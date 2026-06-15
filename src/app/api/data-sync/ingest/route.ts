import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/src/core/db/prisma";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";
import { validateEvent, type ValidationResult } from "@/src/core/validation";
import { deductInventoryForOrder } from "@/src/core/inventory/deduction.service";
import { detectAndResolveConflict } from "@/src/core/conflict/conflict-resolver";
import { registerNotificationHandlers } from "@/src/core/notifications/event-listener";
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { outOfOrderQueue, startCleanupJob } from "@/src/core/events/out-of-order-queue";
import { rateLimiter } from "@/src/core/rate-limiting/rate-limiter";
import { logger } from '@/src/core/observability/structured-logger';
import { startSpan, endSpan } from '@/src/core/observability/tracing';
import { eventMigrator } from "@/src/core/domain/event-migrator";
import { handleCorsPreflightRequest, addCorsHeaders } from "@/src/lib/cors-helpers";
import "@/src/core/domain/migrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Iniciar cleanup job al cargar el módulo
startCleanupJob();

// Error Helpers
type ApiError = {
    error_code: string;
    severity: "INFO" | "WARN" | "ERROR" | "FATAL";
    message: string;
    user_action: string;
    retryable: boolean;
    context?: Record<string, unknown>;
};

function err(
    error_code: string,
    message: string,
    user_action: string,
    opts?: { severity?: ApiError["severity"]; retryable?: boolean; context?: Record<string, unknown> }
): ApiError {
    return {
        error_code,
        message,
        user_action,
        severity: opts?.severity ?? "ERROR",
        retryable: opts?.retryable ?? false,
        context: opts?.context,
    };
}

function serverError(apiError: ApiError, status = 500) {
    return NextResponse.json({ accepted: false, error: apiError }, { status });
}

/**
 * Verifica si un evento tiene todas sus dependencias satisfechas
 * 
 * @returns { hasDependency: boolean, reason?: string }
 */
async function checkDependencies(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<{ hasDependency: boolean; reason?: string }> {
    const { event_type, aggregate_id } = event;

    // All ORDER-aggregate events (except ORDER_CREATED itself) require the order to exist
    const ORDER_DEPENDENT_EVENTS = new Set([
        'ORDER_ITEM_ADDED', 'ORDER_ITEM_QTY_CHANGED', 'ORDER_ITEM_STATUS_CHANGED',
        'ORDER_ITEM_VOIDED', 'ORDER_ITEM_NOTE', 'ORDER_TABLE_CHANGED',
        'ORDER_SUBMITTED', 'ORDER_CANCELLED',
        'CHECK_CREATED', 'CHECK_PAYMENT_ADDED', 'CHECK_MARKED_PAID',
        'CHECK_TIP_SET', 'CHECK_DISCOUNT_SET', 'CHECK_ITEMS_UPDATED', 'CHECK_ITEMS_MOVED',
        'REFUND_ISSUED', 'REQUEST_CHECK',
    ]);

    if (ORDER_DEPENDENT_EVENTS.has(event_type)) {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true },
        });
        if (!order) {
            return { hasDependency: true, reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found' };
        }
    }

    // INVOICE_ISSUED: aggregate_type is INVOICE so aggregate_id is the invoice UUID
    if (event_type === 'INVOICE_ISSUED') {
        const invoicePayload = event.payload as { order_id?: string };
        const order = await tx.orders.findUnique({
            where: { id: invoicePayload.order_id ?? aggregate_id },
            select: { id: true },
        });
        if (!order) {
            return { hasDependency: true, reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found' };
        }
    }

    // SHIFT_CLOSED and CASH_ADJUSTED require the shift to exist
    if (event_type === 'SHIFT_CLOSED' || event_type === 'CASH_ADJUSTED') {
        const shiftPayload = event.payload as { shift_id: string };
        const shift = await tx.shifts.findUnique({
            where: { id: shiftPayload.shift_id },
            select: { id: true },
        });
        if (!shift) {
            return { hasDependency: true, reason: 'DEPENDENCY_MISSING: SHIFT_OPENED not found' };
        }
    }

    return { hasDependency: false };
}

/**
 * Marca un evento como procesado de manera atómica.
 * Usa INSERT con manejo de constraint violation para idempotencia.
 * 
 * @returns { isDuplicate: boolean } - true si el evento ya fue procesado
 */
async function markAsProcessed(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<{ isDuplicate: boolean }> {
    try {
        // Intentar insertar en processed_events
        // Si el evento ya existe, el constraint UNIQUE en event_id causará P2002
        await tx.processed_events.create({
            data: {
                event_id: event.event_id,
                tenant_id: event.tenant_id,
                aggregate_id: event.aggregate_id,
                event_type: event.event_type,
                processor: 'ingest-api',
            }
        });
        
        return { isDuplicate: false };
    } catch (e: unknown) {
        // P2002 = Unique constraint violation (evento duplicado)
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            // Logging estructurado para eventos deduplicados
            logger.info('Evento duplicado detectado, ya fue procesado', {
                eventId: event.event_id,
                tenantId: event.tenant_id,
                eventType: event.event_type,
                aggregateId: event.aggregate_id,
                processor: 'ingest-api',
            });
            return { isDuplicate: true };
        }
        // Otro error - propagar
        throw e;
    }
}

// Projections using Prisma (with idempotency check)
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent): Promise<boolean> {
    const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;

    // 3. Project the event
    try {
        switch (event_type) {
            case "ORDER_CREATED": {
                const p = payload as any;
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

                // CQRS Projection: Update Tables
                if (p.order_type === 'DINE_IN' && p.fulfillment?.table_number) {
                    await tx.$executeRaw`
                        UPDATE tables 
                        SET status = 'OCCUPIED', 
                            current_order_id = ${p.order_id}::uuid,
                            occupied_since = ${new Date(occurred_at)}
                        WHERE tenant_id = ${tenant_id}::uuid 
                          AND number = ${p.fulfillment.table_number}
                    `;
                }
                break;
            }

            case "ORDER_ITEM_ADDED": {
                const p = payload as any;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const items = order.items as any[] || [];
                    const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            items: [...items, p.line],
                            subtotal_cents: order.subtotal_cents + lineCents,
                            total_cents: order.total_cents + lineCents,
                            updated_at: new Date(occurred_at),
                        },
                    });

                    // Project to order_item_projections for fast lifecycle queries
                    const fulfillment = (order as any).fulfillment as any;
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
                const p = payload as any;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const checks = (order.checks as any[]) || [];
                    const exists = checks.some((c: any) => c.check_id === p.check?.check_id);
                    if (!exists && p.check) {
                        await tx.orders.update({
                            where: { id: p.order_id },
                            data: {
                                checks: [...checks, p.check],
                                unpaid_checks_count: (order.unpaid_checks_count ?? 0) + 1,
                                updated_at: new Date(occurred_at),
                            },
                        });
                    }
                }
                break;
            }

            case "CHECK_PAYMENT_ADDED": {
                const p = payload as any;
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
                    const checks = (payOrder.checks as any[]) || [];
                    const updated = checks.map((c: any) => {
                        if (c.check_id !== p.check_id) return c;
                        const existing = c.payment?.payments || [];
                        return {
                            ...c,
                            payment: {
                                status: 'PARTIAL',
                                payments: [...existing, { amount_cents: amountCents, method }],
                            },
                        };
                    });
                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: { checks: updated, updated_at: new Date(occurred_at) },
                    });
                }
                break;
            }

            case "CHECK_MARKED_PAID": {
                const p = payload as any;
                // Update check payment status to PAID in order.checks[]
                const paidOrder = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (paidOrder) {
                    const paidChecks = (paidOrder.checks as any[]) || [];
                    const updatedChecks = paidChecks.map((c: any) => {
                        if (c.check_id !== p.check_id) return c;
                        // Persist change_cents (vuelto) in the check JSON.
                        // No dedicated column exists for it (orders.checks is Json);
                        // the full payload is also retained in the events table.
                        return {
                            ...c,
                            status: 'PAID',
                            change_cents: p.change_cents ?? 0,
                            payment: { ...c.payment, status: 'PAID' },
                        };
                    });
                    
                    const newUnpaidCount = Math.max(0, (paidOrder.unpaid_checks_count ?? 1) - 1);

                    await tx.orders.update({
                        where: { id: p.order_id },
                        data: {
                            checks: updatedChecks,
                            unpaid_checks_count: newUnpaidCount,
                            updated_at: new Date(occurred_at),
                        },
                    });

                    // CQRS Projection: Free the table if all checks are paid
                    if (newUnpaidCount === 0 && paidOrder.table_id) {
                        await tx.$executeRaw`
                            UPDATE tables 
                            SET status = 'AVAILABLE', 
                                current_order_id = NULL,
                                occupied_since = NULL
                            WHERE id = ${paidOrder.table_id}::uuid
                        `;
                    } else if (newUnpaidCount === 0) {
                        // Fallback using fulfillment if table_id is null
                        const fulfillment = (paidOrder as any).fulfillment as any;
                        if (fulfillment?.table_number) {
                            await tx.$executeRaw`
                                UPDATE tables 
                                SET status = 'AVAILABLE', 
                                    current_order_id = NULL,
                                    occupied_since = NULL
                                WHERE tenant_id = ${tenant_id}::uuid 
                                  AND number = ${fulfillment.table_number}
                            `;
                        }
                    }
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
                const p = payload as any;
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
                const p = payload as any;
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
                const p = payload as any;
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
                const p = payload as any;
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

            case "SHIFT_OPENED": {
                const p = payload as any;

                // Validate opening cash does not exceed tenant max
                const tenantSettings = await (tx as any).tenant_settings.findFirst({
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
                const p = payload as any;
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
                const p = payload as any;
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
                const p = payload as any;
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
                        items: p.items ?? null,
                        issued_at: new Date(occurred_at),
                        authorized_at: new Date(occurred_at),
                    },
                    update: {},
                });
                break;
            }

            case "CHECK_TIP_SET": {
                const p = payload as any;
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
                        location_id: (tipOrder as any)?.location_id ?? tenant_id,
                        order_id: p.order_id,
                        shift_id: activeShift.id,
                        amount: p.tip_cents,
                        payment_method: 'CASH',
                        waiter_id: (tipOrder as any)?.waiter_id ?? actor_id!,
                    },
                    update: { amount: p.tip_cents },
                });
                break;
            }

            case "CHECK_DISCOUNT_SET": {
                const p = payload as any;
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
                const p = payload as any;
                const order = await tx.orders.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const items = (order.items as any[]) || [];
                    const itemIndex = items.findIndex((i: any) => i.line_id === p.line_id);
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
                                items: updatedItems,
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
                const p = payload as any;
                // When item is marked DONE, deduct inventory based on recipe
                if (p.to === "DONE") {
                    const order = await tx.orders.findUnique({ where: { id: event.aggregate_id } });
                    if (order) {
                        const items = order.items as any[] || [];
                        const item = items.find((i: any) => i.line_id === p.line_id);
                        if (item) {
                            // Get location from order or use default
                            const locationId = (order as any).location_id || tenant_id;

                            // H5: Await deduction — log failures for reconciliation
                            const deductionResult = await deductInventoryForOrder(
                                prisma,
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
                                error: err instanceof Error ? err.message : String(err),
                            }));

                            if (!deductionResult.success) {
                                // Log structured failure for reconciliation
                                logger.warn('Deducción de inventario falló', {
                                    orderId: event.aggregate_id,
                                    lineId: p.line_id,
                                    deductionError: deductionResult.error,
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
                const p = payload as any;
                const now = new Date(occurred_at);
                // items_by_station: { [station]: [{line_id, ...}] }
                const itemsByStation = p.items_by_station as Record<string, Array<{ line_id: string }>>;
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
                const p = payload as any;
                await tx.$executeRaw`
                    DELETE FROM order_item_projections
                    WHERE order_id = ${p.order_id}::uuid
                      AND line_id  = ${p.line_id}
                `;
                break;
            }

            case "ORDER_ITEM_NOTE": {
                const p = payload as any;
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
                const p = payload as any;
                await tx.$executeRaw`
                    UPDATE order_item_projections
                    SET table_number = ${p.to_table}, updated_at = ${new Date(occurred_at)}
                    WHERE order_id = ${p.order_id}::uuid
                `;
                break;
            }

            case "ORDER_CANCELLED": {
                // Remove all projection rows — order is gone
                const p = payload as any;
                await tx.$executeRaw`
                    DELETE FROM order_item_projections
                    WHERE order_id = ${p.order_id}::uuid
                `;
                
                // CQRS Projection: Free the table
                await tx.$executeRaw`
                    UPDATE tables 
                    SET status = 'AVAILABLE', 
                        current_order_id = NULL,
                        occupied_since = NULL
                    WHERE current_order_id = ${p.order_id}::uuid
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

export async function OPTIONS(req: Request) {
    const origin = req.headers.get('origin');
    return handleCorsPreflightRequest(origin);
}

export async function POST(req: Request) {
    // Security: Validate API Secret
    const secret = req.headers.get("x-api-secret");
    if (secret !== process.env.PARK_API_SECRET) {
        return addCorsHeaders(serverError(
            err("UNAUTHORIZED", "Acceso denegado.", "Verifica tus credenciales."),
            401
        ), req.headers.get('origin') || undefined);
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return addCorsHeaders(serverError(err("INVALID_JSON", "No se pudo parsear el JSON.", "Verifica el formato del body."), 400), req.headers.get('origin') || undefined);
    }

    const result = ingestRequestSchema.safeParse(body);
    if (!result.success) {
        return addCorsHeaders(serverError(
            err("SCHEMA_VALIDATION_FAILED", "El body no cumple con el schema.", "Corrige los campos.", {
                context: { issues: result.error.errors },
            }),
            400
        ), req.headers.get('origin') || undefined);
    }

    const { tenant_id, terminal_id, events, to_terminal_sequence } = result.data;

    // RATE LIMITING: Verificar límites por tenant_id
    const rateLimitResult = await rateLimiter.checkLimit(tenant_id);
    
    if (!rateLimitResult.allowed) {
        const errorCode = rateLimitResult.limitType === 'burst' 
            ? 'BURST_LIMIT_EXCEEDED' 
            : 'RATE_LIMIT_EXCEEDED';
        
        return NextResponse.json(
            {
                accepted: false,
                error: {
                    error_code: errorCode,
                    severity: 'WARN',
                    message: rateLimitResult.limitType === 'burst' 
                        ? 'Límite de burst excedido' 
                        : 'Límite de rate excedido',
                    user_action: `Espera ${rateLimitResult.retryAfter} segundo(s) antes de reintentar`,
                    retryable: true,
                    context: {
                        current_count: rateLimitResult.currentCount,
                        limit: rateLimitResult.limit,
                        retry_after: rateLimitResult.retryAfter || 1,
                        limit_type: rateLimitResult.limitType,
                    },
                },
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimitResult.retryAfter || 1),
                },
            }
        );
    }

    // Register notification handlers for this tenant (idempotent)
    registerNotificationHandlers(tenant_id);

    // Fast path: empty batch
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    const txSpan = startSpan('ingest.transaction', { tenantId: tenant_id, terminalId: terminal_id, batchSize: events.length });

    try {
        const deduped_event_ids: string[] = [];
        const rejected: Array<{ event_id: string; error: string; details?: Record<string, unknown> }> = [];
        const merged: Array<{ event_id: string; merge_type: string }> = [];

        const acceptedEvents: ParkEvent[] = [];

        await prisma.$transaction(async (tx: any) => {
            for (const ev of events as ParkEvent[]) {
                // 1. DEDUPLICATION CHECK FIRST (atomic with constraint)
                // Marcar como procesado ANTES de cualquier otra operación
                const dedupResult = await markAsProcessed(tx, ev);
                
                if (dedupResult.isDuplicate) {
                    // Evento ya procesado - retornar éxito (idempotente)
                    deduped_event_ids.push(ev.event_id);
                    continue;
                }

                // 2. VALIDATE business rules
                const validation: ValidationResult = await validateEvent(tx, ev);
                
                if (!validation.valid) {
                    rejected.push({
                        event_id: ev.event_id,
                        error: validation.error || "VALIDATION_FAILED",
                        details: validation.details,
                    });
                    continue; // Skip this event
                }

                // 3. CHECK DEPENDENCIES (Out-of-Order Queue)
                const depCheck = await checkDependencies(tx, ev);
                
                if (depCheck.hasDependency) {
                    // Encolar evento hasta que llegue la dependencia
                    await outOfOrderQueue.enqueue(ev, depCheck.reason!);
                    
                    // NO agregar a rejected - el evento está encolado
                    // NO continuar - el evento se procesará cuando llegue la dependencia
                    continue;
                }

                // 4. CONFLICT DETECTION for ORDER events
                if (ev.aggregate_type === "ORDER") {
                    const order = await tx.orders.findUnique({
                        where: { id: ev.aggregate_id },
                        select: { revision: true }
                    });

                    if (order) {
                        const conflictResult = await detectAndResolveConflict(
                            tx,
                            ev,
                            order.revision
                        );

                        if (conflictResult.hasConflict) {
                            if (!conflictResult.shouldApply) {
                                // REJECTED - add to rejected[]
                                rejected.push({
                                    event_id: ev.event_id,
                                    error: conflictResult.conflict!.type,
                                    details: {
                                        expected_revision: conflictResult.conflict!.expected_revision,
                                        actual_revision: conflictResult.conflict!.actual_revision,
                                        resolution: conflictResult.conflict!.resolution,
                                        reason: conflictResult.conflict!.rejected_reason,
                                    }
                                });
                                continue; // Skip this event
                            }

                            // MERGED - add to merged[]
                            merged.push({
                                event_id: ev.event_id,
                                merge_type: conflictResult.conflict!.resolution,
                            });
                        }
                    }
                }

                // 4. Migrate event to current schema version (write-time migration)
                const migrated = eventMigrator.migrate(ev);

                // 5. Insert into events table (with migrated payload)
                await tx.events.create({
                    data: {
                        id: migrated.event_id,
                        tenant_id: migrated.tenant_id,
                        occurred_at: new Date(migrated.occurred_at),
                        type: migrated.event_type,
                        entity_type: migrated.aggregate_type,
                        entity_id: migrated.aggregate_id,
                        actor_id: migrated.actor_id ?? null,
                        actor_role_snapshot: migrated.actor_role_snapshot ?? null,
                        terminal_id: migrated.terminal_id,
                        payload_version: migrated.payload_version,
                        payload: migrated.payload as any,
                    },
                });

                // 6. Project the event (apply to projections)
                const projected = await projectEvent(tx, migrated);
                if (!projected) {
                    logger.warn('Projection failed, event will be rejected', {
                        eventId: ev.event_id,
                        eventType: ev.event_type,
                    });
                    rejected.push({ event_id: ev.event_id, error: 'PROJECTION_FAILED' });
                    continue;
                }

                // 6b. INCREMENT REVISION for ORDER events after projection
                if (ev.aggregate_type === "ORDER") {
                    await tx.orders.update({
                        where: { id: ev.aggregate_id },
                        data: { revision: { increment: 1 } }
                    }).catch(() => {
                        // Order might not exist yet (ORDER_CREATED), ignore
                    });
                }

                // 7. PROCESS QUEUED EVENTS if this event creates an aggregate
                // Si este evento es ORDER_CREATED, procesar eventos encolados para esta orden
                if (ev.event_type === 'ORDER_CREATED') {
                    const queuedEvents = await outOfOrderQueue.processQueuedEvents(ev.aggregate_id);
                    
                    if (queuedEvents.length > 0) {
                        logger.info('Procesando eventos encolados fuera de orden', {
                            aggregateId: ev.aggregate_id,
                            queuedCount: queuedEvents.length,
                        });
                        
                        // Procesar eventos encolados en orden
                        for (const queuedEvent of queuedEvents) {
                            // Marcar como procesado
                            const qDedupResult = await markAsProcessed(tx, queuedEvent);
                            if (qDedupResult.isDuplicate) {
                                deduped_event_ids.push(queuedEvent.event_id);
                                continue;
                            }
                            
                            // Validar
                            const qValidation = await validateEvent(tx, queuedEvent);
                            if (!qValidation.valid) {
                                rejected.push({
                                    event_id: queuedEvent.event_id,
                                    error: qValidation.error || "VALIDATION_FAILED",
                                    details: qValidation.details,
                                });
                                continue;
                            }
                            
                            // Migrate queued event to current schema version
                            const migratedQueued = eventMigrator.migrate(queuedEvent);

                            // Insertar en events table (with migrated payload)
                            await tx.events.create({
                                data: {
                                    id: migratedQueued.event_id,
                                    tenant_id: migratedQueued.tenant_id,
                                    occurred_at: new Date(migratedQueued.occurred_at),
                                    type: migratedQueued.event_type,
                                    entity_type: migratedQueued.aggregate_type,
                                    entity_id: migratedQueued.aggregate_id,
                                    actor_id: migratedQueued.actor_id ?? null,
                                    actor_role_snapshot: migratedQueued.actor_role_snapshot ?? null,
                                    terminal_id: migratedQueued.terminal_id,
                                    payload_version: migratedQueued.payload_version,
                                    payload: migratedQueued.payload as any,
                                },
                            });

                            // Proyectar con evento migrado
                            const qProjected = await projectEvent(tx, migratedQueued);
                            if (!qProjected) {
                                logger.warn('Queued event projection failed', {
                                    eventId: queuedEvent.event_id,
                                    eventType: queuedEvent.event_type,
                                });
                            }
                            
                            // Incrementar revision
                            if (queuedEvent.aggregate_type === "ORDER") {
                                await tx.orders.update({
                                    where: { id: queuedEvent.aggregate_id },
                                    data: { revision: { increment: 1 } }
                                }).catch((err: any) => {
                                    // P2025 = record not found (ORDER_CREATED case)
                                    if (err?.code !== 'P2025') throw err;
                                });
                            }
                            
                            // Agregar a outbox (con evento migrado)
                            await tx.event_outbox.create({
                                data: {
                                    id: uuidv4(),
                                    tenant_id: migratedQueued.tenant_id,
                                    event_id: migratedQueued.event_id,
                                    payload: migratedQueued as any,
                                },
                            });

                            acceptedEvents.push(migratedQueued);
                        }
                    }
                }

                // 8. Add to outbox (ATOMIC with event insert)
                await tx.event_outbox.create({
                    data: {
                        id: uuidv4(),
                        tenant_id: migrated.tenant_id,
                        event_id: migrated.event_id,
                        payload: migrated as any,
                    },
                });

                acceptedEvents.push(migrated);
            }
        }, {
            timeout: 30000, // 30 seconds
            maxWait: 10000, // 10 seconds max wait for transaction slot
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        });

        txSpan.setAttribute('ingest.accepted', acceptedEvents.length);
        txSpan.setAttribute('ingest.deduped', deduped_event_ids.length);
        txSpan.setAttribute('ingest.rejected', rejected.length);
        endSpan(txSpan);

        // Post-transaction: Cash variance alert on SHIFT_CLOSED
        for (const ev of acceptedEvents) {
            if (ev.event_type === 'SHIFT_CLOSED') {
                try {
                    const { CashAlertService } = await import('@/src/core/services/cash-alert.service');
                    const cashAlertService = new CashAlertService(prisma);
                    const p = ev.payload as any;
                    // Read the updated shift to get computed values
                    const closedShift = await prisma.shifts.findFirst({
                        where: { id: p.shift_id, tenant_id },
                        select: { cash_expected_cents: true, cash_counted_cents: true },
                    });
                    if (closedShift?.cash_expected_cents != null && closedShift?.cash_counted_cents != null) {
                        await cashAlertService.checkVariance(
                            tenant_id,
                            p.shift_id,
                            closedShift.cash_expected_cents,
                            closedShift.cash_counted_cents,
                            ev.actor_id || 'system',
                        );
                    }
                } catch (alertErr) {
                    logger.warn('No se pudo verificar varianza de caja', {
                        eventId: ev.event_id,
                        error: alertErr instanceof Error ? alertErr.message : String(alertErr),
                    });
                }
            }
        }

        // Publish events from outbox AFTER transaction commits
        // This ensures consistency - if publish fails, outbox worker will retry
        for (const ev of acceptedEvents) {
            try {
                const { eventBus } = await import("@/src/core/infra/event-bus");
                
                // Manejar publish asíncrono (Supabase) o síncrono (InMemory)
                const publishResult = eventBus.publish(tenant_id, ev);
                if (publishResult instanceof Promise) {
                    await publishResult;
                }
                
                // Mark as published (fire and forget - worker will catch failures)
                prisma.event_outbox.updateMany({
                    where: { event_id: ev.event_id },
                    data: { published: true, published_at: new Date() },
                }).catch((err: unknown) => {
                    logger.error('Error al marcar evento como publicado', err instanceof Error ? err : new Error(String(err)), {
                        eventId: ev.event_id,
                    });
                });
            } catch (e) {
                logger.warn('Fallo al publicar en bus, outbox worker reintentará', {
                    eventId: ev.event_id,
                    publishError: e instanceof Error ? e.message : String(e),
                });
                // NO fallar la transacción - el evento está guardado en outbox
            }
        }

        // Logging estructurado de resumen de procesamiento
        logger.info('Lote de eventos procesado', {
            tenantId: tenant_id,
            terminalId: terminal_id,
            totalEvents: events.length,
            accepted: acceptedEvents.length,
            deduped: deduped_event_ids.length,
            rejected: rejected.length,
            merged: merged.length,
            ackedThrough: to_terminal_sequence,
        });

        return addCorsHeaders(NextResponse.json(
            {
                accepted: true,
                tenant_id,
                terminal_id,
                acked_through_terminal_sequence: to_terminal_sequence,
                deduped_event_ids,
                rejected,
                merged,
            },
            { status: 200 }
        ), req.headers.get('origin') || undefined);
    } catch (e: unknown) {
        endSpan(txSpan, e);
        const msg = e instanceof Error ? e.message : String(e);
        logger.error('Error crítico de base de datos al guardar eventos', e instanceof Error ? e : new Error(msg), {
            tenantId: tenant_id,
            terminalId: terminal_id,
        });

        return addCorsHeaders(serverError(
            err(
                "DB_ERROR",
                "Error CRITICO al guardar eventos.",
                "Revisar logs del servidor.",
                {
                    retryable: true,
                    context: { db_message: msg },
                }
            )
        ), req.headers.get('origin') || undefined);
    }
}
