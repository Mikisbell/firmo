import { NextResponse } from "next/server";
import { Pool } from "pg";
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
