import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/src/core/db/prisma";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";
import { validateEvent, type ValidationResult } from "@/src/core/validation";
import { markAsProcessed } from "@/src/core/events/mark-processed";
import { projectEvent, type DeductionSideEffect } from "@/src/core/events/project-event";
import { runWithSerializationRetry } from "@/src/core/db/serialization-retry";
import { detectAndResolveConflict } from "@/src/core/conflict/conflict-resolver";
import { dispatchNotifications } from "@/src/core/notifications/event-listener";
import { v4 as uuidv4 } from 'uuid';
import { outOfOrderQueue, startCleanupJob } from "@/src/core/events/out-of-order-queue";
import { rateLimiter } from "@/src/core/rate-limiting/rate-limiter";
import { logger } from '@/src/core/observability/structured-logger';
import { startSpan, endSpan } from '@/src/core/observability/tracing';
import { eventMigrator } from "@/src/core/domain/event-migrator";
import { handleCorsPreflightRequest, addCorsHeaders } from "@/src/lib/cors-helpers";
import { requirePosAuth } from "@/src/core/middleware/pos-auth";
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

// markAsProcessed se extrajo a `@/src/core/events/mark-processed` para poder
// testear contra la DB real la invariante de idempotencia (que un duplicado NO
// aborte la transacción). Ver el import al inicio del archivo.
//
// projectEvent y DeductionSideEffect se extrajeron a
// `@/src/core/events/project-event` (mismo patrón que markAsProcessed) para
// poder REUTILIZAR la proyección desde otros puntos de entrada event-sourced
// (p.ej. el portal QR del cliente). El comportamiento del ingest es IDÉNTICO:
// solo cambió la ubicación de la función. Ver el import al inicio del archivo.


export async function OPTIONS(req: Request) {
    const origin = req.headers.get('origin');
    return handleCorsPreflightRequest(origin);
}

export async function POST(req: NextRequest) {
    // SECURITY: Identidad verificada vía requirePosAuth (el mismo middleware que
    // usa el resto de la app). Honra el DEV BACKDOOR de validateAdminAuth en
    // desarrollo y lee el token de cookie `auth_token` o header Bearer.
    // El tenant_id y actor_id se derivan SIEMPRE de la sesión autenticada,
    // NUNCA del body del cliente. Esto previene inyección/falsificación cross-tenant.
    const authResult = await requirePosAuth(req);
    if (!authResult.authorized) {
        // El ingest agrega CORS a todas sus respuestas; preservarlo también en el error.
        return addCorsHeaders(authResult.response, req.headers.get('origin') || undefined);
    }

    // Identidad segura derivada de la sesión autenticada.
    const secureTenantId = authResult.user.tenantId;
    const secureActorId = authResult.user.id;
    const secureActorRole = authResult.user.role ?? null;

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

    const { terminal_id, events, to_terminal_sequence } = result.data;

    // SECURITY: el tenant efectivo es SIEMPRE el del JWT, no el del body.
    const tenant_id = secureTenantId;

    // RATE LIMITING: Verificar límites por tenant_id (del JWT)
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

    // Fast path: empty batch
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    // SECURITY: forzamos tenant_id y actor_id (del JWT) sobre CADA evento,
    // descartando cualquier valor provisto por el cliente en el body.
    const secureEvents: ParkEvent[] = (events as ParkEvent[]).map((ev) => ({
        ...ev,
        tenant_id: secureTenantId,
        actor_id: secureActorId,
        actor_role_snapshot: ev.actor_role_snapshot ?? secureActorRole ?? null,
    }));

    const txSpan = startSpan('ingest.transaction', { tenantId: tenant_id, terminalId: terminal_id, batchSize: secureEvents.length });

    try {
        const deduped_event_ids: string[] = [];
        const rejected: Array<{ event_id: string; error: string; details?: Record<string, unknown> }> = [];
        const merged: Array<{ event_id: string; merge_type: string }> = [];

        const acceptedEvents: ParkEvent[] = [];

        // Acumulador de efectos secundarios de la deducción de inventario.
        // Se llena durante la proyección y se procesa DESPUÉS del commit.
        const deductionSideEffects: DeductionSideEffect[] = [];

        // Reintenta ante 40001/40P01. Los acumuladores se RESETEAN al inicio de
        // cada intento porque se llenan dentro de la transacción: sin el reset,
        // un reintento duplicaría las entradas de un intento abortado.
        await runWithSerializationRetry(async () => {
          deduped_event_ids.length = 0;
          rejected.length = 0;
          merged.length = 0;
          acceptedEvents.length = 0;
          deductionSideEffects.length = 0;

          await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            for (const ev of secureEvents) {
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
                // NOTA: global_sequence NO se incluye — la DB lo asigna (BigSerial autoincrement).
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
                        // payload column is Json; serializable ParkEvent payload.
                        payload: migrated.payload as Prisma.InputJsonValue,
                    },
                });

                // 6. Project the event (apply to projections)
                const projected = await projectEvent(tx, migrated, deductionSideEffects);
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
                                    // payload column is Json; serializable ParkEvent payload.
                                    payload: migratedQueued.payload as Prisma.InputJsonValue,
                                },
                            });

                            // Proyectar con evento migrado
                            const qProjected = await projectEvent(tx, migratedQueued, deductionSideEffects);
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
                                }).catch((err: unknown) => {
                                    // P2025 = record not found (ORDER_CREATED case)
                                    if (
                                        !(err && typeof err === 'object' && 'code' in err && err.code === 'P2025')
                                    ) {
                                        throw err;
                                    }
                                });
                            }

                            // Agregar a outbox (con evento migrado)
                            await tx.event_outbox.create({
                                data: {
                                    id: uuidv4(),
                                    tenant_id: migratedQueued.tenant_id,
                                    event_id: migratedQueued.event_id,
                                    // outbox payload column is Json; full serializable event.
                                    payload: migratedQueued as unknown as Prisma.InputJsonValue,
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
                        // outbox payload column is Json; full serializable event.
                        payload: migrated as unknown as Prisma.InputJsonValue,
                    },
                });

                acceptedEvents.push(migrated);
            }
          }, {
            timeout: 30000, // 30 seconds
            maxWait: 10000, // 10 seconds max wait for transaction slot
            isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          });
        });

        txSpan.setAttribute('ingest.accepted', acceptedEvents.length);
        txSpan.setAttribute('ingest.deduped', deduped_event_ids.length);
        txSpan.setAttribute('ingest.rejected', rejected.length);
        endSpan(txSpan);

        // Post-transaction: efectos secundarios de la deducción de inventario.
        // Se ejecutan DESPUÉS del commit para no abrir conexiones extra dentro
        // de la transacción (push notifications best-effort + Auto-86).
        if (deductionSideEffects.length > 0) {
            const { notifyLowStock } = await import('@/src/core/inventory/stock-alert-notifier');
            for (const effect of deductionSideEffects) {
                // Push notifications de stock bajo/agotado (best-effort, no bloqueante).
                for (const alert of effect.alerts) {
                    notifyLowStock({
                        tenantId: effect.tenantId,
                        inventoryCode: alert.inventory_code,
                        inventoryName: alert.inventory_name,
                        currentStock: alert.current_stock,
                        minStock: alert.min_stock ?? 0,
                        unit: alert.unit,
                        alertType: alert.type === 'NEGATIVE_STOCK' ? 'OUT_OF_STOCK' : 'LOW_STOCK',
                    }).catch(() => {
                        // Best-effort: nunca falla por una notificación
                    });
                }

                // H4: Auto-86 — reevalúa disponibilidad del producto si algún
                // insumo llegó a 0. Usa el prisma global (post-commit), no la tx.
                if (effect.productIdToReevaluate) {
                    try {
                        const { ProductAvailabilityService } = await import('@/src/core/services/product-availability.service');
                        const { eventBus } = await import('@/src/core/infra/event-bus');
                        const availService = new ProductAvailabilityService(prisma, eventBus);
                        await availService.autoCheckAvailability(effect.tenantId, effect.productIdToReevaluate);
                    } catch (e) {
                        logger.warn('Auto-86 check falló post-deducción', {
                            productId: effect.productIdToReevaluate,
                            error: e instanceof Error ? e.message : String(e),
                        });
                    }
                }
            }
        }

        // Post-transaction: Cash variance alert on SHIFT_CLOSED
        for (const ev of acceptedEvents) {
            if (ev.event_type === 'SHIFT_CLOSED') {
                try {
                    const { CashAlertService } = await import('@/src/core/services/cash-alert.service');
                    const cashAlertService = new CashAlertService(prisma);
                    const p = ev.payload;
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

                // Notificaciones push + invalidación de cache, INLINE (serverless-safe).
                // Reemplaza al listener que se suscribía a PG LISTEN/NOTIFY (no sobrevive
                // en Cloudflare). dispatchNotifications es best-effort: no lanza al caller.
                await dispatchNotifications(ev);
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
            totalEvents: secureEvents.length,
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
