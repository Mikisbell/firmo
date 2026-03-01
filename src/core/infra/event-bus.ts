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
function createEventBus(): EventBus {
    const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    
    if (databaseUrl) {
        log.info('Usando SupabaseEventBus (PostgreSQL LISTEN/NOTIFY)');
        const bus = new SupabaseEventBus(databaseUrl);
        
        // Iniciar conexión asíncrona (no bloquear)
        bus.connect().catch(err => {
            log.error('Error inicial de conexión', err instanceof Error ? err : new Error(String(err)));
        });
        
        return bus;
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
