import { NextResponse } from "next/server";
import { Pool } from "pg";
import { ingestRequestSchema, type IngestRequest, type ParkEvent } from "@/src/core/domain/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------
// DB (Postgres)
// ---------------------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? process.env.POSTGRES_URL,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// ---------------------------
// Error envelope normalizado
// ---------------------------
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
    opts?: Partial<Omit<ApiError, "error_code" | "message" | "user_action">>
): ApiError {
    return {
        error_code,
        severity: opts?.severity ?? "ERROR",
        retryable: opts?.retryable ?? false,
        context: opts?.context,
        message,
        user_action,
    };
}

function badRequest(e: ApiError) {
    return NextResponse.json(
        { accepted: false, acked_through_terminal_sequence: null, error: e },
        { status: 400 }
    );
}

function serverError(e: ApiError) {
    return NextResponse.json(
        { accepted: false, acked_through_terminal_sequence: null, error: e },
        { status: 500 }
    );
}

// ---------------------------
// Batch invariants
// ---------------------------
function validateBatch(req: IngestRequest): ApiError | null {
    const { store_id, terminal_id, from_terminal_sequence, to_terminal_sequence, events } = req;

    // 1) rango declarado debe coincidir con el batch
    if (events.length === 0) {
        return err("EMPTY_BATCH", "El batch no contiene eventos", "Reintenta", { retryable: false });
    }
    const minSeq = events[0]!.terminal_sequence;
    const maxSeq = events[events.length - 1]!.terminal_sequence;
    if (minSeq !== from_terminal_sequence || maxSeq !== to_terminal_sequence) {
        return err(
            "SEQUENCE_RANGE_MISMATCH",
            "El rango declarado no coincide con los eventos enviados.",
            "Reintenta la sincronización.",
            { retryable: true, context: { from_terminal_sequence, to_terminal_sequence, minSeq, maxSeq } }
        );
    }

    // 2) contigüidad estricta y store/terminal consistentes
    const ids = new Set<string>();
    for (let i = 0; i < events.length; i++) {
        const e = events[i] as ParkEvent;

        if (e.store_id !== store_id || e.terminal_id !== terminal_id) {
            return err(
                "BATCH_IDENTITY_MISMATCH",
                "Los eventos no pertenecen al store/terminal declarado.",
                "Revisa la configuración del dispositivo.",
                { retryable: false, context: { event_store_id: e.store_id, event_terminal_id: e.terminal_id, store_id, terminal_id } }
            );
        }

        if (ids.has(e.event_id)) {
            return err(
                "DUPLICATE_EVENT_ID_IN_BATCH",
                "El batch contiene event_id duplicados.",
                "Reintenta. Si persiste, hay un bug en el cliente.",
                { retryable: false, context: { event_id: e.event_id } }
            );
        }
        ids.add(e.event_id);

        if (i > 0) {
            const prev = events[i - 1]!.terminal_sequence;
            const cur = e.terminal_sequence;

            if (cur <= prev) {
                return err(
                    "SEQUENCE_NOT_STRICTLY_INCREASING",
                    "La secuencia no es estrictamente creciente.",
                    "Reintenta la sincronización.",
                    { retryable: true, context: { prev, cur } }
                );
            }
            if (cur !== prev + 1) {
                return err(
                    "SEQUENCE_NOT_CONTIGUOUS",
                    "La secuencia tiene saltos (no es contigua).",
                    "Reintenta. Si persiste, reconstruye backlog local.",
                    { retryable: true, context: { prev, cur } }
                );
            }
        }
    }

    return null;
}

// ---------------------------
// Route
// ---------------------------
export async function POST(request: Request) {
    // 1) parse + zod
    let parsed: IngestRequest;
    try {
        const json = await request.json();
        const result = ingestRequestSchema.safeParse(json);
        if (!result.success) {
            return badRequest(
                err(
                    "SCHEMA_INVALID",
                    "El formato del request no es válido.",
                    "Actualiza la app o corrige el payload.",
                    { retryable: false, context: { issues: result.error.issues } }
                )
            );
        }
        parsed = result.data;
    } catch {
        return badRequest(err("INVALID_JSON", "No se pudo leer JSON del request.", "Reintenta.", { retryable: true }));
    }

    // 2) invariants extra (contigüidad, identidad)
    const batchErr = validateBatch(parsed);
    if (batchErr) return badRequest(batchErr);

    const { store_id, terminal_id, to_terminal_sequence, events } = parsed;

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 3) insert multi-row idempotente
        const values: unknown[] = [];
        const rowsSql: string[] = [];

        for (let i = 0; i < events.length; i++) {
            const e = events[i]!;
            const base = i * 12;

            rowsSql.push(
                `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}::jsonb)`
            );

            values.push(
                e.store_id,
                e.terminal_id,
                e.terminal_sequence,
                e.event_id,
                e.event_type,
                e.schema_version,
                e.occurred_at,
                e.aggregate_type,
                e.aggregate_id,
                e.correlation_id,
                e.causation_id ?? null,
                JSON.stringify(e.payload)
            );
        }

        const insertSql = `
      INSERT INTO events (
        store_id, terminal_id, terminal_sequence, event_id, event_type, schema_version, occurred_at,
        aggregate_type, aggregate_id, correlation_id, causation_id, payload
      )
      VALUES ${rowsSql.join(",\n")}
      ON CONFLICT (store_id, event_id) DO NOTHING
      RETURNING event_id;
    `;

        const inserted = await client.query<{ event_id: string }>(insertSql, values);
        await client.query("COMMIT");

        const insertedIds = new Set(inserted.rows.map((r: { event_id: string }) => r.event_id));
        const deduped_event_ids = events.map((e) => e.event_id).filter((id: string) => !insertedIds.has(id));

        // 4) ACK correcto (batch contiguo, válido => ACK al final)
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
        try { await client.query("ROLLBACK"); } catch { }
        const db_message = e instanceof Error ? e.message : String(e);

        return serverError(
            err(
                "DB_ERROR",
                "Error al guardar eventos en la base de datos.",
                "Reintenta. Si persiste, contacta soporte.",
                {
                    retryable: true,
                    context: { store_id, terminal_id, to_terminal_sequence, db_message },
                }
            )
        );
    } finally {
        client.release();
    }
}
