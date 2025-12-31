import { NextResponse } from "next/server";
import { Pool } from "pg";
import { ingestRequestSchema, type IngestRequest, type ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 1. Configurar Pool con SSL permisivo para Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Usar Pooler URL
    ssl: { rejectUnauthorized: false },       // Importante para Supabase/AWS
    max: 20,                                  // Pool size conservador
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

    const { store_id, terminal_id, events, from_terminal_sequence, to_terminal_sequence } = result.data;

    // Fast path: batch vacío
    if (events.length === 0) {
        return NextResponse.json({ accepted: true, acked_through_terminal_sequence: to_terminal_sequence });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Construir Multi-Row Insert (Eficiente)
        const values: any[] = [];
        const placeholders: string[] = [];
        let p = 1;

        for (const e of events) {
            const ev = e as ParkEvent;
            placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);

            values.push(
                ev.store_id,
                ev.terminal_id,
                ev.terminal_sequence,
                ev.event_id,
                ev.event_type,
                ev.schema_version,
                ev.occurred_at, // pg driver maneja ISO Strings a Timestamp
                ev.aggregate_type,
                ev.aggregate_id,
                ev.correlation_id,
                ev.causation_id,
                JSON.stringify(ev.payload)
            );
        }

        const insertSql = `
            INSERT INTO events (
                store_id, terminal_id, terminal_sequence, event_id, event_type, schema_version, occurred_at,
                aggregate_type, aggregate_id, correlation_id, causation_id, payload
            )
            VALUES ${placeholders.join(", ")}
            ON CONFLICT (store_id, event_id) DO NOTHING
            RETURNING event_id;
        `;

        const res = await client.query(insertSql, values);
        await client.query("COMMIT");

        // Deducir duplicados (los que NO devolvió el RETURNING)
        const insertedIds = new Set(res.rows.map((r: any) => r.event_id));
        const deduped_event_ids = events
            .filter(e => !insertedIds.has(e.event_id))
            .map(e => e.event_id);

        return NextResponse.json(
            {
                accepted: true,
                store_id,
                terminal_id,
                acked_through_terminal_sequence: to_terminal_sequence,
                deduped_event_ids,
                rejected: [],
            },
            { status: 200 }
        );

    } catch (e: unknown) {
        await client.query("ROLLBACK").catch(() => { });

        // LOGGING ROBUSTO (Paso B del usuario)
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
