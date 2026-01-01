// src/core/sync/client.ts
import { db } from "@/src/core/db/schema";
import Dexie from 'dexie';
import { ingestRequestSchema, type IngestRequest, type ParkEvent } from "@/src/core/domain/events";

export type IngestResponse = {
    accepted: boolean;
    tenant_id?: string;
    terminal_id?: string;
    acked_through_terminal_sequence: number | null;
    deduped_event_ids?: string[];
    rejected?: { event_id: string; code: string; message: string }[];
    error?: {
        error_code: string;
        severity: "INFO" | "WARN" | "ERROR" | "FATAL";
        message: string;
        user_action: string;
        retryable: boolean;
        context?: Record<string, unknown>;
    };
};

type SyncClientOptions = {
    endpoint?: string;
    batchSize?: number;
    tickMs?: number;
    maxBackoffMs?: number;
    minBackoffMs?: number;
    jitterRatio?: number;
    validateWithZodBeforeSend?: boolean; // recomendado true en dev
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function jitter(ms: number, ratio: number) {
    const delta = ms * ratio;
    const min = ms - delta;
    const max = ms + delta;
    return Math.max(0, Math.floor(min + Math.random() * (max - min)));
}

function nextBackoff(attempt: number, minMs: number, maxMs: number) {
    const raw = minMs * Math.pow(2, Math.min(attempt, 10));
    return Math.min(raw, maxMs);
}

export class SyncClient {
    private endpoint: string;
    private batchSize: number;
    private tickMs: number;
    private maxBackoffMs: number;
    private minBackoffMs: number;
    private jitterRatio: number;
    private validateWithZodBeforeSend: boolean;

    private running = false;
    private syncing = false;
    private attempt = 0;
    private timer: number | null = null;
    private onOnlineBound: () => void;

    constructor(opts: SyncClientOptions = {}) {
        this.endpoint = opts.endpoint ?? "/api/events/ingest";
        this.batchSize = opts.batchSize ?? 200;
        this.tickMs = opts.tickMs ?? 5000;
        this.maxBackoffMs = opts.maxBackoffMs ?? 60000;
        this.minBackoffMs = opts.minBackoffMs ?? 1000;
        this.jitterRatio = opts.jitterRatio ?? 0.2;
        this.validateWithZodBeforeSend = opts.validateWithZodBeforeSend ?? false;
        this.onOnlineBound = this.onOnline.bind(this);
    }

    start() {
        if (this.running) return;
        this.running = true;

        if (typeof window !== "undefined") {
            window.addEventListener("online", this.onOnlineBound);
            this.timer = window.setInterval(() => void this.syncNow(), this.tickMs);
        }
        void this.syncNow();
    }

    stop() {
        this.running = false;
        if (typeof window !== "undefined") {
            window.removeEventListener("online", this.onOnlineBound);
            if (this.timer) window.clearInterval(this.timer);
        }
        this.timer = null;
    }

    private onOnline() {
        void this.syncNow();
    }

    async syncNow(): Promise<IngestResponse | null> {
        if (!this.running) return null;
        if (this.syncing) return null;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
            await this.updateSyncAttempt("OFFLINE");
            return null;
        }

        this.syncing = true;
        try {
            const resp = await this.syncOnce();
            if (resp?.accepted) this.attempt = 0;
            else if (resp?.error?.retryable) await this.backoffDelay();
            else if (resp && !resp.accepted) this.attempt = Math.min(this.attempt + 1, 10);
            return resp;
        } finally {
            this.syncing = false;
        }
    }

    private async backoffDelay() {
        const base = nextBackoff(this.attempt, this.minBackoffMs, this.maxBackoffMs);
        const wait = jitter(base, this.jitterRatio);
        this.attempt = Math.min(this.attempt + 1, 20);
        await sleep(wait);
    }

    private async updateSyncAttempt(status: "OK" | "FAIL" | "OFFLINE") {
        const now = new Date().toISOString();
        try {
            const st = await db.sync_state.get("singleton");
            const backlog_count = await db.events.where("synced").equals(0).count();

            await db.sync_state.put({
                id: "singleton",
                last_terminal_sequence_acked: st?.last_terminal_sequence_acked ?? 0,
                backlog_count,
                last_sync_attempt_at: now,
                last_sync_ok_at: status === "OK" ? now : st?.last_sync_ok_at,
            });
        } catch (e) { /* ignore db errors */ }
    }

    async syncOnce(): Promise<IngestResponse | null> {
        // any cast necessary until Dexie schema is generic typed with ParkEvent
        const pending = (await db.events
            .where("synced")
            .equals(0)
            .limit(this.batchSize)
            .sortBy("terminal_sequence")) as any as ParkEvent[];

        if (pending.length === 0) {
            await this.updateSyncAttempt("OK");
            return null;
        }

        // recortar a bloque contiguo
        const contiguous: ParkEvent[] = [pending[0]!];
        for (let i = 1; i < pending.length; i++) {
            // Aseguramos number para evitar errores sutiles de tipos
            const prev = Number(contiguous[contiguous.length - 1]!.terminal_sequence);
            const cur = Number(pending[i]!.terminal_sequence);
            if (cur !== prev + 1) break;
            contiguous.push(pending[i]!);
        }

        const first = contiguous[0]!;
        const last = contiguous[contiguous.length - 1]!;

        const req: IngestRequest = {
            tenant_id: (first as any).tenant_id ?? (first as any).store_id ?? 'default_tenant',
            terminal_id: first.terminal_id,
            from_terminal_sequence: first.terminal_sequence,
            to_terminal_sequence: last.terminal_sequence,
            events: contiguous as any,
        };

        if (this.validateWithZodBeforeSend) {
            // detecta bugs locales antes de pegarle al server
            ingestRequestSchema.parse(req);
        }

        let resp: IngestResponse;
        try {
            const r = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-secret": "park_secret_mvp_2025" // Hardcoded for MVP Client-Side (no environment exposure in browser)
                },
                body: JSON.stringify(req),
            });

            resp = (await r.json()) as IngestResponse;

            if (!r.ok && !resp?.error) {
                resp = {
                    accepted: false,
                    acked_through_terminal_sequence: null,
                    error: {
                        error_code: "HTTP_ERROR",
                        severity: "ERROR",
                        message: `HTTP ${r.status}`,
                        user_action: "Reintenta la sincronización.",
                        retryable: true,
                        context: { status: r.status },
                    },
                };
            }
        } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            await this.updateSyncAttempt("FAIL");
            return {
                accepted: false,
                acked_through_terminal_sequence: null,
                error: {
                    error_code: "NETWORK_ERROR",
                    severity: "ERROR",
                    message: "No se pudo conectar al servidor.",
                    user_action: "Revisa tu conexión a internet y reintenta.",
                    retryable: true,
                    context: { message: e?.message },
                },
            };
        }

        if (resp.accepted && typeof resp.acked_through_terminal_sequence === "number") {
            const ack = resp.acked_through_terminal_sequence;

            await db.transaction("rw", db.events, db.sync_state, async () => {
                // Query by terminal_sequence instead of compound index
                const toAck = await db.events
                    .where("terminal_sequence")
                    .belowOrEqual(ack)
                    .and(e => e.synced === 0)
                    .toArray();

                // Mark as synced
                for (const e of toAck) {
                    e.synced = 1;
                    await db.events.put(e);
                }

                const backlog_count = await db.events.where("synced").equals(0).count();
                const now = new Date().toISOString();
                const st = await db.sync_state.get("singleton");

                await db.sync_state.put({
                    id: "singleton",
                    last_terminal_sequence_acked: Math.max(st?.last_terminal_sequence_acked ?? 0, ack),
                    backlog_count,
                    last_sync_attempt_at: now,
                    last_sync_ok_at: now,
                });
            });

            return resp;
        }

        await this.updateSyncAttempt("FAIL");
        return resp;
    }
}

let singleton: SyncClient | null = null;
export function getSyncClient(opts?: SyncClientOptions) {
    if (!singleton) singleton = new SyncClient(opts);
    return singleton;
}
