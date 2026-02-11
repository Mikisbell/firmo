/**
 * EventBus basado en Supabase Realtime (PostgreSQL LISTEN/NOTIFY)
 * 
 * Reemplaza el EventBus in-memory para soportar múltiples instancias
 * de Next.js compartiendo eventos en tiempo real.
 * 
 * @module core/infra/supabase-event-bus
 */

import { Pool, PoolClient } from 'pg';
import { ParkEvent } from '@/src/core/domain/events';

/**
 * Tipo de listener para eventos
 */
type EventListener = (event: ParkEvent) => void;

/**
 * Tipo de canal de eventos por tenant
 * Formato: 'events:{tenant_id}'
 */
type EventChannel = `events:${string}`;

/**
 * EventBus basado en PostgreSQL LISTEN/NOTIFY
 * 
 * Características:
 * - Soporta múltiples instancias de Next.js
 * - Reconexión automática con exponential backoff
 * - Aislamiento por tenant
 * - Manejo robusto de errores
 */
export class SupabaseEventBus {
    private pool: Pool | null = null;
    private client: PoolClient | null = null;
    private listeners: Map<EventChannel, Set<EventListener>> = new Map();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectDelay: number = 30000; // 30 segundos
    private readonly connectionString: string;
    
    constructor(connectionString: string) {
        this.connectionString = connectionString;
    }
    
    /**
     * Conectar al PostgreSQL y preparar para LISTEN/NOTIFY
     * 
     * Establece la conexión con PostgreSQL y configura el handler
     * para recibir notificaciones. Si la conexión falla, programa
     * un reintento automático con exponential backoff.
     */
    async connect(): Promise<void> {
        try {
            // Crear pool de conexiones
            this.pool = new Pool({ 
                connectionString: this.connectionString,
                max: 10, // Máximo 10 conexiones en el pool
            });
            
            // Obtener cliente dedicado para LISTEN
            this.client = await this.pool.connect();
            
            // Configurar handler para notificaciones
            this.client.on('notification', this.handleNotification.bind(this));
            
            // Re-suscribir a todos los canales activos
            for (const channel of this.listeners.keys()) {
                await this.client.query(`LISTEN "${channel}"`);
            }
            
            // Emitir evento de reconexión si es una reconexión (no primera conexión)
            const wasReconnecting = this.reconnectAttempts > 0;
            
            // Resetear contador de reintentos
            this.reconnectAttempts = 0;
            
            console.log('[SupabaseEventBus] Conectado exitosamente a PostgreSQL');
            
            // Emitir evento RECONNECTED si fue una reconexión
            if (wasReconnecting) {
                this.emitReconnectedEvent();
            }
        } catch (error) {
            console.error('[SupabaseEventBus] Error al conectar a PostgreSQL:', error);
            this.scheduleReconnect();
        }
    }
    
    /**
     * Publicar evento a un canal específico de tenant
     * 
     * Usa PostgreSQL NOTIFY para distribuir el evento a todas las
     * instancias que estén escuchando el canal del tenant.
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param event - Evento a publicar
     * @throws Error si el EventBus no está conectado
     */
    async publish(tenantId: string, event: ParkEvent): Promise<void> {
        if (!this.client) {
            throw new Error('[SupabaseEventBus] EventBus no conectado - no se puede publicar evento');
        }
        
        const channel = `events:${tenantId}` as EventChannel;
        const payload = JSON.stringify(event);
        
        try {
            await this.client.query('SELECT pg_notify($1, $2)', [channel, payload]);
        } catch (error) {
            console.error('[SupabaseEventBus] Error al publicar evento:', {
                tenantId,
                eventId: event.event_id,
                error,
            });
            throw error;
        }
    }
    
    /**
     * Suscribirse a eventos de un tenant específico
     * 
     * Ejecuta LISTEN en PostgreSQL para recibir notificaciones del
     * canal del tenant. Retorna una función de cleanup para cancelar
     * la suscripción.
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param listener - Función callback para eventos
     * @returns Función de cleanup para cancelar suscripción
     */
    async subscribe(
        tenantId: string,
        listener: EventListener
    ): Promise<() => void> {
        const channel = `events:${tenantId}` as EventChannel;
        
        // Agregar listener al mapa
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set());
            
            // Ejecutar LISTEN si estamos conectados
            if (this.client) {
                try {
                    await this.client.query(`LISTEN "${channel}"`);
                    console.log(`[SupabaseEventBus] Suscrito al canal: ${channel}`);
                } catch (error) {
                    console.error(`[SupabaseEventBus] Error al ejecutar LISTEN en canal ${channel}:`, error);
                }
            }
        }
        
        this.listeners.get(channel)!.add(listener);
        
        // Retornar función de cleanup
        return async () => {
            const channelListeners = this.listeners.get(channel);
            if (channelListeners) {
                channelListeners.delete(listener);
                
                // Si no quedan listeners, ejecutar UNLISTEN
                if (channelListeners.size === 0) {
                    this.listeners.delete(channel);
                    if (this.client) {
                        try {
                            await this.client.query(`UNLISTEN "${channel}"`);
                            console.log(`[SupabaseEventBus] Desuscrito del canal: ${channel}`);
                        } catch (error) {
                            console.error(`[SupabaseEventBus] Error al ejecutar UNLISTEN en canal ${channel}:`, error);
                        }
                    }
                }
            }
        };
    }
    
    /**
     * Manejar notificaciones de PostgreSQL
     * 
     * Parsea el payload JSON y llama a todos los listeners del canal.
     * Valida que el tenant_id del evento coincida con el del canal.
     * 
     * @private
     */
    private handleNotification(msg: { channel?: string; payload?: string }): void {
        // Validar que tenemos canal y payload
        if (!msg.channel || !msg.payload) {
            console.warn('[SupabaseEventBus] Notificación inválida - falta canal o payload');
            return;
        }
        
        const listeners = this.listeners.get(msg.channel as EventChannel);
        if (!listeners) {
            return;
        }
        
        try {
            const event = JSON.parse(msg.payload) as ParkEvent;
            
            // Extraer tenant_id del canal (formato: 'events:{tenant_id}')
            const channelTenantId = msg.channel.replace('events:', '');
            
            // Validar que el tenant_id del evento coincide con el del canal
            if (event.tenant_id !== channelTenantId) {
                console.warn('[SupabaseEventBus] Evento descartado - tenant_id no coincide:', {
                    canal: msg.channel,
                    tenantIdCanal: channelTenantId,
                    tenantIdEvento: event.tenant_id,
                    eventId: event.event_id,
                });
                return;
            }
            
            // Llamar a todos los listeners del canal
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    console.error('[SupabaseEventBus] Error en listener:', {
                        canal: msg.channel,
                        eventId: event.event_id,
                        error,
                    });
                }
            }
        } catch (error) {
            console.error('[SupabaseEventBus] Error al parsear payload:', {
                canal: msg.channel,
                payload: msg.payload,
                error,
            });
        }
    }
    
    /**
     * Emitir evento de reconexión a todos los listeners activos
     * 
     * Propaga un evento especial RECONNECTED para que los clientes
     * puedan actualizar su estado después de una reconexión.
     * 
     * @private
     */
    private emitReconnectedEvent(): void {
        const reconnectedEvent = {
            type: 'RECONNECTED',
            timestamp: new Date().toISOString(),
            reconnectAttempts: this.reconnectAttempts,
            activeChannels: Array.from(this.listeners.keys()),
        };
        
        console.log('[SupabaseEventBus] Emitiendo evento RECONNECTED:', reconnectedEvent);
        
        // Propagar a todos los listeners activos
        for (const [channel, listeners] of this.listeners.entries()) {
            for (const listener of listeners) {
                try {
                    // Nota: Este evento no es un ParkEvent válido, pero permite
                    // que los clientes detecten reconexiones
                    listener(reconnectedEvent as any);
                } catch (error) {
                    console.error('[SupabaseEventBus] Error al emitir RECONNECTED:', {
                        canal: channel,
                        error,
                    });
                }
            }
        }
    }
    
    /**
     * Programar reconexión con exponential backoff
     * 
     * Calcula el delay usando exponential backoff: 1s, 2s, 4s, 8s, 16s, hasta max 30s.
     * Programa un timer para intentar reconectar después del delay.
     * 
     * @private
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return;
        }
        
        const delay = Math.min(
            1000 * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        
        this.reconnectAttempts++;
        
        console.log(`[SupabaseEventBus] Reconectando en ${delay}ms (intento ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }
    
    /**
     * Desconectar y limpiar recursos
     * 
     * Cancela timers de reconexión, libera el cliente de PostgreSQL
     * y limpia todos los listeners.
     */
    async disconnect(): Promise<void> {
        // Cancelar timer de reconexión
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Liberar cliente
        if (this.client) {
            this.client.release();
            this.client = null;
        }
        
        // Cerrar pool
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
        
        // Limpiar listeners
        this.listeners.clear();
        
        console.log('[SupabaseEventBus] Desconectado y recursos liberados');
    }
}
