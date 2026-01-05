import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prisma Client singleton
const prisma = new PrismaClient();

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

// Projections using Prisma
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent) {
    const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;

    try {
        switch (event_type) {
            case "ORDER_CREATED": {
                const p = payload as any;
                await tx.order.upsert({
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
                const order = await tx.order.findUnique({ where: { id: p.order_id } });
                if (order) {
                    const items = order.items as any[] || [];
                    const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
                    await tx.order.update({
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
                await tx.order.update({
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
                await tx.invoice.upsert({
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
                await tx.shift.upsert({
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
                await tx.shift.update({
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
        }
    } catch (e) {
        console.error(`[Projections] Error projecting ${event_type} ${event.event_id}:`, e);
    }
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

    // Fast path: empty batch
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    try {
        const deduped_event_ids: string[] = [];

        await prisma.$transaction(async (tx) => {
            for (const ev of events as ParkEvent[]) {
                // Try to create event, skip if duplicate
                try {
                    await tx.event.create({
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
                } catch (e: any) {
                    // Unique constraint = duplicate, skip
                    if (e.code === "P2002") {
                        deduped_event_ids.push(ev.event_id);
                        continue;
                    }
                    throw e;
                }

                // Project the event
                await projectEvent(tx, ev);
            }
        }, {
            timeout: 30000, // 30 seconds
            maxWait: 10000, // 10 seconds max wait for transaction slot
        });

        return NextResponse.json(
            {
                accepted: true,
                tenant_id,
                terminal_id,
                acked_through_terminal_sequence: to_terminal_sequence,
                deduped_event_ids,
                rejected: [],
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
