# PARK POS — Mejoras Arquitectónicas

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** 📋 Propuestas de Mejora

> **Objetivo:** Documentar mejoras arquitectónicas identificadas durante la revisión del código para elevar el sistema de 9/10 a 10/10 en robustez enterprise.

---

## 0) Contexto

El proyecto PARK POS tiene una arquitectura sólida basada en Event Sourcing + Offline-First. Este documento identifica **10 mejoras críticas** para alcanzar nivel enterprise en:
- Confiabilidad
- Escalabilidad
- Observabilidad
- Mantenibilidad

---

## 1) Outbox Pattern (CRÍTICO)

### Problema Actual

```typescript
// En /api/events/ingest/route.ts
await prisma.$transaction(async (tx) => {
  await tx.event.create({...});
  await projectEvent(tx, event);
  // ❌ PROBLEMA: Publicación fuera de transacción
});

// Después del commit
eventBus.publish(tenant_id, event); // ⚠️ Si falla, evento no se notifica
```

**Riesgo:** Evento guardado en DB pero no notificado a otros terminales → Inconsistencia temporal.

### Solución: Event Outbox

**Nueva tabla:**
```sql
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_outbox_pending (tenant_id, published, created_at)
    WHERE published = FALSE
);
```


**Implementación en Ingest:**
```typescript
// src/app/api/events/ingest/route.ts
await prisma.$transaction(async (tx) => {
  // 1. Insertar evento
  await tx.event.create({...});
  
  // 2. Proyectar
  await projectEvent(tx, event);
  
  // 3. Agregar a outbox (ATÓMICO)
  await tx.eventOutbox.create({
    tenant_id: event.tenant_id,
    event_id: event.event_id,
    payload: event as any,
  });
});
// ✅ Todo o nada
```

**Worker de Publicación:**
```typescript
// src/core/workers/outbox-publisher.ts
export async function startOutboxPublisher() {
  setInterval(async () => {
    const pending = await prisma.eventOutbox.findMany({
      where: { published: false },
      orderBy: { created_at: 'asc' },
      take: 100,
    });

    for (const item of pending) {
      try {
        eventBus.publish(item.tenant_id, item.payload);
        
        await prisma.eventOutbox.update({
          where: { id: item.id },
          data: { 
            published: true, 
            published_at: new Date() 
          },
        });
      } catch (error) {
        await prisma.eventOutbox.update({
          where: { id: item.id },
          data: { 
            attempts: { increment: 1 },
            last_error: error.message,
          },
        });
      }
    }
  }, 100); // Cada 100ms
}
```

**Beneficios:**
- ✅ Garantía de entrega
- ✅ Retry automático
- ✅ Auditoría de publicaciones
- ✅ No pierde eventos si EventBus falla

**Prioridad:** 🔥 CRÍTICO  
**Esfuerzo:** 2 días  
**Fase:** P0

---

## 2) Event Schema Versioning

### Problema Actual

```typescript
// Si cambias el schema de un evento, eventos viejos fallan
const OrderCreatedPayload = z.object({
  order_id: uuidSchema,
  order_number: z.number(),
  // ❌ Agregar campo nuevo rompe eventos históricos
});
```

### Solución: Schema Evolution

**Estructura versionada:**
```typescript
// src/core/domain/events.v2.ts

// Versión 1 (original)
const OrderCreatedPayloadV1 = z.object({
  order_id: uuidSchema,
  order_number: z.number(),
  order_type: OrderTypeSchema,
  items: z.array(OrderLineSchema),
  checks: z.array(CheckSchema),
});

// Versión 2 (con delivery)
const OrderCreatedPayloadV2 = OrderCreatedPayloadV1.extend({
  delivery_address: z.string().optional(),
  delivery_fee_cents: z.number().optional(),
  delivery_instructions: z.string().optional(),
});

// Versión 3 (futuro: con promociones)
const OrderCreatedPayloadV3 = OrderCreatedPayloadV2.extend({
  applied_promotions: z.array(PromotionSchema).optional(),
});
```

**Migrador automático:**
```typescript
// src/core/domain/event-migrator.ts
export function migrateEvent(event: ParkEvent): ParkEvent {
  if (event.event_type === "ORDER_CREATED") {
    return migrateOrderCreated(event);
  }
  return event;
}

function migrateOrderCreated(event: ParkEvent): ParkEvent {
  const version = event.schema_version;
  let payload = event.payload;

  // V1 → V2
  if (version < 2) {
    payload = {
      ...payload,
      delivery_address: null,
      delivery_fee_cents: 0,
      delivery_instructions: null,
    };
  }

  // V2 → V3
  if (version < 3) {
    payload = {
      ...payload,
      applied_promotions: [],
    };
  }

  return {
    ...event,
    schema_version: 3, // Versión actual
    payload,
  };
}
```

**Uso en Reducers:**
```typescript
// src/core/projections/sale.reducer.ts
export function applySaleEvent(sale: SaleProjection | null, e: ParkEvent) {
  // Migrar evento antes de procesar
  const migratedEvent = migrateEvent(e);
  
  switch (migratedEvent.event_type) {
    case "ORDER_CREATED": {
      // Ahora siempre tiene todos los campos
      const { delivery_address, applied_promotions } = migratedEvent.payload;
      // ...
    }
  }
}
```

**Beneficios:**
- ✅ Backward compatibility
- ✅ Migración gradual
- ✅ Eventos históricos siguen funcionando
- ✅ Deploy sin downtime

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 3 días  
**Fase:** P1

---

## 3) Saga Pattern para Flujos Complejos

### Problema Futuro

```typescript
// Flujo: Crear orden → Reservar cupón → Aplicar promo → Facturar
// ❌ Si falla en paso 3, ¿cómo revertir paso 2?
```

### Solución: Saga Orchestrator

**Definición de Saga:**
```typescript
// src/core/sagas/complete-sale.saga.ts
export class CompleteSaleSaga {
  constructor(
    private tenantId: string,
    private terminalId: string,
    private actorId: string
  ) {}

  async execute(orderId: string, checkId: string) {
    const steps: SagaStep[] = [
      {
        name: "validate_payment",
        do: () => this.validatePayment(orderId, checkId),
        undo: () => this.refundPayment(orderId, checkId),
      },
      {
        name: "reserve_coupon",
        do: () => this.reserveCoupon(orderId),
        undo: () => this.releaseCoupon(orderId),
      },
      {
        name: "issue_invoice",
        do: () => this.issueInvoice(orderId, checkId),
        undo: () => this.voidInvoice(orderId, checkId),
      },
      {
        name: "print_ticket",
        do: () => this.printTicket(orderId, checkId),
        undo: () => this.cancelPrint(orderId, checkId),
      },
    ];

    return await this.executeSaga(steps, orderId);
  }

  private async executeSaga(steps: SagaStep[], orderId: string) {
    const completed: SagaStep[] = [];
    
    try {
      for (const step of steps) {
        console.log(`[Saga] Executing: ${step.name}`);
        await step.do();
        completed.push(step);
      }
      
      console.log(`[Saga] Completed successfully`);
      return { success: true };
      
    } catch (error) {
      console.error(`[Saga] Failed, rolling back...`, error);
      
      // Rollback en orden inverso
      for (const step of completed.reverse()) {
        try {
          console.log(`[Saga] Undoing: ${step.name}`);
          await step.undo();
        } catch (undoError) {
          console.error(`[Saga] Undo failed for ${step.name}`, undoError);
          // Log crítico pero continuar rollback
        }
      }
      
      throw error;
    }
  }

  private async validatePayment(orderId: string, checkId: string) {
    // Validar que el pago sea suficiente
  }

  private async refundPayment(orderId: string, checkId: string) {
    // Emitir evento PAYMENT_REFUNDED
  }

  // ... otros métodos
}
```

**Uso:**
```typescript
// En UI o API
const saga = new CompleteSaleSaga(TENANT_ID, TERM_ID, ACTOR_ID);
try {
  await saga.execute(orderId, checkId);
  toast.success("Venta completada");
} catch (error) {
  toast.error("Error en venta, cambios revertidos");
}
```

**Beneficios:**
- ✅ Transacciones distribuidas
- ✅ Rollback automático
- ✅ Auditoría de flujos
- ✅ Manejo de errores robusto

**Prioridad:** 💡 MEJORA  
**Esfuerzo:** 5 días  
**Fase:** P1

---

## 4) Circuit Breaker para Sync

### Problema Actual

```typescript
// Si el servidor está caído, el cliente reintenta infinitamente
// ❌ Desperdicia batería y recursos
```

### Solución: Circuit Breaker

**Implementación:**
```typescript
// src/core/sync/circuit-breaker.ts
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailure: Date | null = null;
  private successCount = 0;

  constructor(
    private threshold = 5,        // Fallos para abrir
    private timeout = 60000,      // 60s antes de reintentar
    private halfOpenAttempts = 3  // Intentos en HALF_OPEN
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        console.log('[CircuitBreaker] Transitioning to HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailure) return false;
    return Date.now() - this.lastFailure.getTime() > this.timeout;
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenAttempts) {
        console.log('[CircuitBreaker] Closing circuit after successful attempts');
        this.state = 'CLOSED';
        this.failures = 0;
        this.successCount = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    this.successCount = 0;

    if (this.failures >= this.threshold) {
      console.warn(`[CircuitBreaker] Opening circuit after ${this.failures} failures`);
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

**Integración en SyncClient:**
```typescript
// src/core/sync/client.ts
export class SyncClient {
  private circuitBreaker = new CircuitBreaker();

  async syncOnce(): Promise<IngestResponse | null> {
    try {
      return await this.circuitBreaker.execute(async () => {
        // Lógica de sync existente
        const pending = await db.events.where("synced").equals(0).toArray();
        // ...
        const resp = await fetch(this.endpoint, {...});
        return resp;
      });
    } catch (error) {
      if (error.message === 'Circuit breaker is OPEN') {
        console.log('[Sync] Circuit open, skipping sync attempt');
        return null;
      }
      throw error;
    }
  }
}
```

**Beneficios:**
- ✅ Ahorra batería
- ✅ Reduce carga en servidor caído
- ✅ Mejor UX (no bloquea UI)
- ✅ Auto-recuperación

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 1 día  
**Fase:** P0

---


## 5) Conflict Resolution (Resolución de Conflictos)

### Problema Actual

```typescript
// Terminal A (offline): Edita orden #123, agrega item "Pollo"
// Terminal B (offline): Edita orden #123, agrega item "Papas"
// Ambos sincronizan → ¿Cuál gana?
// ❌ Sin estrategia definida = datos inconsistentes
```

**Escenario Real:**
- Mesero A agrega item desde su tablet
- Mesero B agrega otro item desde otra tablet
- Ambos offline por 5 minutos
- Al sincronizar, uno sobrescribe al otro

### Solución: Optimistic Locking + CRDT-like Merge

**Opción 1: Optimistic Locking (Recomendado para MVP)**

```typescript
// Agregar revision a órdenes
interface Order {
  id: string;
  revision: number; // Incrementa con cada cambio
  // ...
}

// En evento
interface OrderItemAddedPayload {
  order_id: string;
  expected_revision: number; // Revisión que el cliente espera
  line: OrderLine;
}

// Validación en server
async function validateRevision(event: ParkEvent) {
  if (event.event_type === "ORDER_ITEM_ADDED") {
    const order = await prisma.order.findUnique({
      where: { id: event.payload.order_id }
    });
    
    if (order.revision !== event.payload.expected_revision) {
      return {
        accepted: false,
        error: {
          code: "REVISION_CONFLICT",
          current_revision: order.revision,
          expected_revision: event.payload.expected_revision,
          message: "Orden modificada por otro terminal"
        }
      };
    }
  }
}

// En proyección
await tx.order.update({
  where: { id: p.order_id },
  data: {
    revision: { increment: 1 },
    // ... otros campos
  }
});
```

**Opción 2: Last-Write-Wins con Merge Automático**

```typescript
// Para items, hacer merge en lugar de sobrescribir
async function mergeOrderItems(
  existingItems: OrderLine[],
  newItem: OrderLine
): OrderLine[] {
  // Buscar si item ya existe (por product_id + modifiers)
  const existingIndex = existingItems.findIndex(
    i => i.product_id === newItem.product_id &&
         JSON.stringify(i.modifiers) === JSON.stringify(newItem.modifiers)
  );
  
  if (existingIndex >= 0) {
    // Merge: sumar cantidades
    existingItems[existingIndex].quantity += newItem.quantity;
    return existingItems;
  }
  
  // Agregar nuevo item
  return [...existingItems, newItem];
}
```

**Opción 3: Vector Clocks (Para casos complejos)**

```typescript
// Cada terminal mantiene un vector de versiones
interface VectorClock {
  [terminal_id: string]: number;
}

// Evento incluye vector clock
interface ParkEvent {
  // ...
  vector_clock: VectorClock;
}

// Comparar para detectar conflictos
function detectConflict(a: VectorClock, b: VectorClock): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  
  let aGreater = false;
  let bGreater = false;
  
  for (const key of [...new Set([...aKeys, ...bKeys])]) {
    if ((a[key] || 0) > (b[key] || 0)) aGreater = true;
    if ((b[key] || 0) > (a[key] || 0)) bGreater = true;
  }
  
  // Conflicto si ambos son "mayores" en algún componente
  return aGreater && bGreater;
}
```

**UI para Resolver Conflictos:**

```typescript
// src/components/ConflictResolver.tsx
export function ConflictResolver({ conflict }: { conflict: ConflictInfo }) {
  return (
    <Dialog open>
      <DialogTitle>⚠️ Conflicto Detectado</DialogTitle>
      <DialogContent>
        <p>La orden fue modificada por otro terminal.</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4>Tu versión:</h4>
            <pre>{JSON.stringify(conflict.local, null, 2)}</pre>
          </div>
          <div>
            <h4>Versión del servidor:</h4>
            <pre>{JSON.stringify(conflict.server, null, 2)}</pre>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => resolveConflict('local')}>
          Usar mi versión
        </Button>
        <Button onClick={() => resolveConflict('server')}>
          Usar versión del servidor
        </Button>
        <Button onClick={() => resolveConflict('merge')}>
          Combinar ambas
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Beneficios:**
- ✅ Evita pérdida de datos
- ✅ Usuario decide en conflictos
- ✅ Auditoría de resoluciones
- ✅ Compatible con offline-first

**Prioridad:** 🔥 CRÍTICO  
**Esfuerzo:** 3 días  
**Fase:** P0

---

## 6) Rate Limiting

### Problema Actual

```typescript
// Sin límites en API
// ❌ Un tenant puede saturar el servidor
// ❌ Ataques DDoS posibles
// ❌ Otros tenants afectados
```

### Solución: Rate Limiting Multi-Nivel

**Implementación con Upstash:**

```typescript
// src/core/middleware/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Límites por nivel
const rateLimiters = {
  // Por tenant: 1000 eventos/minuto
  tenant: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, "1 m"),
    prefix: "ratelimit:tenant",
  }),
  
  // Por terminal: 200 eventos/minuto
  terminal: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, "1 m"),
    prefix: "ratelimit:terminal",
  }),
  
  // Por IP: 500 requests/minuto (anti-abuse)
  ip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, "1 m"),
    prefix: "ratelimit:ip",
  }),
};

export async function checkRateLimit(
  tenantId: string,
  terminalId: string,
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Check IP first (cheapest)
  const ipResult = await rateLimiters.ip.limit(ip);
  if (!ipResult.success) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000) 
    };
  }
  
  // Check tenant
  const tenantResult = await rateLimiters.tenant.limit(tenantId);
  if (!tenantResult.success) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((tenantResult.reset - Date.now()) / 1000) 
    };
  }
  
  // Check terminal
  const terminalResult = await rateLimiters.terminal.limit(terminalId);
  if (!terminalResult.success) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((terminalResult.reset - Date.now()) / 1000) 
    };
  }
  
  return { allowed: true };
}
```

**Integración en API:**

```typescript
// src/app/api/events/ingest/route.ts
import { checkRateLimit } from "@/src/core/middleware/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const { tenant_id, terminal_id } = await extractAuth(req);
  
  // Check rate limit
  const rateLimit = await checkRateLimit(tenant_id, terminal_id, ip);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: "RATE_LIMIT_EXCEEDED",
        retry_after: rateLimit.retryAfter,
        message: "Demasiadas solicitudes. Intenta de nuevo."
      },
      { 
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        }
      }
    );
  }
  
  // Continuar con ingest normal...
}
```

**Manejo en Cliente:**

```typescript
// src/core/sync/client.ts
export class SyncClient {
  private retryAfter: number = 0;
  
  async syncOnce(): Promise<IngestResponse | null> {
    // Respetar rate limit
    if (this.retryAfter > Date.now()) {
      console.log(`[Sync] Rate limited, waiting...`);
      return null;
    }
    
    try {
      const resp = await fetch(this.endpoint, {...});
      
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "60");
        this.retryAfter = Date.now() + (retryAfter * 1000);
        console.warn(`[Sync] Rate limited for ${retryAfter}s`);
        return null;
      }
      
      return await resp.json();
    } catch (error) {
      throw error;
    }
  }
}
```

**Beneficios:**
- ✅ Protege servidor de sobrecarga
- ✅ Fairness entre tenants
- ✅ Previene abuso
- ✅ Graceful degradation

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 1 día  
**Fase:** P0

---

## 7) Monitoring y Observabilidad

### Problema Actual

```typescript
// ❌ Sin métricas de:
// - Latencia de sync
// - Tasa de errores
// - Backlog size
// - Eventos por segundo
```

**Consecuencias:**
- No sabemos si el sistema está lento
- No detectamos errores hasta que usuarios reportan
- No podemos optimizar sin datos

### Solución: OpenTelemetry Stack

> **Nota:** Ver documentación completa en `docs/OBSERVABILIDAD.md`

**Setup Básico:**

```typescript
// src/core/observability/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  metricReader: new PrometheusExporter({ port: 9464 }),
});

sdk.start();
```

**Métricas Clave:**

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('park-pos-sync');

// Histograma de latencia
const syncLatency = meter.createHistogram('sync.latency', {
  description: 'Sync batch latency in milliseconds',
  unit: 'ms',
});

// Gauge de backlog
const syncBacklog = meter.createObservableGauge('sync.backlog', {
  description: 'Number of unsynced events',
});

// Counter de errores
const syncErrors = meter.createCounter('sync.errors', {
  description: 'Total sync errors',
});
```

**Alertas Críticas:**

```yaml
# Backlog alto
alert: SyncBacklogHigh
expr: sync_backlog > 1000
for: 5m
severity: warning

# Error rate alto
alert: SyncErrorRateHigh
expr: rate(sync_errors_total[5m]) > 0.1
for: 2m
severity: critical
```

**Beneficios:**
- ✅ Detección temprana de problemas
- ✅ Optimización basada en datos
- ✅ Debugging rápido
- ✅ SLA monitoring

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 2-3 días  
**Fase:** P0

---

## 8) Event Compaction y Snapshots

### Problema Actual

```typescript
// Después de 6 meses:
// - 1M eventos en IndexedDB
// - Rebuild de proyección toma 30 segundos
// ❌ UX degradada al abrir app
```

### Solución: Snapshots Periódicos

> **Nota:** Ver documentación completa en `docs/PERFORMANCE.md`

**Nueva Tabla de Snapshots:**

```typescript
// src/core/db/schema.ts
export interface SnapshotEntity {
  id: string;
  aggregate_type: string;  // 'ORDER', 'SHIFT'
  aggregate_id: string;
  sequence: number;        // Último evento incluido
  state: any;              // Estado serializado
  created_at: string;
}
```

**Generación Automática:**

```typescript
// src/core/projections/snapshot.ts
const SNAPSHOT_INTERVAL = 1000; // Cada 1000 eventos

export async function maybeCreateSnapshot(
  aggregateType: string,
  aggregateId: string,
  state: any,
  currentSequence: number
) {
  const lastSnapshot = await db.snapshots
    .where({ aggregate_type: aggregateType, aggregate_id: aggregateId })
    .last();
  
  const lastSeq = lastSnapshot?.sequence ?? 0;
  
  if (currentSequence - lastSeq >= SNAPSHOT_INTERVAL) {
    await db.snapshots.put({
      id: newUUID(),
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      sequence: currentSequence,
      state,
      created_at: new Date().toISOString(),
    });
  }
}
```

**Rebuild Optimizado:**

```typescript
export async function rebuildSale(orderId: string): Promise<SaleProjection | null> {
  // 1. Buscar último snapshot
  const snapshot = await db.snapshots
    .where({ aggregate_type: 'ORDER', aggregate_id: orderId })
    .last();
  
  let state = snapshot?.state ?? null;
  const fromSeq = snapshot?.sequence ?? 0;
  
  // 2. Aplicar solo eventos después del snapshot
  const events = await db.events
    .where('terminal_sequence')
    .above(fromSeq)
    .filter(e => e.aggregate_id === orderId)
    .sortBy('terminal_sequence');
  
  for (const event of events) {
    state = applySaleEvent(state, event as ParkEvent).state;
  }
  
  return state;
}
```

**Beneficios:**
- ✅ Rebuild 100x más rápido
- ✅ Menos CPU/batería
- ✅ Mejor UX al abrir app

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 3 días  
**Fase:** P1

---

## 9) Property-Based Testing

### Problema Actual

```typescript
// Tests actuales solo cubren casos específicos
// ❌ No detectan edge cases
// ❌ No validan invariantes del sistema
```

### Solución: Property-Based Testing con fast-check

**Instalación:**

```bash
npm install --save-dev fast-check
```

**Tests de Invariantes:**

```typescript
// src/core/projections/__tests__/sale.reducer.property.test.ts
import fc from 'fast-check';
import { applySaleEvent } from '../sale.reducer';

// Generador de eventos válidos
const orderCreatedArb = fc.record({
  event_type: fc.constant('ORDER_CREATED'),
  event_id: fc.uuid(),
  payload: fc.record({
    order_id: fc.uuid(),
    order_number: fc.integer({ min: 1, max: 999999 }),
    items: fc.array(fc.record({
      line_id: fc.uuid(),
      quantity: fc.integer({ min: 1, max: 100 }),
      unit_price_cents: fc.integer({ min: 100, max: 100000 }),
    }), { minLength: 1, maxLength: 50 }),
  }),
});

describe('SaleProjection Properties', () => {
  // Invariante 1: Total siempre >= 0
  it('total is always non-negative', () => {
    fc.assert(
      fc.property(orderCreatedArb, (event) => {
        const result = applySaleEvent(null, event as any);
        return result.state!.total_cents >= 0;
      })
    );
  });
  
  // Invariante 2: Subtotal = suma de items
  it('subtotal equals sum of line totals', () => {
    fc.assert(
      fc.property(orderCreatedArb, (event) => {
        const result = applySaleEvent(null, event as any);
        const expectedSubtotal = event.payload.items.reduce(
          (sum, item) => sum + (item.quantity * item.unit_price_cents),
          0
        );
        return result.state!.subtotal_cents === expectedSubtotal;
      })
    );
  });
  
  // Invariante 3: Idempotencia
  it('applying same event twice is idempotent', () => {
    fc.assert(
      fc.property(orderCreatedArb, (event) => {
        const result1 = applySaleEvent(null, event as any);
        const result2 = applySaleEvent(result1.state, event as any);
        return JSON.stringify(result1.state) === JSON.stringify(result2.state);
      })
    );
  });
});
```

**Beneficios:**
- ✅ Encuentra edge cases automáticamente
- ✅ Valida invariantes del sistema
- ✅ Documenta propiedades esperadas
- ✅ Regresión automática

**Prioridad:** 💡 MEJORA  
**Esfuerzo:** 2 días  
**Fase:** P1

---

## 10) Índices de Performance

### Problema Actual

```sql
-- Query lento en producción
SELECT * FROM events 
WHERE tenant_id = ? AND aggregate_id = ?
ORDER BY terminal_sequence;

-- ❌ Sin índice compuesto = full table scan
```

### Solución: Índices Optimizados

**Migración Prisma:**

```prisma
// prisma/schema.prisma

model Event {
  @@index([tenant_id, aggregate_id, occurred_at(sort: Desc)])
  @@index([tenant_id, occurred_at(sort: Desc)])
  @@index([terminal_id, terminal_sequence])
}

model Order {
  @@index([tenant_id, order_status])
  @@index([tenant_id, created_at(sort: Desc)])
  @@index(stations_active, type: Gin) // Para KDS
}

model Invoice {
  @@index([tenant_id, created_at(sort: Desc)])
  @@index([tenant_id, status])
}

model Shift {
  @@index([tenant_id, status])
  @@index([tenant_id, opened_at(sort: Desc)])
}
```

**Índices Parciales (PostgreSQL):**

```sql
-- Solo indexar eventos no sincronizados
CREATE INDEX idx_events_unsynced 
ON events(terminal_id, terminal_sequence) 
WHERE synced = false;

-- Solo indexar órdenes activas
CREATE INDEX idx_orders_active 
ON orders(tenant_id, order_status, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- Solo indexar checks sin pagar
CREATE INDEX idx_orders_unpaid 
ON orders(tenant_id, unpaid_checks_count) 
WHERE unpaid_checks_count > 0;
```

**Índices en IndexedDB (Dexie):**

```typescript
// src/core/db/schema.ts
this.version(4).stores({
  events: '++id, event_id, [tenant_id+aggregate_id], [synced+terminal_sequence]',
  orders: 'id, [tenant_id+order_status], [tenant_id+created_at]',
  shifts: 'id, [tenant_id+status]',
});
```

**Beneficios:**
- ✅ Queries 10-100x más rápidos
- ✅ Menor uso de CPU en DB
- ✅ Mejor escalabilidad
- ✅ UX más fluida

**Prioridad:** ⚠️ IMPORTANTE  
**Esfuerzo:** 1 día  
**Fase:** P0

---

## 📊 Resumen de Mejoras

| # | Mejora | Prioridad | Esfuerzo | Fase | Estado |
|---|--------|-----------|----------|------|--------|
| 1 | Outbox Pattern | 🔥 CRÍTICO | 2 días | P0 | ✅ Completado |
| 2 | Event Schema Versioning | ⚠️ IMPORTANTE | 3 días | P1 | ⏳ Pendiente |
| 3 | Saga Pattern | 💡 MEJORA | 5 días | P2 | ⏳ Pendiente |
| 4 | Circuit Breaker | ⚠️ IMPORTANTE | 1 día | P0 | ✅ Completado |
| 5 | Conflict Resolution | 🔥 CRÍTICO | 3 días | P1 | ⏳ Pendiente |
| 6 | Rate Limiting | ⚠️ IMPORTANTE | 1 día | P0 | ✅ Completado |
| 7 | Monitoring/Observabilidad | ⚠️ IMPORTANTE | 2-3 días | P1 | ⏳ Pendiente |
| 8 | Event Compaction/Snapshots | ⚠️ IMPORTANTE | 3 días | P1 | ⏳ Pendiente |
| 9 | Property-Based Testing | 💡 MEJORA | 2 días | P2 | ⏳ Pendiente |
| 10 | Performance Indices | ⚠️ IMPORTANTE | 1 día | P0 | ✅ Completado |

**Estado Actual (Enero 2026):**
- **P0 Completado:** 4/4 mejoras críticas ✅
- **P1 Pendiente:** 4 mejoras importantes
- **P2 Pendiente:** 2 mejoras opcionales

---

## 🎯 Orden de Implementación (Actualizado)

### ✅ Completado (P0)
1. **Performance Indices** - ✅ Migración aplicada
2. **Rate Limiting** - ✅ `src/core/middleware/rate-limit.ts`
3. **Outbox Pattern** - ✅ Tabla `event_outbox` + worker
4. **Circuit Breaker** - ✅ `src/core/sync/circuit-breaker.ts`
5. **Event Deduplication** - ✅ Tabla `processed_events`
6. **Server Validation** - ✅ `validateEvent()` en business-rules.ts

### 🟡 Próximos (P1)
1. Conflict Resolution (3 días)
2. Event Schema Versioning (3 días)
3. Snapshots/Compaction (3 días)
4. Observabilidad (2-3 días)

### ⬜ Futuro (P2)
1. Saga Pattern (5 días)
2. Property-Based Testing (2 días)

---

**Documento generado por:** Kiro AI Assistant  
**Fecha:** Enero 2026  
**Próxima revisión:** Después de implementar mejoras P0
