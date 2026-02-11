# Design Document: Realtime EventBus con Supabase

## Overview

Este diseño especifica la migración del EventBus in-memory actual a una implementación basada en Supabase Realtime que utiliza PostgreSQL LISTEN/NOTIFY como mecanismo de pub/sub. Esta migración resuelve el problema arquitectónico crítico donde eventos publicados en una instancia de Next.js no llegan a clientes SSE conectados a otra instancia.

### Problema Actual

El EventBus actual usa `EventEmitter` de Node.js, que solo funciona dentro del mismo proceso. En Next.js development mode (y potencialmente en producción con múltiples instancias), cada request HTTP puede ser manejado por una instancia diferente del servidor:

```
Mesero → POST /api/events/ingest → Next.js Instancia A
                                    ↓
                            eventBus.publish() ✅
                                    ↓
                            EventBus In-Memory A
                                    ↓
                            emit('event:tenant_id') ❌ NADIE ESCUCHA

KDS → GET /api/events/stream → Next.js Instancia B ❌ DIFERENTE
                                ↓
                        eventBus.subscribe() 
                                ↓
                        EventBus In-Memory B ❌ DIFERENTE
                                ↓
                        Esperando... ❌ NUNCA RECIBE NADA
```

### Solución Propuesta

Usar PostgreSQL LISTEN/NOTIFY a través de Supabase como intermediario compartido:

```
Mesero → POST /api/events/ingest → Next.js Instancia A
                                    ↓
                            supabaseEventBus.publish()
                                    ↓
                            PostgreSQL NOTIFY 'events:tenant_id'
                                    ↓
                            Supabase PostgreSQL (COMPARTIDO)
                                    ↓
                            PostgreSQL LISTEN 'events:tenant_id'
                                    ↓
                            Next.js Instancia B ✅
                                    ↓
                            SSE Stream → KDS ✅ RECIBE EVENTO
```

### Beneficios

- ✅ Funciona en TODOS los entornos (dev, staging, prod)
- ✅ Escala horizontalmente (múltiples servidores)
- ✅ Usa infraestructura existente (Supabase PostgreSQL)
- ✅ Costo $0 (incluido en Supabase)
- ✅ Mantiene compatibilidad con interfaz existente
- ✅ Soporta tenant isolation nativo

## Architecture

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  /api/events/ingest  │  /api/events/stream  │  SyncClient   │
└──────────┬───────────┴──────────┬────────────┴──────┬────────┘
           │                      │                    │
           │ publish()            │ subscribe()        │
           ▼                      ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    SupabaseEventBus                          │
│  - publish(tenantId, event)                                  │
│  - subscribe(tenantId, listener)                             │
│  - reconnect logic                                           │
│  - error handling                                            │
└──────────┬──────────────────────────────────────────────────┘
           │
           │ PostgreSQL NOTIFY/LISTEN
           ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL Database                    │
│  - NOTIFY 'events:{tenant_id}', payload                      │
│  - LISTEN 'events:{tenant_id}'                               │
│  - Channel isolation per tenant                              │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Publicación

1. **Ingest API** recibe evento del terminal
2. **Validación** y guardado en PostgreSQL (transacción)
3. **Outbox Pattern** guarda evento en `event_outbox`
4. **SupabaseEventBus.publish()** ejecuta `NOTIFY 'events:{tenant_id}', payload`
5. **PostgreSQL** distribuye notificación a TODOS los listeners del canal
6. **Todas las instancias** reciben la notificación vía LISTEN

### Flujo de Suscripción

1. **SSE Client** se conecta a `/api/events/stream?tenant_id=X`
2. **Stream Route** llama a `supabaseEventBus.subscribe(tenantId, listener)`
3. **SupabaseEventBus** ejecuta `LISTEN 'events:{tenant_id}'`
4. **PostgreSQL** envía notificaciones al listener cuando hay eventos
5. **Listener** deserializa el evento y lo envía al cliente SSE
6. **Cliente** actualiza UI en tiempo real

### Tenant Isolation

Cada tenant tiene su propio canal de PostgreSQL:

```sql
-- Tenant A
NOTIFY 'events:00000000-0000-0000-0000-000000000001', '{"event_type":"ORDER_CREATED",...}'

-- Tenant B
NOTIFY 'events:11111111-1111-1111-1111-111111111111', '{"event_type":"PAYMENT_ADDED",...}'
```

Los listeners solo reciben eventos de su canal específico, garantizando aislamiento completo.

## Components and Interfaces

### SupabaseEventBus

Implementación principal del EventBus usando PostgreSQL LISTEN/NOTIFY:

```typescript
/**
 * EventBus basado en Supabase Realtime (PostgreSQL LISTEN/NOTIFY)
 * 
 * Reemplaza el EventBus in-memory para soportar múltiples instancias
 * de Next.js compartiendo eventos en tiempo real.
 */
export class SupabaseEventBus {
    private client: PoolClient | null = null;
    private listeners: Map<string, Set<EventListener>> = new Map();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private reconnectAttempts: number = 0;
    private maxReconnectDelay: number = 30000; // 30 segundos
    
    constructor(private connectionString: string) {}
    
    /**
     * Conectar al PostgreSQL y preparar para LISTEN/NOTIFY
     */
    async connect(): Promise<void> {
        try {
            const pool = new Pool({ connectionString: this.connectionString });
            this.client = await pool.connect();
            
            // Configurar handler para notificaciones
            this.client.on('notification', this.handleNotification.bind(this));
            
            // Re-suscribir a todos los canales activos
            for (const channel of this.listeners.keys()) {
                await this.client.query(`LISTEN "${channel}"`);
            }
            
            this.reconnectAttempts = 0;
            console.log('[SupabaseEventBus] Conectado exitosamente');
        } catch (error) {
            console.error('[SupabaseEventBus] Error al conectar:', error);
            this.scheduleReconnect();
        }
    }
    
    /**
     * Publicar evento a un canal específico de tenant
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param event - Evento a publicar
     */
    async publish(tenantId: string, event: ParkEvent): Promise<void> {
        if (!this.client) {
            throw new Error('EventBus no conectado');
        }
        
        const channel = `events:${tenantId}`;
        const payload = JSON.stringify(event);
        
        try {
            await this.client.query('SELECT pg_notify($1, $2)', [channel, payload]);
        } catch (error) {
            console.error('[SupabaseEventBus] Error al publicar:', error);
            throw error;
        }
    }
    
    /**
     * Suscribirse a eventos de un tenant específico
     * 
     * @param tenantId - ID del tenant (UUID)
     * @param listener - Función callback para eventos
     * @returns Función de cleanup para cancelar suscripción
     */
    async subscribe(
        tenantId: string,
        listener: (event: ParkEvent) => void
    ): Promise<() => void> {
        const channel = `events:${tenantId}`;
        
        // Agregar listener al mapa
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set());
            
            // Ejecutar LISTEN si estamos conectados
            if (this.client) {
                await this.client.query(`LISTEN "${channel}"`);
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
                        await this.client.query(`UNLISTEN "${channel}"`);
                    }
                }
            }
        };
    }
    
    /**
     * Manejar notificaciones de PostgreSQL
     */
    private handleNotification(msg: { channel: string; payload: string }): void {
        const listeners = this.listeners.get(msg.channel);
        if (!listeners) return;
        
        try {
            const event = JSON.parse(msg.payload) as ParkEvent;
            
            // Llamar a todos los listeners del canal
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    console.error('[SupabaseEventBus] Error en listener:', error);
                }
            }
        } catch (error) {
            console.error('[SupabaseEventBus] Error al parsear payload:', error);
        }
    }
    
    /**
     * Programar reconexión con exponential backoff
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        
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
     */
    async disconnect(): Promise<void> {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.client) {
            this.client.release();
            this.client = null;
        }
        
        this.listeners.clear();
    }
}
```

### EventBus Factory

Factory para crear la implementación correcta según configuración:

```typescript
/**
 * Factory para crear EventBus según configuración
 * 
 * - Si DATABASE_URL está configurado → SupabaseEventBus
 * - Si no → InMemoryEventBus (fallback)
 */
export function createEventBus(): EventBus {
    const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
    
    if (databaseUrl) {
        console.log('[EventBus] Usando SupabaseEventBus (PostgreSQL LISTEN/NOTIFY)');
        const bus = new SupabaseEventBus(databaseUrl);
        bus.connect().catch(err => {
            console.error('[EventBus] Error inicial de conexión:', err);
        });
        return bus;
    } else {
        console.warn('[EventBus] DATABASE_URL no configurado, usando InMemoryEventBus (fallback)');
        console.warn('[EventBus] ADVERTENCIA: Eventos NO se compartirán entre instancias');
        return new InMemoryEventBus();
    }
}

// Singleton global
const globalForBus = global as unknown as { parkEventBus: EventBus };

export const eventBus = globalForBus.parkEventBus || createEventBus();

if (process.env.NODE_ENV !== "production") {
    globalForBus.parkEventBus = eventBus;
}
```

### EventBus Interface

Interfaz común para ambas implementaciones:

```typescript
/**
 * Interfaz común para EventBus
 * 
 * Permite intercambiar implementaciones sin cambiar código cliente
 */
export interface EventBus {
    /**
     * Publicar evento a un tenant específico
     */
    publish(tenantId: string, event: ParkEvent): Promise<void> | void;
    
    /**
     * Suscribirse a eventos de un tenant específico
     * 
     * @returns Función de cleanup para cancelar suscripción
     */
    subscribe(
        tenantId: string,
        listener: (event: ParkEvent) => void
    ): Promise<() => void> | (() => void);
}
```

## Data Models

### PostgreSQL Notification

Estructura de las notificaciones de PostgreSQL:

```typescript
/**
 * Notificación de PostgreSQL LISTEN/NOTIFY
 */
interface PostgresNotification {
    /** Canal de la notificación (ej: 'events:tenant_id') */
    channel: string;
    
    /** Payload JSON serializado */
    payload: string;
    
    /** PID del proceso que envió la notificación */
    processId?: number;
}
```

### Event Channel

Formato del canal de eventos:

```typescript
/**
 * Canal de eventos por tenant
 * 
 * Formato: 'events:{tenant_id}'
 * Ejemplo: 'events:00000000-0000-0000-0000-000000000001'
 */
type EventChannel = `events:${string}`;
```

### Listener Map

Estructura interna para gestionar listeners:

```typescript
/**
 * Mapa de listeners por canal
 * 
 * Key: Canal (ej: 'events:tenant_id')
 * Value: Set de funciones listener
 */
type ListenerMap = Map<EventChannel, Set<EventListener>>;

type EventListener = (event: ParkEvent) => void;
```

### Connection State

Estado de la conexión con PostgreSQL:

```typescript
/**
 * Estado de conexión del EventBus
 */
interface ConnectionState {
    /** Cliente de PostgreSQL activo */
    client: PoolClient | null;
    
    /** Número de intentos de reconexión */
    reconnectAttempts: number;
    
    /** Timer de reconexión activo */
    reconnectTimer: NodeJS.Timeout | null;
    
    /** Timestamp de última conexión exitosa */
    lastConnectedAt: Date | null;
    
    /** Timestamp de último error */
    lastErrorAt: Date | null;
}
```

## Correctness Properties

### Introducción a Correctness Properties

Una property es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las properties sirven como puente entre especificaciones legibles por humanos y garantías de correctitud verificables por máquinas.

### Property 1: Serialización Round-Trip

*Para cualquier* evento ParkEvent válido, serializar a JSON y luego deserializar debe producir un objeto equivalente al original.

**Validates: Requirements 2.4, 2.5**

### Property 2: Aislamiento de Canal por Tenant

*Para cualquier* tenant_id, el canal de PostgreSQL debe seguir el formato `events:{tenant_id}` y solo debe recibir eventos de ese tenant específico.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Validación de Tenant en Eventos Recibidos

*Para cualquier* evento recibido del canal, si el tenant_id del evento NO coincide con el tenant_id del canal, el evento debe ser descartado y se debe registrar una advertencia.

**Validates: Requirements 3.4, 3.5**

### Property 4: Cleanup de Suscripción

*Para cualquier* suscripción creada con subscribe(), al llamar la función de cleanup retornada, la suscripción debe cancelarse y no debe recibir más eventos.

**Validates: Requirements 2.3**

### Property 5: Propagación de Eventos a Clientes SSE

*Para cualquier* evento recibido del canal de Supabase, el evento debe ser enviado a todos los clientes SSE suscritos al mismo tenant en formato JSON.

**Validates: Requirements 4.3**

### Property 6: Cancelación de Suscripción en Desconexión SSE

*Para cualquier* cliente SSE que se desconecta, la suscripción de Supabase Realtime correspondiente debe ser cancelada automáticamente.

**Validates: Requirements 4.4**

### Property 7: Orden de Outbox Pattern

*Para cualquier* evento aceptado en /api/events/ingest, el evento debe guardarse en la tabla event_outbox ANTES de intentar publicarlo vía Supabase Realtime.

**Validates: Requirements 5.1**

### Property 8: Marcado de Eventos Publicados

*Para cualquier* evento publicado exitosamente vía Supabase Realtime, el evento debe marcarse como published=true en la tabla event_outbox.

**Validates: Requirements 5.2**

### Property 9: Persistencia en Fallo de Publicación

*Para cualquier* evento cuya publicación falla, el evento debe permanecer en event_outbox con published=false para que el worker lo reintente.

**Validates: Requirements 5.3**

### Property 10: Resiliencia ante Fallo de Supabase

*Para cualquier* evento enviado a /api/events/ingest, el sistema debe aceptar y guardar el evento en PostgreSQL incluso si Supabase Realtime está temporalmente no disponible.

**Validates: Requirements 5.4**

### Property 11: No Fallo de Transacción por Error de Publicación

*Para cualquier* error al publicar un evento vía Supabase Realtime, el error debe registrarse en logs pero NO debe causar que la transacción de ingest falle.

**Validates: Requirements 5.5**

### Property 12: Reconexión Automática

*Para cualquier* fallo de conexión con Supabase Realtime, el sistema debe intentar reconectar automáticamente sin intervención manual.

**Validates: Requirements 7.1**

### Property 13: Exponential Backoff en Reintentos

*Para cualquier* secuencia de reintentos de conexión, los delays deben seguir exponential backoff: 1s, 2s, 4s, 8s, 16s, hasta un máximo de 30s.

**Validates: Requirements 7.2**

### Property 14: Logging de Errores de Conexión

*Para cualquier* error de conexión con Supabase Realtime, el error debe registrarse en logs estructurados con nivel ERROR.

**Validates: Requirements 7.3**

### Property 15: Re-suscripción en Reconexión

*Para cualquier* reconexión exitosa, el sistema debe re-suscribirse automáticamente a todos los canales que estaban activos antes de la desconexión.

**Validates: Requirements 7.4**

### Property 16: Evento de Reconexión

*Para cualquier* reconexión exitosa, el sistema debe emitir un evento especial de tipo RECONNECTED para que los clientes puedan actualizar su estado.

**Validates: Requirements 7.5**

### Property 17: Latencia de Propagación

*Para cualquier* evento publicado, el evento debe propagarse a todos los suscriptores en menos de 500ms en el percentil 95.

**Validates: Requirements 8.1**

### Property 18: Throughput por Tenant

*Para cualquier* tenant, el sistema debe soportar al menos 100 eventos por segundo sin degradación de performance.

**Validates: Requirements 8.2**

### Property 19: Conexiones SSE Concurrentes

*Para cualquier* tenant, el sistema debe soportar al menos 50 conexiones SSE concurrentes sin degradación de performance.

**Validates: Requirements 8.3**

### Property 20: Fallback a In-Memory

*Para cualquier* configuración donde DATABASE_URL NO está definido, el sistema debe usar automáticamente el EventBus in-memory como fallback.

**Validates: Requirements 9.1**

### Property 21: Advertencia de Fallback

*Para cualquier* inicialización que use el EventBus in-memory como fallback, el sistema debe registrar una advertencia indicando que los eventos NO se compartirán entre instancias.

**Validates: Requirements 9.3**

### Property 22: Funcionalidad Single-Instance con Fallback

*Para cualquier* operación con el EventBus in-memory activo, el sistema debe funcionar correctamente en modo single-instance (una sola instancia de Next.js).

**Validates: Requirements 9.4**

## Error Handling

### Errores de Conexión

**Escenario:** Fallo al conectar con PostgreSQL

**Manejo:**
1. Registrar error con nivel ERROR en logs estructurados
2. Programar reintento con exponential backoff
3. Continuar aceptando eventos (guardar en outbox)
4. NO fallar el inicio de la aplicación

**Código:**

```typescript
async connect(): Promise<void> {
    try {
        const pool = new Pool({ connectionString: this.connectionString });
        this.client = await pool.connect();
        
        this.client.on('notification', this.handleNotification.bind(this));
        
        for (const channel of this.listeners.keys()) {
            await this.client.query(`LISTEN "${channel}"`);
        }
        
        this.reconnectAttempts = 0;
        console.log('[SupabaseEventBus] Conectado exitosamente');
    } catch (error) {
        console.error('[SupabaseEventBus] Error al conectar:', error);
        this.scheduleReconnect(); // Reintento automático
    }
}
```

### Errores de Publicación

**Escenario:** Fallo al ejecutar pg_notify

**Manejo:**
1. Registrar error con contexto (tenant_id, event_id)
2. Lanzar excepción para que el caller maneje
3. El evento permanece en outbox para reintento
4. NO fallar la transacción de ingest

### Errores de Deserialización

**Escenario:** Payload JSON inválido en notificación

**Manejo:**
1. Registrar error con payload recibido
2. Descartar el evento (no llamar listeners)
3. Continuar procesando otros eventos
4. NO crashear el proceso

### Validación de Tenant Cross-Contamination

**Escenario:** Evento recibido con tenant_id diferente al canal

**Manejo:**
1. Registrar advertencia con ambos tenant_ids
2. Descartar el evento (no llamar listeners)
3. Incrementar métrica de eventos descartados
4. Continuar procesando otros eventos

## Testing Strategy

### Enfoque Dual: Unit Tests + Property Tests

El sistema requiere AMBOS tipos de tests para cobertura completa:

**Unit Tests:**
- Ejemplos específicos de conexión/desconexión
- Casos edge de inicialización
- Validación de formato de canal
- Integración con endpoints SSE

**Property Tests:**
- Serialización round-trip para todos los eventos
- Aislamiento de tenant para cualquier combinación
- Reconexión automática bajo cualquier fallo
- Performance bajo carga variable

### Configuración de Property Tests

Todos los property tests deben ejecutarse con mínimo 100 iteraciones y deben incluir tags que referencien las properties del diseño.

