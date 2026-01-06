// src/core/sync/client.ts
import { db } from "@/src/core/db/schema";
import { ingestRequestSchema, type IngestRequest, type ParkEvent } from "@/src/core/domain/events";
import { syncCircuitBreaker } from "./circuit-breaker";

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

    private eventSource: EventSource | null = null;

    start() {
        if (this.running) return;
        this.running = true;

        if (typeof window !== "undefined") {
            window.addEventListener("online", this.onOnlineBound);
            this.timer = window.setInterval(() => void this.syncNow(), this.tickMs);
            this.connectSSE();
        }
        void this.syncNow();
    }

    stop() {
        this.running = false;
        if (typeof window !== "undefined") {
            window.removeEventListener("online", this.onOnlineBound);
            if (this.timer) window.clearInterval(this.timer);
            this.disconnectSSE();
        }
        this.timer = null;
    }

    private connectSSE() {
        if (this.eventSource) return;

        // TODO: Get tenant_id dynamically from context/auth
        const tenantId = "00000000-0000-0000-0000-000000000001";
        this.eventSource = new EventSource(`/api/events/stream?tenant_id=${tenantId}`);

        this.eventSource.onmessage = async (msg) => {
            try {
                const event = JSON.parse(msg.data);
                if (event.type === "CONNECTED") {
                    console.log("[Sync] SSE Connected");
                    return;
                }

                // Process incoming ParkEvent
                await this.handleIncomingEvent(event);
            } catch (error) {
                console.error("[Sync] SSE Error parsing:", error);
            }
        };

        this.eventSource.onerror = (e) => {
            // Browser auto-reconnects, but we log
            console.warn("[Sync] SSE Connection lost, browser will retry...", e);
        };
    }

    private disconnectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    private async handleIncomingEvent(event: ParkEvent) {
        // Idempotency check handled by DB unique constraints mainly, 
        // but we should verify if we already 'own' this event locally to avoid echoes
        // However, standard flow is: We create (Saved) -> Push -> Server -> SSE -> We receive.
        // If we receive our own event, we must ensure we don't duplicate or weirdly re-process.
        // The DB `put` might overwrite.

        try {
            await db.transaction('rw', db.events, async () => {
                const existing = await db.events.where({ tenant_id: event.tenant_id, event_id: event.event_id }).first();
                if (existing) {
                    // Start of idempotency: if it's identical, ignore.
                    // If we have it unsynced and server sends it, it implies it IS synced now.
                    if (existing.synced === 0) {
                        existing.synced = 1;
                        // Use put to update
                        await db.events.put(existing);
                    }
                    return;
                }

                // New event from ANOTHER terminal
                await db.events.add({
                    ...event,
                    synced: 1 // Comes from server, so it is synced
                } as any);

                // TODO: Here we should trigger Reducer / UI Refresh?
                // The Projections hooks `useProjections` rely on `useLiveQuery` from Dexie, 
                // so simply adding to DB *should* trigger UI update automatically!
            });
        } catch (e) {
            console.error("[Sync] Error applying SSE event:", e);
        }
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
        } catch (_e) { /* ignore db errors */ }
    }

    async syncOnce(): Promise<IngestResponse | null> {
        // Check circuit breaker first
        if (syncCircuitBreaker.isOpen()) {
            console.log('[Sync] Circuit breaker OPEN, skipping sync');
            return null;
        }

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
            resp = await syncCircuitBreaker.execute(async () => {
                const r = await fetch(this.endpoint, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "x-api-secret": "park_secret_mvp_2025"
                    },
                    body: JSON.stringify(req),
                });

                const data = (await r.json()) as IngestResponse;

                if (!r.ok && data?.error) {
                    console.error("[Sync] Server rejected batch:", JSON.stringify(data.error, null, 2));
                }

                if (!r.ok) {
                    throw new Error(data?.error?.message || `HTTP ${r.status}`);
                }

                return data;
            });
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            
            if (err.message === 'Circuit breaker is OPEN') {
                console.log('[Sync] Circuit breaker OPEN, skipping request');
                return null;
            }

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
                    context: { message: err.message },
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

    private onOnline() {
        // Reset backoff on network reconnect
        this.attempt = 0;
        void this.syncNow();
    }

    async syncNow(): Promise<void> {
        if (this.syncing) return;
        this.syncing = true;

        try {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                await this.updateSyncAttempt("OFFLINE");
                return;
            }

            const result = await this.syncOnce();

            if (result === null) {
                // No pending events
                this.attempt = 0;
                return;
            }

            if (result.accepted) {
                this.attempt = 0;
                // If there might be more events, schedule another sync immediately
                const remaining = await db.events.where("synced").equals(0).count();
                if (remaining > 0) {
                    void this.syncNow();
                }
            } else {
                // Retry with backoff
                this.attempt++;
                const delay = jitter(nextBackoff(this.attempt, this.minBackoffMs, this.maxBackoffMs), this.jitterRatio);
                console.warn(`[Sync] Batch rejected, retrying in ${delay}ms...`);
                await sleep(delay);
                void this.syncNow();
            }
        } catch (e) {
            console.error("[Sync] syncNow error:", e);
            this.attempt++;
        } finally {
            this.syncing = false;
        }
    }
}

let singleton: SyncClient | null = null;
export function getSyncClient(opts?: SyncClientOptions) {
    if (!singleton) singleton = new SyncClient(opts);
    return singleton;
}
