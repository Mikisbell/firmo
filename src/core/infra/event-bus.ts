/**
 * EventBus - Sistema de publicación de eventos en tiempo real.
 *
 * Implementaciones:
 * - SupabaseRealtimeEventBus: emite por broadcast HTTP de Supabase Realtime.
 *   Único transporte de producción (Cloudflare Workers no habla TCP, así que el
 *   viejo PG LISTEN/NOTIFY no aplica). Los clientes se suscriben directo al
 *   WebSocket de Supabase Realtime (ver src/core/sync/client.ts).
 * - InMemoryEventBus: EventEmitter de Node, fallback degradado cuando NO hay
 *   credenciales de Supabase (single-proceso, sin realtime cross-instancia).
 *
 * @module core/infra/event-bus
 */

import { EventEmitter } from "events";
import { ParkEvent } from "@/src/core/domain/events";
import { SupabaseRealtimeEventBus } from "@/src/core/realtime/supabase-realtime-event-bus";
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('event-bus');

/**
 * Interfaz común para EventBus.
 *
 * Permite intercambiar implementaciones sin cambiar código cliente.
 * Soporta retorno síncrono (InMemory) y asíncrono (Supabase).
 */
export interface EventBus {
    /**
     * Publicar evento a un tenant específico.
     *
     * @param tenantId - ID del tenant (UUID)
     * @param event - Evento a publicar
     */
    publish(tenantId: string, event: ParkEvent): Promise<void> | void;

    /**
     * Suscribirse a eventos de un tenant (solo InMemory, fallback dev).
     * En producción los clientes se suscriben directo a Supabase Realtime, no
     * por el servidor; por eso `SupabaseRealtimeEventBus.subscribe` lanza.
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
 * Implementación in-memory del EventBus usando EventEmitter.
 *
 * Solo funciona dentro del mismo proceso. NO comparte eventos entre instancias.
 * Fallback de desarrollo cuando no hay credenciales de Supabase Realtime.
 */
class InMemoryEventBus extends EventEmitter implements EventBus {
    constructor() {
        super();
        this.setMaxListeners(100);
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
 * Factory: elige el transporte según configuración.
 *
 * - Con credenciales de Supabase Realtime → `SupabaseRealtimeEventBus` (prod).
 * - Sin ellas → `InMemoryEventBus` (fallback degradado, sin realtime).
 */
function createEventBus(): EventBus {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
        log.info('Usando SupabaseRealtimeEventBus (broadcast HTTP, Cloudflare-safe)');
        return new SupabaseRealtimeEventBus(supabaseUrl, serviceRoleKey);
    }

    log.warn(
        'Supabase Realtime no configurado (faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY); ' +
        'usando InMemoryEventBus (fallback degradado, sin realtime cross-instancia)',
    );
    return new InMemoryEventBus();
}

// Singleton global - asegurar única instancia across hot-reloads en dev
const globalForBus = global as unknown as { parkEventBus: EventBus };

export const eventBus = globalForBus.parkEventBus || createEventBus();

if (process.env.NODE_ENV !== "production") {
    globalForBus.parkEventBus = eventBus;
}
