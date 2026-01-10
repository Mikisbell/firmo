import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/src/core/db/prisma";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";
import { validateEvent, type ValidationResult } from "@/src/core/validation";
import { checkRateLimit } from "@/src/core/middleware/rate-limit";
import { deductInventoryForOrder } from "@/src/core/inventory/deduction.service";
import { detectAndResolveConflict } from "@/src/core/conflict/conflict-resolver";
import { registerNotificationHandlers } from "@/src/core/notifications/event-listener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Projections using Prisma (with idempotency check)
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent): Promise<boolean> {
    const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;

    // 1. Check if already processed (idempotency)
    const exists = await tx.processed_events.findUnique({
        where: { event_id: event.event_id }
    });

    if (exists) {
        console.log(`[Projection] Event ${event.event_id} already processed, skipping`);
        return false; // Already processed
    }

    // 2. Mark as processed BEFORE projecting (prevents race conditions)
    await tx.processed_events.create({
        data: {
            event_id: event.event_id,
            tenant_id: event.tenant_id,
        }
    });

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
                }
                break;
            }

            case "CHECK_PAYMENT_ADDED": {
                const p = payload as any;
                console.log(`[Projection] CHECK_PAYMENT_ADDED for order ${p.order_id}, check ${p.check_id}`);
                break;
            }

            case "CHECK_MARKED_PAID": {
                const p = payload as any;
                await tx.orders.update({
                    where: { id: p.order_id },
                    data: {
                        unpaid_checks_count: { decrement: 1 },
                        updated_at: new Date(occurred_at),
                    },
                });
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

            case "SHIFT_OPENED": {
                const p = payload as any;
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
                    },
                    update: {},
                });
                break;
            }

            case "SHIFT_CLOSED": {
                const p = payload as any;
                await tx.shifts.update({
                    where: { id: p.shift_id },
                    data: {
                        status: "CLOSED",
                        closed_at: new Date(occurred_at),
                        closed_by: actor_id,
                        cash_expected_cents: p.cash_expected_cents,
                        cash_counted_cents: p.cash_counted_cents,
                        diff_cents: p.diff_cents,
                    },
                });
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
                            
                            // Deduct inventory (fire and forget - don't block order flow)
                            deductInventoryForOrder(
                                prisma,
                                tenant_id,
                                locationId,
                                event.aggregate_id,
                                p.line_id,
                                item.product_id,
                                item.qty || 1
                            ).catch((err) => {
                                console.warn(`[Inventory] Deduction failed for order ${event.aggregate_id}:`, err);
                            });
                        }
                    }
                }
                break;
            }
        }
    } catch (e) {
        console.error(`[Projections] Error projecting ${event_type} ${event.event_id}:`, e);
    }

    return true; // Successfully processed
}

export async function POST(req: Request) {
    // Get IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
        || req.headers.get("x-real-ip") 
        || "unknown";

    // Security: Validate API Secret
    const secret = req.headers.get("x-api-secret");
    if (secret !== process.env.PARK_API_SECRET) {
        return serverError(
            err("UNAUTHORIZED", "Acceso denegado.", "Verifica tus credenciales."),
            401
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return serverError(err("INVALID_JSON", "No se pudo parsear el JSON.", "Verifica el formato del body."), 400);
    }

    const result = ingestRequestSchema.safeParse(body);
    if (!result.success) {
        return serverError(
            err("SCHEMA_VALIDATION_FAILED", "El body no cumple con el schema.", "Corrige los campos.", {
                context: { issues: result.error.errors },
            }),
            400
        );
    }

    const { tenant_id, terminal_id, events, to_terminal_sequence } = result.data;

    // Register notification handlers for this tenant (idempotent)
    registerNotificationHandlers(tenant_id);

    // Rate Limiting Check
    const rateLimit = checkRateLimit(tenant_id, terminal_id, ip);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                accepted: false,
                error: {
                    error_code: "RATE_LIMIT_EXCEEDED",
                    severity: "WARN",
                    message: "Demasiadas solicitudes. Intenta de nuevo.",
                    user_action: `Espera ${rateLimit.retryAfter} segundos antes de reintentar.`,
                    retryable: true,
                    context: { retry_after: rateLimit.retryAfter },
                },
            },
            {
                status: 429,
                headers: {
                    "Retry-After": String(rateLimit.retryAfter),
                },
            }
        );
    }

    // Fast path: empty batch
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    try {
        const deduped_event_ids: string[] = [];
        const rejected: Array<{ event_id: string; error: string; details?: Record<string, unknown> }> = [];
        const merged: Array<{ event_id: string; merge_type: string }> = [];

        const acceptedEvents: ParkEvent[] = [];

        await prisma.$transaction(async (tx) => {
            for (const ev of events as ParkEvent[]) {
                // 1. VALIDATE business rules FIRST
                const validation: ValidationResult = await validateEvent(tx, ev);
                
                if (!validation.valid) {
                    rejected.push({
                        event_id: ev.event_id,
                        error: validation.error || "VALIDATION_FAILED",
                        details: validation.details,
                    });
                    continue; // Skip this event
                }

                // 2. CONFLICT DETECTION for ORDER events
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

                // 3. Try to create event, skip if duplicate
                try {
                    await tx.events.create({
                        data: {
                            id: ev.event_id,
                            tenant_id: ev.tenant_id,
                            occurred_at: new Date(ev.occurred_at),
                            type: ev.event_type,
                            entity_type: ev.aggregate_type,
                            entity_id: ev.aggregate_id,
                            actor_id: ev.actor_id ?? null,
                            actor_role_snapshot: ev.actor_role_snapshot ?? null,
                            terminal_id: ev.terminal_id,
                            payload_version: ev.schema_version,
                            payload: ev.payload as Prisma.InputJsonValue,
                        },
                    });
                } catch (e: unknown) {
                    // Unique constraint = duplicate, skip
                    if (e && typeof e === 'object' && 'code' in e && e.code === "P2002") {
                        deduped_event_ids.push(ev.event_id);
                        continue;
                    }
                    throw e;
                }

                // Project the event
                await projectEvent(tx, ev);

                // INCREMENT REVISION for ORDER events after projection
                if (ev.aggregate_type === "ORDER") {
                    await tx.orders.update({
                        where: { id: ev.aggregate_id },
                        data: { revision: { increment: 1 } }
                    }).catch(() => {
                        // Order might not exist yet (ORDER_CREATED), ignore
                    });
                }

                // Add to outbox (ATOMIC with event insert)
                await tx.event_outbox.create({
                    data: {
                        id: crypto.randomUUID(),
                        tenant_id: ev.tenant_id,
                        event_id: ev.event_id,
                        payload: ev as unknown as Prisma.InputJsonValue,
                    },
                });

                acceptedEvents.push(ev);
            }
        }, {
            timeout: 30000, // 30 seconds
            maxWait: 10000, // 10 seconds max wait for transaction slot
        });

        // Publish events from outbox AFTER transaction commits
        // This ensures consistency - if publish fails, outbox worker will retry
        for (const ev of acceptedEvents) {
            try {
                const { eventBus } = await import("@/src/core/infra/event-bus");
                eventBus.publish(tenant_id, ev);
                
                // Mark as published (fire and forget - worker will catch failures)
                prisma.event_outbox.updateMany({
                    where: { event_id: ev.event_id },
                    data: { published: true, published_at: new Date() },
                }).catch(() => { /* Worker will handle */ });
            } catch (e) {
                console.warn("[Bus] Failed to publish, outbox worker will retry", e);
            }
        }

        return NextResponse.json(
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
        );
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[ingest] DB_ERROR:", msg, e);

        return serverError(
            err(
                "DB_ERROR",
                "Error CRITICO al guardar eventos.",
                "Revisar logs del servidor.",
                {
                    retryable: true,
                    context: { db_message: msg },
                }
            )
        );
    }
}
