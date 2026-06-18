/**
 * EventBus - Sistema de publicación/suscripción para eventos en tiempo real
 * 
 * Soporta dos implementaciones:
 * - SupabaseEventBus: Usa PostgreSQL LISTEN/NOTIFY (multi-instancia)
 * - InMemoryEventBus: Usa EventEmitter de Node.js (single-instancia, fallback)
 * 
 * @module core/infra/event-bus
 */

import { EventEmitter } from "events";
import { ParkEvent } from "@/src/core/domain/events";
import { SupabaseEventBus } from "./supabase-event-bus";
import { SupabaseRealtimeEventBus } from "@/src/core/realtime/supabase-realtime-event-bus";
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('event-bus');

/**
 * Interfaz común para EventBus
 * 
 * Permite intercambiar implementaciones sin cambiar código cliente.
 * Soporta retorno síncrono (InMemory) y asíncrono (Supabase).
 */
export interface EventBus {
    /**
     * Publicar evento a un tenant específico
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param event - Evento a publicar
     */
    publish(tenantId: string, event: ParkEvent): Promise<void> | void;
    
    /**
     * Suscribirse a eventos de un tenant específico
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param listener - Función callback para eventos
     * @returns Función de cleanup para cancelar suscripción
     */
    subscribe(
        tenantId: string,
        listener: (event: ParkEvent) => void
    ): Promise<() => void> | (() => void);
}

/**
 * Implementación in-memory del EventBus usando EventEmitter
 * 
 * Solo funciona dentro del mismo proceso. NO comparte eventos
 * entre múltiples instancias de Next.js.
 * 
 * Usar solo como fallback en desarrollo sin Supabase configurado.
 */
class InMemoryEventBus extends EventEmitter implements EventBus {
    constructor() {
        super();
        this.setMaxListeners(100); // Permitir múltiples clientes SSE
    }

    publish(tenantId: string, event: ParkEvent): void {
        this.emit(`event:${tenantId}`, event);
    }

    subscribe(tenantId: string, listener: (event: ParkEvent) => void): () => void {
        const channel = `event:${tenantId}`;
        this.on(channel, listener);
        return () => this.off(channel, listener);
    }
}

/**
 * Factory para crear EventBus según configuración
 * 
 * - Si DATABASE_URL o DIRECT_URL está configurado → SupabaseEventBus
 * - Si no → InMemoryEventBus (fallback)
 * 
 * @returns Instancia de EventBus (Supabase o InMemory)
 */
/**
 * EventBus compuesto: publica a DOS buses a la vez.
 *
 * Se usa durante la transicion de PG LISTEN/NOTIFY a Supabase Realtime: el ingest
 * emite al bus primario (pg, para los clientes SSE actuales) Y al secundario
 * (Supabase broadcast, para los clientes nuevos). Un fallo en uno NO tumba al otro
 * ni al ingest (best-effort con allSettled).
 */
class CompositeEventBus implements EventBus {
    constructor(
        private readonly primary: EventBus,
        private readonly secondary: EventBus,
    ) {}

    async publish(tenantId: string, event: ParkEvent): Promise<void> {
        const results = await Promise.allSettled([
            Promise.resolve(this.primary.publish(tenantId, event)),
            Promise.resolve(this.secondary.publish(tenantId, event)),
        ]);
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                log.error(
                    `Fallo al publicar en el bus ${i === 0 ? 'primario (pg)' : 'secundario (realtime)'}`,
                    r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
                    { tenantId, eventId: event.event_id },
                );
            }
        });
    }

    // Los clientes SSE actuales siguen suscribiendose por el bus primario (pg).
    subscribe(tenantId: string, listener: (event: ParkEvent) => void) {
        return this.primary.subscribe(tenantId, listener);
    }
}

function createEventBus(): EventBus {
    // LISTEN/NOTIFY MUST use a direct connection, not a transaction pooler.
    const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (databaseUrl) {
        const pgBus = new SupabaseEventBus(databaseUrl);

        // Iniciar conexión asíncrona (no bloquear)
        pgBus.connect().catch(err => {
            log.error('Error inicial de conexión', err instanceof Error ? err : new Error(String(err)));
        });

        // Si hay credenciales de Supabase Realtime, emitimos tambien por broadcast
        // (transicion a Realtime sin romper a los clientes SSE existentes).
        if (supabaseUrl && serviceRoleKey) {
            log.info('EventBus compuesto: pg (SSE) + Supabase Realtime (broadcast)');
            const realtimeBus = new SupabaseRealtimeEventBus(supabaseUrl, serviceRoleKey);
            return new CompositeEventBus(pgBus, realtimeBus);
        }

        log.info('Usando SupabaseEventBus (PostgreSQL LISTEN/NOTIFY)');
        return pgBus;
    } else {
        log.warn('DATABASE_URL no configurado, usando InMemoryEventBus (fallback)');
        log.warn('Eventos NO se compartirán entre instancias');
        return new InMemoryEventBus();
    }
}

// Singleton global - asegurar única instancia across hot-reloads en dev
const globalForBus = global as unknown as { parkEventBus: EventBus };

export const eventBus = globalForBus.parkEventBus || createEventBus();

if (process.env.NODE_ENV !== "production") {
    globalForBus.parkEventBus = eventBus;
}
