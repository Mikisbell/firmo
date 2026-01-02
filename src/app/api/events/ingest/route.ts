import { NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";
import { ingestRequestSchema, type ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1. Configurar Pool con SSL permisivo para Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// 2. Error Helpers
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

// 3. Projections Helper (Synchronous MVP)
async function projectEvent(client: PoolClient, event: ParkEvent) {
    const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;

    try {
        await client.query("SAVEPOINT projection_sp");

        switch (event_type) {
            case "ORDER_CREATED": {
                const p = payload as any;
                // Insert Order (Upsert to be safe)
                await client.query(`
                    INSERT INTO orders (
                        id, tenant_id, order_number, order_type, order_status, 
                        items, checks, terminal_id, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        items = EXCLUDED.items,
                        checks = EXCLUDED.checks,
                        updated_at = EXCLUDED.updated_at
                `, [
                    p.order_id,
                    tenant_id,
                    p.order_number,
                    p.order_type,
                    JSON.stringify(p.items || []),
                    JSON.stringify(p.checks || []),
                    terminal_id,
                    occurred_at
                ]);
                break;
            }

            case "INVOICE_ISSUED": {
                const p = payload as any;
                /* Payload:
                    order_id, check_id, invoice_id, invoice_type, 
                    series, invoice_number, total_cents
                */
                // Insert Invoice
                await client.query(`
                    INSERT INTO invoices (
                        id, tenant_id, order_id, check_id, invoice_type,
                        series, invoice_number, total_cents, 
                        status, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ISSUED', $9)
                    ON CONFLICT (tenant_id, order_id, check_id) DO NOTHING
                `, [
                    p.invoice_id,
                    tenant_id,
                    p.order_id,
                    p.check_id,
                    p.invoice_type,
                    p.series || null,
                    p.invoice_number || null,
                    p.total_cents,
                    occurred_at
                ]);

                // Update Order Status if needed? 
                // For MVP, we don't strictly update order status here, rely on ORDER_CLOSED later or implicit.
                break;
            }

            case "SHIFT_OPENED": {
                const p = payload as any;
                // Insert Shift
                await client.query(`
                    INSERT INTO shifts (
                        id, tenant_id, terminal_id, status, opened_at, opened_by, cash_opening_cents
                    ) VALUES ($1, $2, $3, 'OPEN', $4, $5, $6)
                    ON CONFLICT (id) DO NOTHING
                `, [
                    p.shift_id,
                    tenant_id,
                    terminal_id,
                    occurred_at,
                    actor_id,
                    p.cash_opening_cents
                ]);
                break;
            }

            case "SHIFT_CLOSED": {
                const p = payload as any;
                // Update Shift
                await client.query(`
                    UPDATE shifts 
                    SET status = 'CLOSED', closed_at = $1, closed_by = $2, 
                        cash_expected_cents = $3, cash_counted_cents = $4, diff_cents = $5
                    WHERE id = $6 AND tenant_id = $7
                `, [
                    occurred_at,
                    occurred_at,
                    actor_id,
                    p.cash_expected_cents,
                    p.cash_counted_cents,
                    p.diff_cents,
                    p.shift_id,
                    tenant_id
                ]);
                break;
            }
        }
        await client.query("RELEASE SAVEPOINT projection_sp");
    } catch (e) {
        // Rollback only the projection, keep the event insertion
        await client.query("ROLLBACK TO SAVEPOINT projection_sp");
        console.error(`[Projections] Error projecting ${event_type} ${event.event_id}:`, e);
    }
}


export async function POST(req: Request) {
    // 0. Seguridad: Validar API Secret
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

    const { tenant_id, terminal_id, events, from_terminal_sequence, to_terminal_sequence } = result.data;

    // Fast path: batch vacío
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Construir Multi-Row Insert (Eficiente)
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let p = 1;

        for (const ev of events as ParkEvent[]) {
            placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);

            values.push(
                ev.event_id,          // id (UUID)
                ev.tenant_id,         // tenant_id
                ev.occurred_at,       // occurred_at
                ev.event_type,        // type
                ev.aggregate_type,    // entity_type
                ev.aggregate_id,      // entity_id
                ev.actor_id ?? null,  // actor_id
                ev.actor_role_snapshot ?? null, // actor_role_snapshot
                ev.terminal_id,       // terminal_id
                ev.schema_version,    // payload_version
                JSON.stringify(ev.payload)  // payload
            );
        }

        // Insert to 'events' table (Prisma schema)
        const insertSql = `
            INSERT INTO events (
                id, tenant_id, occurred_at, type, entity_type, entity_id,
                actor_id, actor_role_snapshot, terminal_id, payload_version, payload
            )
            VALUES ${placeholders.join(", ")}
            ON CONFLICT (id) DO NOTHING
            RETURNING id;
        `;

        const res = await client.query(insertSql, values);

        // --- PROJECTIONS (Synchronous MVP) ---
        // Only project the events that were actually inserted (deduped) OR project all?
        // Idempotency: Projecting twice is fine if UPSERT is used.
        // We'll project ALL incoming events to be safe, assuming upsert logic handles strictness.
        // Actually, better to project only new ones? No, if we lost projection but event exists, re-projecting helps.
        // Let's project in order.
        for (const ev of events as ParkEvent[]) {
            await projectEvent(client, ev);
        }

        await client.query("COMMIT");

        // Deducir duplicados (los que NO devolvió el RETURNING)
        const insertedIds = new Set(res.rows.map((r: { id: string }) => r.id));
        const deduped_event_ids = events
            .filter(e => !insertedIds.has(e.event_id))
            .map(e => e.event_id);

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
        await client.query("ROLLBACK").catch(() => { });

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
    } finally {
        client.release();
    }
}
