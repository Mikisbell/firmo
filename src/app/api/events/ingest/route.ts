import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/src/core/db/prisma";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";
import { validateEvent, type ValidationResult } from "@/src/core/validation";
import { deductInventoryForOrder } from "@/src/core/inventory/deduction.service";
import { detectAndResolveConflict } from "@/src/core/conflict/conflict-resolver";
import { registerNotificationHandlers } from "@/src/core/notifications/event-listener";
import { v4 as uuidv4 } from 'uuid';
import { outOfOrderQueue, startCleanupJob } from "@/src/core/events/out-of-order-queue";
import { rateLimiter } from "@/src/core/rate-limiting/rate-limiter";

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
    const { event_type, aggregate_id, aggregate_type } = event;
    
    // ORDER_ITEM_ADDED requiere que ORDER_CREATED exista
    if (event_type === 'ORDER_ITEM_ADDED') {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true }
        });
        
        if (!order) {
            return {
                hasDependency: true,
                reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found'
            };
        }
    }
    
    // CHECK_PAYMENT_ADDED requiere que ORDER_CREATED exista
    if (event_type === 'CHECK_PAYMENT_ADDED') {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true }
        });
        
        if (!order) {
            return {
                hasDependency: true,
                reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found'
            };
        }
    }
    
    // CHECK_MARKED_PAID requiere que ORDER_CREATED exista
    if (event_type === 'CHECK_MARKED_PAID') {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true }
        });
        
        if (!order) {
            return {
                hasDependency: true,
                reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found'
            };
        }
    }
    
    // ORDER_ITEM_STATUS_CHANGED requiere que ORDER_CREATED exista
    if (event_type === 'ORDER_ITEM_STATUS_CHANGED') {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true }
        });
        
        if (!order) {
            return {
                hasDependency: true,
                reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found'
            };
        }
    }
    
    // INVOICE_ISSUED requiere que ORDER_CREATED exista
    if (event_type === 'INVOICE_ISSUED') {
        const order = await tx.orders.findUnique({
            where: { id: aggregate_id },
            select: { id: true }
        });
        
        if (!order) {
            return {
                hasDependency: true,
                reason: 'DEPENDENCY_MISSING: ORDER_CREATED not found'
            };
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
            console.log(JSON.stringify({
                level: 'INFO',
                event: 'deduplication.duplicate_detected',
                message: `Event ${event.event_id} already processed`,
                context: {
                    event_id: event.event_id,
                    tenant_id: event.tenant_id,
                    event_type: event.event_type,
                    aggregate_id: event.aggregate_id,
                    processor: 'ingest-api'
                }
            }));
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
                const paymentId = p.payment?.id || p.paymentId || uuidv4();
                await tx.payments.upsert({
                    where: { id: paymentId },
                    create: {
                        id: paymentId,
                        tenant_id,
                        order_id: p.order_id,
                        check_id: p.check_id,
                        amount_cents: p.payment?.amount_cents ?? p.amountCents ?? 0,
                        payment_method: p.payment?.method ?? p.method ?? 'CASH',
                        reference: p.payment?.ref ?? p.reference ?? null,
                        status: 'COMPLETED',
                        processed_at: new Date(occurred_at),
                        processed_by: actor_id ?? null,
                        shift_id: event.shift_id ?? null,
                        terminal_id: terminal_id ?? '',
                    },
                    update: {},
                });
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
                    outOfOrderQueue.enqueue(ev, depCheck.reason!);
                    
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

                // 4. Insert into events table
                // Ya no necesitamos try-catch para P2002 porque processed_events es el lock
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
                        payload: ev.payload as any,
                    },
                });

                // 5. Project the event (apply to projections)
                await projectEvent(tx, ev);

                // 6. INCREMENT REVISION for ORDER events after projection
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
                        console.log(JSON.stringify({
                            level: 'INFO',
                            event: 'out_of_order.processing_queued',
                            message: `Processing ${queuedEvents.length} queued events for order ${ev.aggregate_id}`,
                            context: {
                                aggregate_id: ev.aggregate_id,
                                queued_count: queuedEvents.length,
                            }
                        }));
                        
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
                            
                            // Insertar en events table
                            await tx.events.create({
                                data: {
                                    id: queuedEvent.event_id,
                                    tenant_id: queuedEvent.tenant_id,
                                    occurred_at: new Date(queuedEvent.occurred_at),
                                    type: queuedEvent.event_type,
                                    entity_type: queuedEvent.aggregate_type,
                                    entity_id: queuedEvent.aggregate_id,
                                    actor_id: queuedEvent.actor_id ?? null,
                                    actor_role_snapshot: queuedEvent.actor_role_snapshot ?? null,
                                    terminal_id: queuedEvent.terminal_id,
                                    payload_version: queuedEvent.schema_version,
                                    payload: queuedEvent.payload as any,
                                },
                            });
                            
                            // Proyectar
                            await projectEvent(tx, queuedEvent);
                            
                            // Incrementar revision
                            if (queuedEvent.aggregate_type === "ORDER") {
                                await tx.orders.update({
                                    where: { id: queuedEvent.aggregate_id },
                                    data: { revision: { increment: 1 } }
                                }).catch(() => {});
                            }
                            
                            // Agregar a outbox
                            await tx.event_outbox.create({
                                data: {
                                    id: uuidv4(),
                                    tenant_id: queuedEvent.tenant_id,
                                    event_id: queuedEvent.event_id,
                                    payload: queuedEvent as any,
                                },
                            });
                            
                            acceptedEvents.push(queuedEvent);
                        }
                    }
                }

                // 8. Add to outbox (ATOMIC with event insert)
                await tx.event_outbox.create({
                    data: {
                        id: uuidv4(),
                        tenant_id: ev.tenant_id,
                        event_id: ev.event_id,
                        payload: ev as any,
                    },
                });

                acceptedEvents.push(ev);
            }
        }, {
            timeout: 30000, // 30 seconds
            maxWait: 10000, // 10 seconds max wait for transaction slot
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, // Suficiente para prevenir phantom reads
        });

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
                }).catch(() => { /* Worker will handle */ });
            } catch (e) {
                console.warn("[Bus] Fallo al publicar, outbox worker reintentará", e);
                // NO fallar la transacción - el evento está guardado en outbox
            }
        }

        // Logging estructurado de resumen de procesamiento
        console.log(JSON.stringify({
            level: 'INFO',
            event: 'ingest.batch_processed',
            message: `Batch processed: ${acceptedEvents.length} accepted, ${deduped_event_ids.length} deduped, ${rejected.length} rejected`,
            context: {
                tenant_id,
                terminal_id,
                total_events: events.length,
                accepted: acceptedEvents.length,
                deduped: deduped_event_ids.length,
                rejected: rejected.length,
                merged: merged.length,
                acked_through: to_terminal_sequence
            }
        }));

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
