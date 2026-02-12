# Design Document: Event Sourcing Critical Fixes

## Overview

Este documento especifica el diseño técnico para corregir problemas críticos en el sistema de Event Sourcing de PARK POS. Los problemas identificados a través de tests E2E de Playwright están bloqueando el despliegue a producción y representan riesgos financieros y de integridad de datos.

### Problemas Críticos Identificados

1. **Event Deduplication NO Funciona** (2 tests fallando)
   - La tabla `processed_events` no está bloqueando duplicados correctamente
   - Race conditions en la verificación de duplicados
   - Riesgo: Cobros dobles, inventario incorrecto, inconsistencias financieras

2. **Multi-Terminal Concurrency NO Funciona** (5 tests fallando)
   - 15 meseros + 1 cajero no pueden trabajar simultáneamente
   - Race conditions en asignación de order numbers
   - Conflictos en actualización de órdenes
   - Riesgo: Pérdida de datos, órdenes duplicadas

3. **Rate Limiting NO Funciona** (2 tests fallando)
   - Burst handling no implementado correctamente
   - Sistema vulnerable a ataques DoS
   - Riesgo: Caídas del sistema bajo carga alta

### Objetivos del Diseño

1. Implementar deduplicación idempotente usando `processed_events` con constraints de base de datos
2. Implementar concurrencia segura usando optimistic locking y rangos de números por terminal
3. Implementar rate limiting con sliding window algorithm y burst handling
4. Implementar manejo de eventos fuera de orden con cola temporal
5. Mejorar retry logic con exponential backoff y circuit breaker
6. Agregar validación exhaustiva de eventos antes de procesamiento
7. Implementar logging y observabilidad completa

## Architecture

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     SyncClient (Frontend)                    │
│  - Retry Logic con Exponential Backoff                      │
│  - Circuit Breaker (5 fallos → OPEN)                        │
│  - Jitter (20%) para evitar thundering herd                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP POST /api/events/ingest
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Rate Limiter Middleware (Redis)                 │
│  - Sliding Window Algorithm                                  │
│  - 100 req/s por tenant_id                                   │
│  - Burst: 200 req en 1s                                      │
│  - HTTP 429 + Retry-After header                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            Ingest Endpoint (/api/events/ingest)              │
│  1. Validación de Schema (Zod)                               │
│  2. Validación de UUIDs                                      │
│  3. Validación de Reglas de Negocio                          │
│  4. Transacción de Base de Datos                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Transaction                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Check processed_events (event_id PK)              │  │
│  │    - IF exists → return success (idempotent)         │  │
│  │    - ELSE → continue                                  │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 2. Insert into processed_events                      │  │
│  │    - UNIQUE constraint on event_id                    │  │
│  │    - Catch P2002 error → return success              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 3. Conflict Detection (optimistic locking)           │  │
│  │    - Check orders.revision                            │  │
│  │    - IF mismatch → resolve conflict                   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 4. Insert into events table                          │  │
│  │    - Catch P2002 error → skip (duplicate)            │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 5. Apply Projections (projectEvent)                  │  │
│  │    - Update orders, invoices, shifts, etc.           │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 6. Increment orders.revision                         │  │
│  │    - Optimistic lock for next event                   │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ 7. Insert into event_outbox                          │  │
│  │    - For SSE publication                              │  │
│  └───────────────────────────────────────────────────────┘  │
│  Isolation Level: SERIALIZABLE                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Event Bus (SSE Publication)                     │
│  - Publish to Supabase Realtime                              │
│  - Fallback: Outbox worker reintenta                         │
└─────────────────────────────────────────────────────────────┘
```


### Flujo de Procesamiento de Eventos

```
Terminal → SyncClient → Rate Limiter → Ingest Endpoint
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ Validation      │
                                    │ - Schema (Zod)  │
                                    │ - UUIDs         │
                                    │ - Business Rules│
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ Deduplication   │
                                    │ Check           │
                                    └────────┬────────┘
                                             │
                                    ┌────────┴────────┐
                                    │                 │
                              Already          Not Processed
                              Processed              │
                                    │                 ▼
                                    │        ┌─────────────────┐
                                    │        │ Mark as         │
                                    │        │ Processed       │
                                    │        └────────┬────────┘
                                    │                 │
                                    │                 ▼
                                    │        ┌─────────────────┐
                                    │        │ Conflict        │
                                    │        │ Detection       │
                                    │        └────────┬────────┘
                                    │                 │
                                    │        ┌────────┴────────┐
                                    │        │                 │
                                    │   No Conflict      Conflict
                                    │        │                 │
                                    │        │                 ▼
                                    │        │        ┌─────────────────┐
                                    │        │        │ Resolve         │
                                    │        │        │ (MERGE/LWW/     │
                                    │        │        │  REJECT)        │
                                    │        │        └────────┬────────┘
                                    │        │                 │
                                    │        ▼                 ▼
                                    │   ┌─────────────────────────┐
                                    │   │ Apply Projections       │
                                    │   └──────────┬──────────────┘
                                    │              │
                                    │              ▼
                                    │   ┌─────────────────────────┐
                                    │   │ Increment Revision      │
                                    │   └──────────┬──────────────┘
                                    │              │
                                    │              ▼
                                    │   ┌─────────────────────────┐
                                    │   │ Insert into Outbox      │
                                    │   └──────────┬──────────────┘
                                    │              │
                                    └──────────────┴──────────────┐
                                                                   │
                                                                   ▼
                                                          ┌─────────────────┐
                                                          │ Return Success  │
                                                          │ Response        │
                                                          └─────────────────┘
```

## Components and Interfaces

### 1. Deduplication Service

**Responsabilidad:** Detectar y rechazar eventos duplicados de manera idempotente.

**Interfaz:**
```typescript
interface DeduplicationService {
  /**
   * Verifica si un evento ya fue procesado.
   * Retorna true si el evento es duplicado.
   */
  isDuplicate(tx: PrismaTransaction, eventId: string): Promise<boolean>;
  
  /**
   * Marca un evento como procesado.
   * Usa INSERT con manejo de constraint violation para idempotencia.
   */
  markAsProcessed(
    tx: PrismaTransaction,
    event: ParkEvent
  ): Promise<{ isDuplicate: boolean }>;
}
```

**Implementación:**
```typescript
// src/core/deduplication/deduplication.service.ts

export async function markAsProcessed(
  tx: PrismaTransaction,
  event: ParkEvent
): Promise<{ isDuplicate: boolean }> {
  try {
    // Intentar insertar en processed_events
    await tx.processed_events.create({
      data: {
        event_id: event.event_id,
        tenant_id: event.tenant_id,
        aggregate_id: event.aggregate_id,
        event_type: event.event_type,
        processor: 'ingest-api',
      }
    });
    
    return { isDuplicate: false };
  } catch (e: unknown) {
    // P2002 = Unique constraint violation
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
      logger.info('deduplication.duplicate_detected', 
        `Event ${event.event_id} already processed`, 
        { event_id: event.event_id }
      );
      return { isDuplicate: true };
    }
    throw e;
  }
}
```

**Schema de Base de Datos:**
```sql
-- Tabla processed_events con constraint único
CREATE TABLE processed_events (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aggregate_id UUID,
  event_type TEXT,
  processor TEXT
);

-- Índice para limpieza periódica
CREATE INDEX idx_processed_cleanup 
ON processed_events(tenant_id, processed_at);
```


### 2. Rate Limiter Service

**Responsabilidad:** Limitar la cantidad de requests por tenant usando sliding window algorithm.

**Interfaz:**
```typescript
interface RateLimiterService {
  /**
   * Verifica si un tenant ha excedido el rate limit.
   * Retorna { allowed: boolean, retryAfter?: number }
   */
  checkLimit(tenantId: string): Promise<RateLimitResult>;
  
  /**
   * Incrementa el contador de requests para un tenant.
   */
  incrementCounter(tenantId: string): Promise<void>;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // Segundos hasta que se puede reintentar
  currentCount: number;
  limit: number;
}
```

**Implementación (Redis Sliding Window):**
```typescript
// src/core/rate-limit/rate-limiter.service.ts

const RATE_LIMIT = 100; // requests por segundo
const BURST_LIMIT = 200; // burst máximo en 1 segundo
const WINDOW_SIZE = 1000; // 1 segundo en ms

export async function checkLimit(
  redis: Redis,
  tenantId: string
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - WINDOW_SIZE;
  const key = `rate_limit:${tenantId}`;
  
  // Usar sorted set con timestamps como scores
  const pipeline = redis.pipeline();
  
  // 1. Remover requests antiguos fuera de la ventana
  pipeline.zremrangebyscore(key, 0, windowStart);
  
  // 2. Contar requests en la ventana actual
  pipeline.zcard(key);
  
  // 3. Agregar el request actual
  pipeline.zadd(key, now, `${now}:${Math.random()}`);
  
  // 4. Expirar la key después de 2 segundos
  pipeline.expire(key, 2);
  
  const results = await pipeline.exec();
  const count = results[1][1] as number;
  
  // Verificar límites
  if (count >= BURST_LIMIT) {
    return {
      allowed: false,
      retryAfter: 1,
      currentCount: count,
      limit: BURST_LIMIT,
    };
  }
  
  if (count >= RATE_LIMIT) {
    return {
      allowed: false,
      retryAfter: 1,
      currentCount: count,
      limit: RATE_LIMIT,
    };
  }
  
  return {
    allowed: true,
    currentCount: count,
    limit: RATE_LIMIT,
  };
}
```

**Middleware de Express:**
```typescript
// src/middleware/rate-limit.middleware.ts

export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const tenantId = req.body.tenant_id;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'tenant_id required' });
  }
  
  const result = await checkLimit(redis, tenantId);
  
  if (!result.allowed) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      retryAfter: result.retryAfter,
      currentCount: result.currentCount,
      limit: result.limit,
    }).header('Retry-After', String(result.retryAfter));
  }
  
  next();
}
```

### 3. Order Number Range Service

**Responsabilidad:** Asignar rangos de order numbers a terminales sin colisiones.

**Interfaz:**
```typescript
interface OrderNumberRangeService {
  /**
   * Asigna un nuevo rango de números a un terminal.
   * Usa SELECT FOR UPDATE para evitar colisiones.
   */
  assignRange(
    tx: PrismaTransaction,
    tenantId: string,
    terminalId: string,
    rangeSize: number
  ): Promise<{ start: number; end: number }>;
  
  /**
   * Valida que un order_number esté dentro del rango asignado.
   */
  validateOrderNumber(
    tenantId: string,
    terminalId: string,
    orderNumber: number
  ): Promise<boolean>;
}
```

**Implementación:**
```typescript
// src/core/order-numbers/range.service.ts

export async function assignRange(
  tx: PrismaTransaction,
  tenantId: string,
  terminalId: string,
  rangeSize: number = 100
): Promise<{ start: number; end: number }> {
  // Usar SELECT FOR UPDATE para lock pesimista
  const range = await tx.$queryRaw<Array<{ last_assigned: number }>>`
    SELECT last_assigned
    FROM terminal_number_ranges
    WHERE tenant_id = ${tenantId} AND terminal_id = ${terminalId}
    FOR UPDATE
  `;
  
  let lastAssigned = 0;
  if (range.length > 0) {
    lastAssigned = range[0].last_assigned;
  }
  
  const start = lastAssigned + 1;
  const end = lastAssigned + rangeSize;
  
  // Actualizar el último número asignado
  await tx.terminal_number_ranges.upsert({
    where: {
      tenant_id_terminal_id: {
        tenant_id: tenantId,
        terminal_id: terminalId,
      }
    },
    create: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      last_assigned: end,
    },
    update: {
      last_assigned: end,
    }
  });
  
  return { start, end };
}
```

**Schema de Base de Datos:**
```sql
CREATE TABLE terminal_number_ranges (
  tenant_id UUID NOT NULL,
  terminal_id TEXT NOT NULL,
  last_assigned INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, terminal_id)
);
```


### 4. Out-of-Order Event Queue

**Responsabilidad:** Encolar eventos que llegan fuera de orden hasta que sus dependencias sean procesadas.

**Interfaz:**
```typescript
interface OutOfOrderQueue {
  /**
   * Encola un evento que llegó fuera de orden.
   */
  enqueue(event: ParkEvent, reason: string): Promise<void>;
  
  /**
   * Obtiene eventos encolados para un aggregate.
   */
  getQueuedEvents(aggregateId: string): Promise<ParkEvent[]>;
  
  /**
   * Procesa eventos encolados después de que su dependencia sea satisfecha.
   */
  processQueuedEvents(
    tx: PrismaTransaction,
    aggregateId: string
  ): Promise<number>;
  
  /**
   * Limpia eventos expirados (>60 segundos).
   */
  cleanupExpired(): Promise<number>;
}
```

**Implementación (In-Memory con TTL):**
```typescript
// src/core/events/out-of-order-queue.ts

interface QueuedEvent {
  event: ParkEvent;
  enqueuedAt: Date;
  reason: string;
}

class OutOfOrderQueue {
  private queue: Map<string, QueuedEvent[]> = new Map();
  private readonly TTL_MS = 60000; // 60 segundos
  
  async enqueue(event: ParkEvent, reason: string): Promise<void> {
    const key = event.aggregate_id;
    const queued: QueuedEvent = {
      event,
      enqueuedAt: new Date(),
      reason,
    };
    
    if (!this.queue.has(key)) {
      this.queue.set(key, []);
    }
    
    this.queue.get(key)!.push(queued);
    
    logger.warn('events.queued', 
      `Event ${event.event_id} queued for ${key}`, 
      { 
        event_id: event.event_id,
        aggregate_id: key,
        reason 
      }
    );
    
    // Emitir alerta si hay más de 10 eventos encolados
    if (this.queue.get(key)!.length > 10) {
      logger.error('events.queue_overflow',
        `More than 10 events queued for ${key}`,
        undefined,
        { aggregate_id: key, count: this.queue.get(key)!.length }
      );
    }
  }
  
  async getQueuedEvents(aggregateId: string): Promise<ParkEvent[]> {
    const queued = this.queue.get(aggregateId) || [];
    
    // Filtrar eventos expirados
    const now = Date.now();
    const valid = queued.filter(q => 
      now - q.enqueuedAt.getTime() < this.TTL_MS
    );
    
    // Ordenar por terminal_sequence
    return valid
      .map(q => q.event)
      .sort((a, b) => a.terminal_sequence - b.terminal_sequence);
  }
  
  async processQueuedEvents(
    tx: PrismaTransaction,
    aggregateId: string
  ): Promise<number> {
    const events = await this.getQueuedEvents(aggregateId);
    
    if (events.length === 0) {
      return 0;
    }
    
    let processed = 0;
    for (const event of events) {
      try {
        // Procesar el evento (sin deduplication check, ya está encolado)
        await projectEvent(tx, event);
        processed++;
      } catch (e) {
        logger.error('events.queued_processing_failed',
          `Failed to process queued event ${event.event_id}`,
          e instanceof Error ? e : new Error(String(e))
        );
      }
    }
    
    // Limpiar eventos procesados
    this.queue.delete(aggregateId);
    
    return processed;
  }
  
  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    let expired = 0;
    
    for (const [key, queued] of this.queue.entries()) {
      const valid = queued.filter(q => {
        const isExpired = now - q.enqueuedAt.getTime() >= this.TTL_MS;
        if (isExpired) {
          expired++;
          // Mover a dead letter queue
          this.moveToDeadLetterQueue(q.event, 'TIMEOUT');
        }
        return !isExpired;
      });
      
      if (valid.length === 0) {
        this.queue.delete(key);
      } else {
        this.queue.set(key, valid);
      }
    }
    
    return expired;
  }
  
  private async moveToDeadLetterQueue(
    event: ParkEvent,
    reason: string
  ): Promise<void> {
    try {
      await prisma.dead_letter_queue.create({
        data: {
          id: uuidv4(),
          tenant_id: event.tenant_id,
          event_id: event.event_id,
          event_type: event.event_type,
          aggregate_id: event.aggregate_id,
          payload: event as any,
          reason,
          failed_at: new Date(),
        }
      });
      
      logger.warn('events.moved_to_dlq',
        `Event ${event.event_id} moved to DLQ`,
        { event_id: event.event_id, reason }
      );
    } catch (e) {
      logger.error('events.dlq_insert_failed',
        `Failed to insert into DLQ`,
        e instanceof Error ? e : new Error(String(e))
      );
    }
  }
}

export const outOfOrderQueue = new OutOfOrderQueue();

// Cleanup job (ejecutar cada 30 segundos)
setInterval(() => {
  outOfOrderQueue.cleanupExpired().catch(e => {
    logger.error('events.cleanup_failed', 'Failed to cleanup expired events', e);
  });
}, 30000);
```

**Schema de Dead Letter Queue:**
```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL,
  reason TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_dlq_tenant_failed 
ON dead_letter_queue(tenant_id, failed_at DESC);
```


## Data Models

### Processed Events Table

```typescript
model processed_events {
  event_id     String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  processed_at DateTime @default(now()) @db.Timestamptz(6)
  aggregate_id String?  @db.Uuid
  event_type   String?
  processor    String?

  @@index([tenant_id, processed_at], map: "idx_processed_cleanup")
}
```

**Propósito:** Registrar eventos ya procesados para deduplicación idempotente.

**Constraints:**
- `event_id` es PRIMARY KEY (garantiza unicidad)
- Índice en `(tenant_id, processed_at)` para limpieza periódica

### Terminal Number Ranges Table

```typescript
model terminal_number_ranges {
  tenant_id     String   @db.Uuid
  terminal_id   String
  last_assigned Int      @default(0)
  updated_at    DateTime @default(now()) @db.Timestamptz(6)

  @@id([tenant_id, terminal_id])
}
```

**Propósito:** Asignar rangos de order numbers a terminales sin colisiones.

**Uso:**
- Cada terminal obtiene un rango de 100 números
- `SELECT FOR UPDATE` garantiza asignación atómica
- Cuando se agota el rango, se solicita uno nuevo

### Dead Letter Queue Table

```typescript
model dead_letter_queue {
  id           String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  event_id     String   @db.Uuid
  event_type   String
  aggregate_id String?  @db.Uuid
  payload      Json
  reason       String
  failed_at    DateTime @default(now()) @db.Timestamptz(6)
  retried_at   DateTime? @db.Timestamptz(6)
  retry_count  Int      @default(0)

  @@index([tenant_id, failed_at(sort: Desc)])
}
```

**Propósito:** Almacenar eventos que fallaron procesamiento para análisis y retry manual.

**Razones de Fallo:**
- `TIMEOUT`: Evento encolado por >60 segundos
- `VALIDATION_FAILED`: Evento no pasó validación de negocio
- `DEPENDENCY_MISSING`: Dependencia nunca llegó
- `PROCESSING_ERROR`: Error inesperado durante procesamiento

### Orders Table (Optimistic Locking)

```typescript
model orders {
  id                  String   @id @db.Uuid
  tenant_id           String   @db.Uuid
  order_number        Int
  revision            Int      @default(1)  // ← Optimistic lock
  // ... otros campos
}
```

**Propósito:** El campo `revision` se incrementa con cada evento aplicado para detectar conflictos.

**Flujo de Optimistic Locking:**
1. Cliente lee orden con `revision = 5`
2. Cliente genera evento con `expected_revision = 5`
3. Servidor verifica: `current_revision == expected_revision`
4. Si coincide → aplica evento y hace `revision = 6`
5. Si NO coincide → detecta conflicto y resuelve según estrategia

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema - esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables por máquinas.*

### Property 1: Idempotencia de Deduplicación

*Para cualquier* evento con un event_id específico, si el evento es enviado múltiples veces al sistema, entonces el evento debe ser procesado exactamente una vez y todas las solicitudes deben retornar éxito.

**Validates: Requirements 1.1, 1.4, 1.7**

**Implementación:**
- Usar `processed_events` con constraint UNIQUE en `event_id`
- Primera inserción → éxito, procesamiento continúa
- Inserciones subsecuentes → P2002 error, retornar éxito inmediatamente
- Incluir `event_id` en `deduped_event_ids` array de respuesta

### Property 2: Atomicidad de Verificación y Marcado

*Para cualquier* evento, la verificación de si fue procesado y el marcado como procesado deben ejecutarse dentro de una transacción atómica de base de datos.

**Validates: Requirements 2.1, 2.4**

**Implementación:**
- Usar `prisma.$transaction()` para agrupar operaciones
- Isolation level: SERIALIZABLE o REPEATABLE READ
- Si transacción falla → rollback completo
- No hay estado intermedio visible

### Property 3: Concurrencia Sin Pérdida de Datos

*Para cualquier* conjunto de eventos enviados simultáneamente desde múltiples terminales, todos los eventos válidos deben ser procesados sin pérdida de datos.

**Validates: Requirements 3.1, 3.3**

**Implementación:**
- Usar optimistic locking con campo `revision`
- Detectar conflictos comparando `expected_revision` vs `current_revision`
- Resolver conflictos con estrategias MERGE/LWW/REJECT
- Incrementar `revision` después de cada evento aplicado

### Property 4: Detección de Conflictos de Revisión

*Para cualquier* evento que especifica un `expected_revision`, si el `current_revision` del aggregate no coincide, entonces el sistema debe detectar el conflicto y aplicar la estrategia de resolución apropiada.

**Validates: Requirements 3.4, 3.5**

**Implementación:**
- Leer `orders.revision` antes de aplicar evento
- Comparar con `expected_revision` del evento
- Si no coincide → llamar a `detectAndResolveConflict()`
- Estrategias: MERGE (items), LWW (estados), REJECT (pagos)

### Property 5: Orden de Eventos por Terminal

*Para cualquier* terminal, los eventos deben ser procesados en orden de `terminal_sequence` sin gaps.

**Validates: Requirements 3.6, 5.4**

**Implementación:**
- Validar que `terminal_sequence` sea consecutivo
- Si hay gap → encolar evento en `outOfOrderQueue`
- Cuando llega evento faltante → procesar cola en orden
- Timeout de 60s → mover a dead letter queue

### Property 6: Asignación Única de Order Numbers

*Para cualquier* par de terminales, los order numbers asignados a cada terminal no deben tener colisiones.

**Validates: Requirements 4.2, 4.5, 4.6**

**Implementación:**
- Usar `terminal_number_ranges` con rangos no solapados
- `SELECT FOR UPDATE` para asignación atómica
- Validar que `order_number` esté en rango asignado
- Rechazar eventos con números fuera de rango

### Property 7: Rate Limiting por Tenant

*Para cualquier* tenant_id, el número de requests aceptados en una ventana de 1 segundo no debe exceder 100 requests normales o 200 requests en burst.

**Validates: Requirements 6.2, 6.3, 6.6**

**Implementación:**
- Usar Redis sorted set con timestamps
- Sliding window de 1 segundo
- Contar requests en ventana actual
- Rechazar con HTTP 429 si excede límite

### Property 8: Retry con Exponential Backoff

*Para cualquier* request que falla con error de red, el SyncClient debe reintentar con exponential backoff empezando en 1 segundo y duplicando hasta máximo 60 segundos.

**Validates: Requirements 7.1, 7.2, 7.3**

**Implementación:**
- Backoff inicial: 1s
- Multiplicador: 2x por intento
- Máximo: 60s
- Jitter: ±20% aleatorio
- Circuit breaker: abre después de 10 fallos

### Property 9: Validación de UUIDs

*Para cualquier* evento, todos los campos UUID (event_id, aggregate_id, actor_id) deben ser UUIDs válidos v4.

**Validates: Requirements 8.3**

**Implementación:**
- Usar regex UUID v4: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
- Validar antes de procesamiento
- Rechazar eventos con UUIDs inválidos
- Incluir en array `rejected` con error específico

### Property 10: Logging de Eventos Procesados

*Para cualquier* evento procesado exitosamente, el sistema debe registrar en logs estructurados el tenant_id, event_id, event_type, y processing_time_ms.

**Validates: Requirements 9.1**

**Implementación:**
- Usar logger estructurado (Winston/Pino)
- Incluir contexto completo en cada log
- Nivel INFO para eventos procesados
- Nivel WARN para duplicados y conflictos
- Nivel ERROR para rechazos


## Error Handling

### Estrategia de Manejo de Errores

El sistema implementa una estrategia de manejo de errores en capas:

```
┌─────────────────────────────────────────────────────────────┐
│ Capa 1: Validación Temprana (Fail Fast)                     │
│  - Schema validation (Zod)                                   │
│  - UUID validation                                           │
│  - Tenant validation                                         │
│  → Rechazar inmediatamente con HTTP 400                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Capa 2: Rate Limiting                                        │
│  - Verificar límites por tenant                              │
│  → Rechazar con HTTP 429 + Retry-After                       │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Capa 3: Deduplicación                                        │
│  - Verificar processed_events                                │
│  → Retornar éxito si duplicado (idempotente)                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Capa 4: Validación de Negocio                                │
│  - Verificar reglas de negocio                               │
│  - Verificar dependencias                                    │
│  → Rechazar o encolar si falta dependencia                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Capa 5: Detección de Conflictos                              │
│  - Verificar revision                                        │
│  → Resolver con MERGE/LWW/REJECT                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Capa 6: Errores de Base de Datos                             │
│  - Capturar constraint violations                            │
│  - Capturar deadlocks                                        │
│  → Retry con backoff o rechazar                              │
└─────────────────────────────────────────────────────────────┘
```

### Códigos de Error

```typescript
enum ErrorCode {
  // Validación (HTTP 400)
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  INVALID_UUID = 'INVALID_UUID',
  INVALID_TENANT = 'INVALID_TENANT',
  INVALID_TERMINAL = 'INVALID_TERMINAL',
  INVALID_ORDER_NUMBER = 'INVALID_ORDER_NUMBER',
  
  // Rate Limiting (HTTP 429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  BURST_LIMIT_EXCEEDED = 'BURST_LIMIT_EXCEEDED',
  
  // Conflictos (HTTP 409)
  REVISION_CONFLICT = 'REVISION_CONFLICT',
  PAYMENT_CONFLICT = 'PAYMENT_CONFLICT',
  ORDER_NUMBER_COLLISION = 'ORDER_NUMBER_COLLISION',
  
  // Dependencias (HTTP 422)
  DEPENDENCY_MISSING = 'DEPENDENCY_MISSING',
  OUT_OF_ORDER = 'OUT_OF_ORDER',
  
  // Servidor (HTTP 500)
  DB_ERROR = 'DB_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  
  // Autenticación (HTTP 401)
  UNAUTHORIZED = 'UNAUTHORIZED',
}
```

### Respuestas de Error Estructuradas

```typescript
interface ErrorResponse {
  accepted: false;
  error: {
    error_code: ErrorCode;
    severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    message: string;
    user_action: string;
    retryable: boolean;
    context?: Record<string, unknown>;
  };
}
```

**Ejemplos:**

```typescript
// Error de validación (no retryable)
{
  accepted: false,
  error: {
    error_code: 'INVALID_UUID',
    severity: 'ERROR',
    message: 'El event_id no es un UUID válido',
    user_action: 'Verifica que todos los UUIDs sean válidos v4',
    retryable: false,
    context: {
      event_id: 'invalid-id',
      field: 'event_id'
    }
  }
}

// Error de rate limit (retryable)
{
  accepted: false,
  error: {
    error_code: 'RATE_LIMIT_EXCEEDED',
    severity: 'WARN',
    message: 'Límite de requests excedido',
    user_action: 'Espera 1 segundo antes de reintentar',
    retryable: true,
    context: {
      current_count: 150,
      limit: 100,
      retry_after: 1
    }
  }
}

// Conflicto de revisión (retryable con refresh)
{
  accepted: false,
  error: {
    error_code: 'REVISION_CONFLICT',
    severity: 'WARN',
    message: 'La orden fue modificada por otro terminal',
    user_action: 'Refresca la orden y reintenta',
    retryable: true,
    context: {
      aggregate_id: 'order-123',
      expected_revision: 5,
      actual_revision: 7
    }
  }
}
```

### Retry Logic en SyncClient

```typescript
// src/core/sync/client.ts

async syncOnce(): Promise<IngestResponse | null> {
  try {
    const resp = await syncCircuitBreaker.execute(async () => {
      const r = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-secret': apiSecret
        },
        body: JSON.stringify(req),
      });

      const data = await r.json() as IngestResponse;

      // Analizar error para decidir si reintentar
      if (!r.ok && data?.error) {
        const error = data.error;
        
        // HTTP 429 → respetar Retry-After
        if (r.status === 429) {
          const retryAfter = parseInt(r.headers.get('Retry-After') || '1');
          await sleep(retryAfter * 1000);
          throw new Error('RATE_LIMIT_RETRY');
        }
        
        // HTTP 4xx (excepto 429) → NO reintentar
        if (r.status >= 400 && r.status < 500) {
          logger.error('sync.client_error', error.message, undefined, {
            error_code: error.error_code,
            status: r.status
          });
          return data; // Retornar error sin reintentar
        }
        
        // HTTP 5xx → reintentar con backoff
        if (r.status >= 500) {
          throw new Error(error.message);
        }
      }

      return data;
    });

    return resp;
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    
    // Circuit breaker abierto → no reintentar
    if (err.message === 'Circuit breaker is OPEN') {
      logger.debug('sync.circuit_open', 'Circuit breaker OPEN, skipping request');
      return null;
    }

    // Error de red → reintentar con exponential backoff
    this.attempt++;
    const delay = jitter(
      nextBackoff(this.attempt, this.minBackoffMs, this.maxBackoffMs),
      this.jitterRatio
    );
    
    logger.warn('sync.retry', `Retrying in ${delay}ms (attempt ${this.attempt})`, {
      delay_ms: delay,
      attempt: this.attempt
    });
    
    await sleep(delay);
    return this.syncOnce(); // Reintentar recursivamente
  }
}
```

## Testing Strategy

### Enfoque Dual: Unit Tests + Property-Based Tests

El sistema usa un enfoque dual de testing:

1. **Unit Tests**: Verifican ejemplos específicos, edge cases, y comportamientos determinísticos
2. **Property-Based Tests**: Verifican propiedades universales con inputs generados aleatoriamente

### Property-Based Testing Configuration

**Librería:** `fast-check` (JavaScript/TypeScript)

**Configuración:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Configuración para property tests
    testTimeout: 30000, // 30s para property tests
  }
});
```

**Ejemplo de Property Test:**
```typescript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Property 1: Idempotencia de Deduplicación', () => {
  it('Feature: event-sourcing-critical-fixes, Property 1: Para cualquier evento, enviarlo múltiples veces debe procesarlo solo una vez', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary: generar evento aleatorio
        fc.record({
          event_id: fc.uuid(),
          event_type: fc.constantFrom('ORDER_CREATED', 'ORDER_ITEM_ADDED'),
          tenant_id: fc.uuid(),
          terminal_id: fc.string(),
          aggregate_id: fc.uuid(),
          occurred_at: fc.date().map(d => d.toISOString()),
          payload: fc.object(),
        }),
        // Arbitrary: número de veces a enviar (2-5)
        fc.integer({ min: 2, max: 5 }),
        
        async (event, times) => {
          // Enviar el mismo evento múltiples veces
          const responses = await Promise.all(
            Array(times).fill(null).map(() => 
              ingestEvent(event)
            )
          );
          
          // Todas las respuestas deben ser éxito
          expect(responses.every(r => r.accepted)).toBe(true);
          
          // Verificar que solo se procesó una vez
          const processed = await prisma.processed_events.findUnique({
            where: { event_id: event.event_id }
          });
          expect(processed).toBeDefined();
          
          // Verificar que solo hay 1 registro en events
          const eventCount = await prisma.events.count({
            where: { id: event.event_id }
          });
          expect(eventCount).toBe(1);
        }
      ),
      { numRuns: 100 } // 100 iteraciones
    );
  });
});
```

### Unit Tests para Edge Cases

```typescript
describe('Deduplication Edge Cases', () => {
  it('debe manejar inserción simultánea del mismo evento', async () => {
    const event = createTestEvent();
    
    // Enviar el mismo evento desde 3 threads simultáneamente
    const results = await Promise.allSettled([
      ingestEvent(event),
      ingestEvent(event),
      ingestEvent(event),
    ]);
    
    // Todos deben resolver (no rechazar)
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    
    // Solo debe haber 1 registro
    const count = await prisma.processed_events.count({
      where: { event_id: event.event_id }
    });
    expect(count).toBe(1);
  });
  
  it('debe incluir event_id en deduped_event_ids para duplicados', async () => {
    const event = createTestEvent();
    
    // Primera vez
    await ingestEvent(event);
    
    // Segunda vez (duplicado)
    const response = await ingestEvent(event);
    
    expect(response.accepted).toBe(true);
    expect(response.deduped_event_ids).toContain(event.event_id);
  });
});
```

### E2E Tests (Playwright)

Los tests E2E validan el comportamiento completo del sistema:

```typescript
// e2e/02-offline-sync.spec.ts

test('should handle duplicate event submission (idempotency)', async ({ request }) => {
  const event = createOrderEvent();
  
  // Enviar el mismo evento 3 veces
  const responses = await Promise.all([
    ingestEvent(request, event),
    ingestEvent(request, event),
    ingestEvent(request, event),
  ]);
  
  // Todas deben ser exitosas
  for (const response of responses) {
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.accepted).toBeTruthy();
  }
});
```

### Test Coverage Goals

| Componente | Unit Tests | Property Tests | E2E Tests | Target Coverage |
|------------|------------|----------------|-----------|-----------------|
| Deduplication Service | 10 tests | 3 properties | 2 tests | 95% |
| Rate Limiter | 8 tests | 2 properties | 1 test | 90% |
| Order Number Ranges | 6 tests | 2 properties | 1 test | 95% |
| Out-of-Order Queue | 8 tests | 2 properties | 1 test | 85% |
| Conflict Resolver | 12 tests | 3 properties | 5 tests | 95% |
| SyncClient Retry | 10 tests | 2 properties | 2 tests | 90% |

**Total:** ~54 unit tests + ~14 property tests + ~12 E2E tests = **80 tests**

### Métricas de Éxito

El sistema estará listo para producción cuando:

1. ✅ Todos los 8 tests E2E fallando pasen (100%)
2. ✅ Coverage de código ≥90% en componentes críticos
3. ✅ Property tests ejecuten 100 iteraciones sin fallos
4. ✅ Tests de carga soporten 16 terminales concurrentes
5. ✅ Rate limiter rechace correctamente requests excesivos
6. ✅ Deduplicación funcione bajo concurrencia alta
7. ✅ Circuit breaker se abra después de 10 fallos
8. ✅ Retry logic respete exponential backoff

