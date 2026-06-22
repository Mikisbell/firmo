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
     * No hay `subscribe()` server-side: los clientes se suscriben DIRECTO a
     * Supabase Realtime por WebSocket (ver src/core/sync/client.ts). El servidor
     * solo emite.
     *
     * @param tenantId - ID del tenant (UUID)
     * @param event - Evento a publicar
     */
    publish(tenantId: string, event: ParkEvent): Promise<void> | void;
}

/**
 * Implementación in-memory del EventBus (no-op de emisión).
 *
 * Fallback degradado cuando no hay credenciales de Supabase Realtime: no hay
 * push en tiempo real (los clientes dependen solo del polling). Los eventos
 * igualmente persisten en la DB vía el ingest.
 */
class InMemoryEventBus implements EventBus {
    publish(_tenantId: string, _event: ParkEvent): void {
        // Sin transporte de realtime configurado: no-op. El polling del cliente
        // (SyncClient.tick) trae los eventos igual.
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
