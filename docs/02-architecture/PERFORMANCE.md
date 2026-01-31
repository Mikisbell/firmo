# PARK POS — Optimizaciones de Performance

**Versión:** 1.0  
**Fecha:** Enero 2026  
**Estado:** 📋 Propuesta

> **Objetivo:** Optimizaciones para mantener performance < 50ms en UI y < 100ms en sync incluso con 6+ meses de datos.

---

## 1) Event Compaction y Snapshots

### Problema

```typescript
// Después de 6 meses:
// - 1M eventos en IndexedDB
// - Rebuild de proyección toma 30 segundos
// ❌ UX degradada al abrir app
```

### Solución: Snapshots Periódicos

**Nueva tabla:**
```typescript
// src/core/db/schema.ts
export interface SnapshotEntity {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  sequence: number;
  state: any;
  created_at: string;
}

// En Dexie
this.version(3).stores({
  // ... tablas existentes
  snapshots: 'id, [aggregate_type+aggregate_id], sequence',
});
```

**Generación de Snapshots:**
```typescript
// src/core/projections/snapshot.ts
export async function createSnapshot(
  aggregateType: string,
  aggregateId: string,
  state: any,
  sequence: number
) {
  await db.snapshots.put({
    id: newUUID(),
    aggregate_type: aggregateType,
    aggregate_id: aggregateId,
    sequence,
    state,
    created_at: new Date().toISOString(),
  });
}

// Crear snapshot cada 1000 eventos
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
  
  if (currentSequence - lastSeq >= 1000) {
    await createSnapshot(aggregateType, aggregateId, state, currentSequence);
    console.log(`[Snapshot] Created for ${aggregateType}:${aggregateId} at seq ${currentSequence}`);
  }
}
```

**Rebuild Optimizado:**
```typescript
// src/core/projections/rebuild.ts
export async function rebuildSale(orderId: string): Promise<SaleProjection | null> {
  // 1. Buscar último snapshot
  const snapshot = await db.snapshots
    .where({ aggregate_type: 'ORDER', aggregate_id: orderId })
    .last();
  
  let state: SaleProjection | null = snapshot?.state ?? null;
  const fromSeq = snapshot?.sequence ?? 0;
  
  console.log(`[Rebuild] Starting from snapshot at seq ${fromSeq}`);
  
  // 2. Aplicar solo eventos después del snapshot
  const events = await db.events
    .where('terminal_sequence')
    .above(fromSeq)
    .filter(e => e.aggregate_id === orderId)
    .sortBy('terminal_sequence');
  
  console.log(`[Rebuild] Applying ${events.length} events`);
  
  for (const event of events) {
    const result = applySaleEvent(state, event as ParkEvent);
    state = result.state;
  }
  
  // 3. Crear nuevo snapshot si es necesario
  if (events.length > 0) {
    const lastSeq = events[events.length - 1]!.terminal_sequence;
    await maybeCreateSnapshot('ORDER', orderId, state, lastSeq);
  }
  
  return state;
}
```

**Beneficios:**
- ✅ Rebuild 100x más rápido
- ✅ Menos CPU/batería
- ✅ Mejor UX al abrir app

---

## 2) Índices de Base de Datos

### Problema

```sql
-- Query lento en producción
SELECT * FROM events 
WHERE tenant_id = ? 
  AND aggregate_id = ?
  AND occurred_at > ?
ORDER BY terminal_sequence;

-- ❌ Sin índice compuesto
```

### Solución: Índices Optimizados

**Migración Prisma:**
```prisma
// prisma/schema.prisma

model Event {
  // ... campos existentes
  
  @@index([tenant_id, aggregate_id, occurred_at(sort: Desc)])
  @@index([tenant_id, occurred_at(sort: Desc)])
  @@index([terminal_id, terminal_sequence])
}

model Order {
  // ... campos existentes
  
  @@index([tenant_id, order_status])
  @@index([tenant_id, unpaid_checks_count], where: "unpaid_checks_count > 0")
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
ON events(terminal_sequence) 
WHERE synced = 0;

-- Solo indexar órdenes activas
CREATE INDEX idx_orders_active 
ON orders(tenant_id, order_status, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- Solo indexar checks sin pagar
CREATE INDEX idx_orders_unpaid 
ON orders(tenant_id, unpaid_checks_count) 
WHERE unpaid_checks_count > 0;
```

---

## 3) Query Optimization

### Problema: N+1 Queries

```typescript
// ❌ Malo: 1 query por orden
for (const order of orders) {
  const invoice = await prisma.invoice.findFirst({
    where: { order_id: order.id }
  });
}
```

### Solución: Batch Loading

```typescript
// ✅ Bueno: 1 query total
const orderIds = orders.map(o => o.id);
const invoices = await prisma.invoice.findMany({
  where: { order_id: { in: orderIds } }
});

const invoiceMap = new Map(invoices.map(i => [i.order_id, i]));
const ordersWithInvoices = orders.map(o => ({
  ...o,
  invoice: invoiceMap.get(o.id),
}));
```

---

## 4) Caching Strategy

### Redis Cache para Catálogo

```typescript
// src/core/catalog/cache.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function getCatalog(tenantId: string) {
  // 1. Intentar cache
  const cached = await redis.get(`catalog:${tenantId}`);
  if (cached) {
    console.log('[Cache] Hit for catalog');
    return cached;
  }
  
  // 2. Fetch de DB
  const catalog = await prisma.product.findMany({
    where: { tenant_id: tenantId, is_active: true },
  });
  
  // 3. Guardar en cache (TTL 5 min)
  await redis.setex(`catalog:${tenantId}`, 300, catalog);
  
  return catalog;
}

// Invalidar cache al actualizar
export async function invalidateCatalogCache(tenantId: string) {
  await redis.del(`catalog:${tenantId}`);
}
```

---

## 5) Lazy Loading en UI

### Problema

```typescript
// ❌ Carga todo el historial al abrir
const allOrders = await db.orders.toArray();
```

### Solución: Paginación

```typescript
// ✅ Carga solo lo visible
const PAGE_SIZE = 20;

export function useOrderHistory(page: number) {
  return useLiveQuery(async () => {
    const orders = await db.orders
      .orderBy('created_at')
      .reverse()
      .offset(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray();
    
    return orders;
  }, [page]);
}
```

---

## 6) Web Workers para Rebuild

### Problema

```typescript
// ❌ Rebuild bloquea UI thread
const sale = await rebuildSale(orderId); // 5 segundos
```

### Solución: Web Worker

```typescript
// src/core/workers/rebuild.worker.ts
import { rebuildSale } from '@/src/core/projections/rebuild';

self.onmessage = async (e) => {
  const { orderId } = e.data;
  
  try {
    const sale = await rebuildSale(orderId);
    self.postMessage({ success: true, sale });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
```

```typescript
// Uso en UI
const worker = new Worker(new URL('./rebuild.worker.ts', import.meta.url));

worker.postMessage({ orderId });

worker.onmessage = (e) => {
  if (e.data.success) {
    setSale(e.data.sale);
  }
};
```

---

## 7) Connection Pooling

### Problema

```typescript
// ❌ Nueva conexión por request
const prisma = new PrismaClient();
```

### Solución: Pool Global

```typescript
// src/core/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Connection pool config
// DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=10"
```

---

## 8) Métricas de Performance

### Targets

| Métrica | Target | Crítico |
|---------|--------|---------|
| UI Response | < 50ms | < 100ms |
| Sync Latency | < 200ms | < 500ms |
| Rebuild (con snapshot) | < 1s | < 3s |
| API Ingest | < 100ms | < 300ms |
| KDS Update | < 50ms | < 100ms |

### Monitoring

```typescript
// Performance marks
performance.mark('rebuild-start');
const sale = await rebuildSale(orderId);
performance.mark('rebuild-end');

performance.measure('rebuild', 'rebuild-start', 'rebuild-end');

const measure = performance.getEntriesByName('rebuild')[0];
console.log(`Rebuild took ${measure.duration}ms`);

// Enviar a telemetría
rebuildLatency.record(measure.duration);
```

---

## 9) Prioridad

**Crítico (P0):**
1. Snapshots (3 días)
2. Índices DB (1 día)

**Importante (P1):**
3. Query Optimization (2 días)
4. Caching (2 días)

**Mejora (P2):**
5. Web Workers (2 días)
6. Lazy Loading (1 día)

**Total:** 11 días

