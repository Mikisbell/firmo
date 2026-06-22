// src/core/sync/client.ts
import { db } from "@/src/core/db/schema";
import { ingestRequestSchema, type IngestRequest, type ParkEvent } from "@/src/core/domain/events";
import { syncCircuitBreaker } from "./circuit-breaker";
import { logger, logEvents } from "@/src/core/observability/logger";
import { safeStorage } from "@/src/lib/storage";
import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

export type IngestResponse = {
    accepted: boolean;
    tenant_id?: string;
    terminal_id?: string;
    acked_through_terminal_sequence: number | null;
    deduped_event_ids?: string[];
    rejected?: Array<{ 
        event_id: string; 
        error: string; 
        details?: Record<string, unknown>;
    }>;
    merged?: Array<{
        event_id: string;
        merge_type: string;
    }>;
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

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str: string): boolean {
    return UUID_REGEX.test(str);
}

// Check if event has invalid UUIDs in payload (like product_id: "p1", "prod_001")
function hasInvalidUUIDs(event: ParkEvent): boolean {
    // First check actor_id - must be valid UUID or null/undefined
    if (event.actor_id && typeof event.actor_id === 'string') {
        if (!isValidUUID(event.actor_id)) {
            logger.warn('sync.invalid_uuid', `Event ${event.event_id} has invalid actor_id`, { 
                event_id: event.event_id, 
                actor_id: event.actor_id 
            });
            return true;
        }
    }

    // Deep search for invalid UUIDs in the entire payload
    const payloadStr = JSON.stringify(event.payload);
    
    // Check for common invalid patterns
    const invalidPatterns = [
        /"product_id"\s*:\s*"p\d+"/i,           // "product_id": "p1"
        /"product_id"\s*:\s*"prod_\d+"/i,       // "product_id": "prod_001"
        /"order_id"\s*:\s*"order_\d+"/i,        // "order_id": "order_1"
        /"line_id"\s*:\s*"line_\d+"/i,          // "line_id": "line_1" (this is OK, but check product_id)
    ];
    
    for (const pattern of invalidPatterns) {
        if (pattern.test(payloadStr)) {
            logger.warn('sync.invalid_uuid', `Found invalid UUID pattern in event ${event.event_id}`, { 
                event_id: event.event_id, 
                payload_preview: payloadStr.substring(0, 200) 
            });
            return true;
        }
    }
    
    // Also check specific fields
    const payload = event.payload as Record<string, unknown>;
    
    // Check common UUID fields at root level
    const uuidFields = ['product_id', 'order_id', 'shift_id', 'invoice_id', 'customer_id'];
    
    for (const field of uuidFields) {
        if (payload[field] && typeof payload[field] === 'string') {
            if (!isValidUUID(payload[field] as string)) {
                return true;
            }
        }
    }
    
    // Check nested line items
    if (payload.line && typeof payload.line === 'object') {
        const line = payload.line as Record<string, unknown>;
        if (line.product_id && typeof line.product_id === 'string') {
            if (!isValidUUID(line.product_id as string)) {
                return true;
            }
        }
    }
    
    // Check items array
    if (Array.isArray(payload.items)) {
        for (const item of payload.items) {
            if (item.product_id && typeof item.product_id === 'string') {
                if (!isValidUUID(item.product_id as string)) {
                    return true;
                }
            }
        }
    }
    
    return false;
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
    private retryCount = 0; // Contador de reintentos para límite de 5
    private timer: number | null = null;
    private onOnlineBound: () => void;

    constructor(opts: SyncClientOptions = {}) {
        this.endpoint = opts.endpoint ?? "/api/data-sync/ingest";
        this.batchSize = opts.batchSize ?? 200;
        this.tickMs = opts.tickMs ?? 5000;
        this.maxBackoffMs = opts.maxBackoffMs ?? 60000;
        this.minBackoffMs = opts.minBackoffMs ?? 1000;
        this.jitterRatio = opts.jitterRatio ?? 0.2;
        this.validateWithZodBeforeSend = opts.validateWithZodBeforeSend ?? false;
        this.onOnlineBound = this.onOnline.bind(this);
    }

    private eventSource: EventSource | null = null;
    private realtimeClient: SupabaseClient | null = null;
    private realtimeChannel: RealtimeChannel | null = null;
    private realtimeConnecting = false;
    private realtimeTokenTimer: number | null = null;

    start() {
        if (this.running) return;
        this.running = true;

        if (typeof window !== "undefined") {
            window.addEventListener("online", this.onOnlineBound);
            this.timer = window.setInterval(() => void this.syncNow(), this.tickMs);
            this.connectSSE();
            // Realtime por Supabase (broadcast) en PARALELO al SSE; ambos alimentan
            // handleIncomingEvent (idempotente). Transicion sin riesgo: si Realtime falla,
            // SSE + polling siguen entregando.
            void this.connectRealtime();
            
            // Clean up invalid events on startup BEFORE first sync
            this.cleanupInvalidEvents().then(() => {
                void this.syncNow();
            });
            return; // Don't call syncNow() below, wait for cleanup
        }
        void this.syncNow();
    }
    
    /**
     * Clean up events with invalid actor_id on startup.
     * Marks them as synced to prevent retry loops.
     */
    private async cleanupInvalidEvents(): Promise<void> {
        try {
            const pending = await db.events
                .where("synced")
                .equals(0)
                .toArray() as any as ParkEvent[];
            
            const invalidEvents = pending.filter(e => hasInvalidUUIDs(e));
            
            if (invalidEvents.length > 0) {
                await db.transaction('rw', db.events, async () => {
                    for (const ev of invalidEvents) {
                        if ((ev as any).id) {
                            await db.events.update((ev as any).id, { synced: 1 });
                        }
                    }
                });
                logger.info('sync.cleanup', `Cleaned up ${invalidEvents.length} events with invalid UUIDs on startup`, { 
                    count: invalidEvents.length 
                });
            }
        } catch (e) {
            logger.error('sync.cleanup_error', 'Error cleaning up invalid events', e instanceof Error ? e : new Error(String(e)));
        }
    }

    stop() {
        this.running = false;
        if (typeof window !== "undefined") {
            window.removeEventListener("online", this.onOnlineBound);
            if (this.timer) window.clearInterval(this.timer);
            this.disconnectSSE();
            this.disconnectRealtime();
        }
        this.timer = null;
    }

    /** Lee el tenant_id de la config del terminal en localStorage (o null si no esta). */
    private getConfiguredTenantId(): string | null {
        if (typeof localStorage === 'undefined') return null;
        try {
            const configStr = safeStorage.getItem('park_terminal_config');
            if (configStr) {
                const config = JSON.parse(configStr);
                return config.tenant_id ?? null;
            }
        } catch {
            logger.error('sync.tenant_parse_error', 'Error reading tenant config');
        }
        return null;
    }

    // @deprecated FASE 3 (issue #4): SSE legacy, corre en paralelo al realtime de Supabase.
    // Retirar (dejar solo connectRealtime) tras validar el realtime con trafico real.
    private connectSSE() {
        if (this.eventSource) return;

        const tenantId = this.getConfiguredTenantId();
        if (!tenantId) {
            logger.debug('sync.no_tenant', 'No tenant_id available for SSE connection. Terminal not configured.');
            return;
        }
        
        this.eventSource = new EventSource(`/api/data-sync/stream?tenant_id=${tenantId}`);

        this.eventSource.onmessage = async (msg) => {
            try {
                const event = JSON.parse(msg.data);
                if (event.type === "CONNECTED") {
                    logger.info('sync.sse_connected', 'SSE Connected');
                    return;
                }

                // Process incoming ParkEvent
                await this.handleIncomingEvent(event);
            } catch (error) {
                logger.error('sync.sse_parse_error', 'SSE Error parsing', error instanceof Error ? error : new Error(String(error)));
            }
        };

        this.eventSource.onerror = (_e) => {
            // Browser auto-reconnects, but we log
            logger.warn('sync.sse_connection_lost', 'SSE Connection lost, browser will retry...');
        };
    }

    private disconnectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    /**
     * Suscripcion a Supabase Realtime (canal privado del tenant) por WEBSOCKET.
     * Corre en PARALELO al SSE durante la transicion: los eventos que llegan por
     * broadcast pasan por el mismo handleIncomingEvent idempotente, asi recibir el
     * mismo evento por SSE y por Realtime no duplica nada. Sin puerto 5432 -> Cloudflare-safe.
     */
    private async connectRealtime() {
        // Guard SINCRONO: realtimeChannel se setea DESPUES del await del fetch, asi que dos
        // llamadas concurrentes (p.ej. React StrictMode en dev) pasaban el guard viejo y
        // creaban DOS clientes Realtime -> warning "Multiple GoTrueClient". realtimeConnecting
        // bloquea la segunda llamada antes del primer await.
        if (this.realtimeChannel || this.realtimeClient || this.realtimeConnecting) return;
        if (typeof window === 'undefined') return;

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
            logger.debug('sync.realtime_disabled', 'Supabase Realtime no configurado; se usa solo SSE');
            return;
        }

        const tenantId = this.getConfiguredTenantId();
        if (!tenantId) return;

        this.realtimeConnecting = true;
        try {
            // El token (y el tenant) los decide el servidor desde la sesion, no el cliente.
            const res = await fetch('/api/realtime/token', { credentials: 'include' });
            if (!res.ok) {
                logger.warn('sync.realtime_token_failed', `No se pudo obtener token Realtime (HTTP ${res.status}); se usa solo SSE`);
                return;
            }
            const { token, channel: serverTopic } = await res.json();

            // Cliente SOLO para Realtime: deshabilitamos la auth persistente de GoTrue para no
            // registrar otra instancia que comparte storage key (warning "Multiple GoTrueClient").
            const client = createClient(url, anonKey, {
                // storageKey propia: no compartir la default con otros clientes Supabase del
                // browser (p.ej. el de imagenes) -> mata el warning "Multiple GoTrueClient".
                auth: { persistSession: false, autoRefreshToken: false, storageKey: 'park-realtime-auth' },
            });
            client.realtime.setAuth(token);
            this.realtimeClient = client;

            // Usamos el topic que devuelve el servidor: deriva del tenant de la SESION, igual que
            // el claim tenant_id del token. Si lo armamos en el cliente desde el tenant local y
            // difiere del claim, el RLS del canal privado deniega la suscripcion -> CHANNEL_ERROR.
            const channel = client.channel(serverTopic ?? `tenant:${tenantId}`, { config: { private: true } });
            channel.on('broadcast', { event: 'park_event' }, (msg) => {
                void this.handleIncomingEvent(msg.payload as ParkEvent);
            });
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    logger.info('sync.realtime_connected', 'Supabase Realtime conectado');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    logger.warn('sync.realtime_error', `Canal Realtime ${status}; SSE/polling siguen activos`);
                }
            });
            this.realtimeChannel = channel;

            // El token minteado expira en 1h: lo renovamos antes (cada 50 min) para no
            // perder el realtime en sesiones largas (cajas abiertas todo el dia).
            this.realtimeTokenTimer = window.setInterval(() => {
                void this.refreshRealtimeToken();
            }, 50 * 60 * 1000);
        } catch (e) {
            logger.error('sync.realtime_connect_error', 'Error conectando a Supabase Realtime', e instanceof Error ? e : new Error(String(e)));
        } finally {
            this.realtimeConnecting = false;
        }
    }

    /** Renueva el token de Realtime antes de que expire y lo re-aplica al cliente. */
    private async refreshRealtimeToken() {
        if (!this.realtimeClient) return;
        try {
            const res = await fetch('/api/realtime/token', { credentials: 'include' });
            if (!res.ok) {
                logger.warn('sync.realtime_token_refresh_failed', `No se pudo renovar token Realtime (HTTP ${res.status})`);
                return;
            }
            const { token } = await res.json();
            this.realtimeClient.realtime.setAuth(token);
            logger.debug('sync.realtime_token_refreshed', 'Token de Realtime renovado');
        } catch (e) {
            logger.warn('sync.realtime_token_refresh_failed', 'Error renovando token de Realtime');
        }
    }

    private disconnectRealtime() {
        if (this.realtimeTokenTimer) {
            window.clearInterval(this.realtimeTokenTimer);
            this.realtimeTokenTimer = null;
        }
        if (this.realtimeClient && this.realtimeChannel) {
            void this.realtimeClient.removeChannel(this.realtimeChannel);
        }
        this.realtimeChannel = null;
        this.realtimeClient = null;
    }

    private async handleIncomingEvent(event: ParkEvent) {
        // Idempotency check handled by DB unique constraints mainly, 
        // but we should verify if we already 'own' this event locally to avoid echoes
        // However, standard flow is: We create (Saved) -> Push -> Server -> SSE -> We receive.
        // If we receive our own event, we must ensure we don't duplicate or weirdly re-process.
        // The DB `put` might overwrite.

        try {
            await db.transaction('rw', db.events, async () => {
                const existing = await db.events
                    .where('[tenant_id+event_id]')
                    .equals([event.tenant_id, event.event_id])
                    .first();
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
            logger.error('sync.sse_apply_error', 'Error applying SSE event', e instanceof Error ? e : new Error(String(e)));
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
            logger.debug('sync.circuit_open', 'Circuit breaker OPEN, skipping sync');
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

        // Filter out events with invalid UUIDs and mark them as synced to prevent retry loops
        const validEvents: ParkEvent[] = [];
        const invalidEvents: ParkEvent[] = [];
        
        for (const event of pending) {
            if (hasInvalidUUIDs(event)) {
                invalidEvents.push(event);
                logger.warn('sync.skip_invalid', `Skipping event ${event.event_id} with invalid UUID in payload`, { 
                    event_id: event.event_id 
                });
            } else {
                validEvents.push(event);
            }
        }
        
        // Mark invalid events as "synced" to stop retry attempts
        if (invalidEvents.length > 0) {
            await db.transaction('rw', db.events, async () => {
                for (const ev of invalidEvents) {
                    // Use the auto-increment id if available, otherwise find by event_id
                    if ((ev as any).id) {
                        await db.events.update((ev as any).id, { synced: 1 });
                    } else {
                        // Find by tenant_id + event_id compound key
                        const existing = await db.events
                            .where('[tenant_id+event_id]')
                            .equals([ev.tenant_id, ev.event_id])
                            .first();
                        if (existing?.id) {
                            await db.events.update(existing.id, { synced: 1 });
                        }
                    }
                }
            });
            logger.info('sync.marked_invalid', `Marked ${invalidEvents.length} invalid events as synced`, { 
                count: invalidEvents.length 
            });
        }
        
        if (validEvents.length === 0) {
            await this.updateSyncAttempt("OK");
            return null;
        }

        // recortar a bloque contiguo
        const contiguous: ParkEvent[] = [validEvents[0]!];
        for (let i = 1; i < validEvents.length; i++) {
            // Aseguramos number para evitar errores sutiles de tipos
            const prev = Number(contiguous[contiguous.length - 1]!.terminal_sequence);
            const cur = Number(validEvents[i]!.terminal_sequence);
            if (cur !== prev + 1) break;
            contiguous.push(validEvents[i]!);
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
                // AUTH (fix bug #3): enviamos el cookie HttpOnly de sesion (auth_token) via
                // credentials:'include'. El ingest deriva tenant_id/actor_id del JWT verificado
                // con jose — elimina el NEXT_PUBLIC_API_SECRET que se empaquetaba en el bundle
                // del navegador (riesgo de inyeccion cross-tenant).
                const r = await fetch(this.endpoint, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify(req),
                });

                const data = (await r.json()) as IngestResponse;

                if (!r.ok && data?.error) {
                    const statusCode = r.status;
                    
                    logger.error('sync.server_rejected', 'Server rejected batch', undefined, { 
                        error_code: data.error.error_code,
                        message: data.error.message,
                        status: statusCode,
                        retryable: data.error.retryable
                    });
                    
                    // HTTP 429 → Respetar Retry-After header
                    if (statusCode === 429) {
                        const retryAfter = parseInt(r.headers.get('Retry-After') || '1');
                        logger.warn('sync.rate_limited', `Rate limited, respecting Retry-After: ${retryAfter}s`, {
                            retry_after: retryAfter,
                            error_code: data.error.error_code
                        });
                        
                        // Esperar el tiempo especificado antes de lanzar error para retry
                        await sleep(retryAfter * 1000);
                        throw new Error('RATE_LIMIT_RETRY');
                    }
                    
                    // HTTP 4xx (excepto 429) → NO reintentar
                    if (statusCode >= 400 && statusCode < 500) {
                        logger.error('sync.client_error', `Client error ${statusCode}, NOT retrying`, undefined, {
                            error_code: data.error.error_code,
                            status: statusCode,
                            message: data.error.message
                        });
                        
                        // If SCHEMA_VALIDATION_FAILED with actor_id issues, mark events as synced to stop retry loop
                        if (data.error.error_code === 'SCHEMA_VALIDATION_FAILED' && data.error.context?.issues) {
                            const issues = data.error.context.issues as Array<{ path?: string[]; validation?: string }>;
                            const hasActorIdIssue = issues.some(i => 
                                i.path?.includes('actor_id') && i.validation === 'uuid'
                            );
                            
                            if (hasActorIdIssue) {
                                logger.warn('sync.invalid_actor_id', 'Detected invalid actor_id in batch, marking events as synced to prevent retry loop');
                                // Mark all events in this batch as synced
                                await db.transaction('rw', db.events, async () => {
                                    for (const ev of contiguous) {
                                        if ((ev as any).id) {
                                            await db.events.update((ev as any).id, { synced: 1 });
                                        }
                                    }
                                });
                            }
                        }
                        
                        // Return error without retrying
                        return {
                            accepted: false,
                            acked_through_terminal_sequence: null,
                            error: {
                                ...data.error,
                                retryable: false,
                            },
                        };
                    }
                    
                    // HTTP 5xx → Reintentar con exponential backoff
                    if (statusCode >= 500) {
                        logger.warn('sync.server_error', `Server error ${statusCode}, will retry with backoff`, {
                            error_code: data.error.error_code,
                            status: statusCode,
                            message: data.error.message
                        });
                        throw new Error(data.error.message || `HTTP ${statusCode}`);
                    }
                }

                if (!r.ok) {
                    throw new Error(data?.error?.message || `HTTP ${r.status}`);
                }

                return data;
            });
        } catch (e: unknown) {
            const err = e instanceof Error ? e : new Error(String(e));
            // Logging estructurado (Pino): loguea solo el error normalizado, nunca el payload crudo.
            logger.error('sync.fetch_error', 'Sync fetch failed', err, { message: err.message });
            
            if (err.message === 'Circuit breaker is OPEN') {
                logger.debug('sync.circuit_open', 'Circuit breaker OPEN, skipping request');
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
        // Reset backoff and retry count on network reconnect
        this.attempt = 0;
        this.retryCount = 0;
        logger.info('sync.network_reconnected', 'Network reconnected, resetting retry counters');
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
                this.retryCount = 0;
                return;
            }

            if (result.accepted) {
                this.attempt = 0;
                this.retryCount = 0;
                
                // Handle conflicts - emit events for UI
                await this.handleConflictResponse(result);
                
                // If there might be more events, schedule another sync immediately
                const remaining = await db.events.where("synced").equals(0).count();
                if (remaining > 0) {
                    void this.syncNow();
                }
            } else {
                // Check if error is retryable
                if (result.error && !result.error.retryable) {
                    logger.error('sync.non_retryable_error', 'Non-retryable error, stopping retry attempts', undefined, {
                        error_code: result.error.error_code,
                        message: result.error.message
                    });
                    this.attempt = 0;
                    this.retryCount = 0;
                    return;
                }
                
                // Increment retry counter
                this.retryCount++;
                
                // Check if we've exceeded max retries (5 for 5xx errors)
                if (this.retryCount > 5) {
                    logger.error('sync.max_retries_exceeded', 'Max retries (5) exceeded, stopping retry attempts', undefined, {
                        retry_count: this.retryCount,
                        error_code: result.error?.error_code
                    });
                    this.attempt = 0;
                    this.retryCount = 0;
                    return;
                }
                
                // Retry with exponential backoff
                this.attempt++;
                const delay = jitter(nextBackoff(this.attempt, this.minBackoffMs, this.maxBackoffMs), this.jitterRatio);
                
                logger.warn('sync.batch_rejected', `Batch rejected, retrying in ${delay}ms (attempt ${this.retryCount}/5)`, { 
                    delay_ms: delay,
                    retry_count: this.retryCount,
                    attempt: this.attempt,
                    error_code: result.error?.error_code
                });
                
                await sleep(delay);
                void this.syncNow();
            }
        } catch (e) {
            logger.error('sync.error', 'syncNow error', e instanceof Error ? e : new Error(String(e)));
            this.attempt++;
            this.retryCount++;
        } finally {
            this.syncing = false;
        }
    }

    /**
     * Handle conflict responses from server.
     * Emits events for UI and refreshes affected orders.
     */
    private async handleConflictResponse(resp: IngestResponse): Promise<void> {
        // Handle rejected events (REVISION_CONFLICT, PAYMENT_CONFLICT)
        if (resp.rejected && resp.rejected.length > 0) {
            for (const rejection of resp.rejected) {
                const conflictType = rejection.error as 'REVISION_CONFLICT' | 'PAYMENT_CONFLICT';
                
                if (conflictType === 'REVISION_CONFLICT' || conflictType === 'PAYMENT_CONFLICT') {
                    logger.warn(logEvents.CONFLICT_DETECTED, `Conflict detected: ${conflictType} for event ${rejection.event_id}`, { 
                        event_id: rejection.event_id,
                        conflict_type: conflictType 
                    });
                    
                    // Emit event for UI
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('conflict-detected', {
                            detail: {
                                type: conflictType,
                                event_id: rejection.event_id,
                                aggregate_id: rejection.details?.aggregate_id,
                                details: rejection.details,
                            }
                        }));
                    }
                    
                    // Refresh the affected order from server
                    const aggregateId = rejection.details?.aggregate_id as string;
                    if (aggregateId) {
                        await this.refreshOrder(aggregateId);
                    }
                }
            }
        }
        
        // Handle merged events (informational)
        if (resp.merged && resp.merged.length > 0) {
            for (const merge of resp.merged) {
                logger.info(logEvents.CONFLICT_RESOLVED, `Event ${merge.event_id} was merged with strategy: ${merge.merge_type}`, { 
                    event_id: merge.event_id,
                    merge_type: merge.merge_type 
                });
                
                // Emit event for UI (optional toast)
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('conflict-detected', {
                        detail: {
                            type: 'MERGED',
                            event_id: merge.event_id,
                            details: { merge_type: merge.merge_type },
                        }
                    }));
                }
            }
        }
    }

    /**
     * Refresh an order from the server.
     * Used after conflict detection to get the latest state.
     * Emits an event for UI to refresh its local state.
     */
    async refreshOrder(orderId: string): Promise<boolean> {
        try {
            // AUTH (fix bug #3): cookie HttpOnly de sesion (auth_token) via credentials:'include'.
            // Same-origin: el cookie viaja solo y /state deriva el tenant del JWT.
            const response = await fetch(`/api/orders/${orderId}/state`, {
                credentials: "include",
            });
            
            if (!response.ok) {
                logger.warn('sync.refresh_failed', `Failed to refresh order ${orderId}: ${response.status}`, { 
                    order_id: orderId, 
                    status: response.status 
                });
                return false;
            }
            
            const data = await response.json();
            
            // Emit event for UI to update its local state
            // The UI components using useLiveQuery will pick this up
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('order-refreshed', {
                    detail: {
                        orderId,
                        order: data.order,
                        revision: data.revision,
                    }
                }));
            }
            
            logger.info('sync.order_refreshed', `Refreshed order ${orderId} from server (revision: ${data.revision})`, { 
                order_id: orderId, 
                revision: data.revision 
            });
            return true;
        } catch (e) {
            logger.error('sync.refresh_error', `Error refreshing order ${orderId}`, e instanceof Error ? e : new Error(String(e)), { 
                order_id: orderId 
            });
            return false;
        }
    }
}

let singleton: SyncClient | null = null;
export function getSyncClient(opts?: SyncClientOptions) {
    if (!singleton) singleton = new SyncClient(opts);
    return singleton;
}

// ============================================================================
// Conflict Event Types (for UI notification)
// ============================================================================

export type ConflictEvent = {
    type: 'REVISION_CONFLICT' | 'PAYMENT_CONFLICT' | 'MERGED';
    event_id: string;
    aggregate_id?: string;
    details?: Record<string, unknown>;
};

export function emitConflictEvent(conflict: ConflictEvent) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('conflict-detected', { detail: conflict }));
    }
}
