# Design Document: Enterprise Upgrade

## Overview

Este diseño completa los gaps críticos identificados en AUDITORIA_CRITICA.md y GAPS.md, sin duplicar funcionalidad ya implementada. Se integra con el código existente:

**Problemas específicos a resolver (con ubicación exacta):**
- `src/core/sync/client.ts:91` - tenant_id hardcodeado como `"00000000-0000-0000-0000-000000000001"`
- `src/core/sync/client.ts:175` - API secret hardcodeado como `"park_secret_mvp_2025"`
- `src/core/projections/sale.reducer.ts` - Muta estado directamente (Problema #5 AUDITORIA_CRITICA.md)

**Código existente a extender:**
- `src/core/auth/fingerprint.ts` - Device fingerprinting (ya existe)
- `src/core/auth/session.ts` - Manejo de sesiones (ya existe)
- `src/core/sync/client.ts` - SyncClient (eliminar hardcodes líneas 91 y 175)
- `src/core/sync/circuit-breaker.ts` - Circuit breaker ✅ ya implementado
- `src/core/middleware/rate-limit.ts` - Rate limiting ✅ ya implementado
- `src/core/projections/sale.reducer.ts` - Refactorizar para inmutabilidad
- `src/app/api/auth/register-terminal/route.ts` - Extender con Device Token
- `src/app/api/events/ingest/route.ts` - Agregar occurred_at_server

**Nuevos módulos a crear:**
- `src/core/auth/device-token.ts` - Generación y validación de tokens
- `src/core/snapshots/adaptive.ts` - Sistema de snapshots (threshold: 50KB o 500 eventos)
- `src/core/events/versioning.ts` - Migraciones de schema
- `src/core/metrics/system-metrics.ts` - Observabilidad
- `src/core/conflicts/resolver.ts` - Resolución de conflictos con Optimistic Locking

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARK POS Enterprise                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Terminal  │  │   Terminal  │  │     KDS     │             │
│  │   (Caja)    │  │   (Mozo)    │  │  (Cocina)   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐             │
│  │         Auth Layer (Device Tokens)            │             │
│  │  • Extiende fingerprint.ts existente          │             │
│  │  • Reemplaza x-api-secret hardcodeado         │             │
│  │  • Integra con register-terminal/route.ts     │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────┐             │
│  │         Clock Skew Handler (NUEVO)            │             │
│  │  • occurred_at_server asignado en ingest      │             │
│  │  • occurred_at_client preservado              │             │
│  │  • Warning si drift > 5 min                   │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────┐             │
│  │      Conflict Resolution (Optimistic Lock)    │             │
│  │  • Campo revision en órdenes                  │             │
│  │  • expected_revision en eventos               │             │
│  │  • UI de resolución manual                    │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────┐             │
│  │      Immutable Reducers (REFACTOR)            │             │
│  │  • sale.reducer.ts con spread operators       │             │
│  │  • Object.freeze en dev mode                  │             │
│  │  • Sin mutaciones directas                    │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────┐             │
│  │         Adaptive Snapshots (NUEVO)            │             │
│  │  • Trigger: >50KB OR >500 eventos             │             │
│  │  • Auto-snapshot al cerrar orden              │             │
│  │  • Rebuild optimizado                         │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────▼───────────────────────┐             │
│  │    Existing Infrastructure (NO CAMBIAR)       │             │
│  │  • Circuit Breaker ✓                          │             │
│  │  • Rate Limiting ✓                            │             │
│  │  • Outbox Pattern ✓                           │             │
│  │  • Event Deduplication ✓                      │             │
│  └───────────────────────┬───────────────────────┘             │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      PostgreSQL                                  │
│  • events, snapshots, device_tokens, system_metrics             │
│  • Índices existentes (ya optimizados)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Clock Skew Handler

```typescript
// src/app/api/events/ingest/route.ts (modificar)
// Agregar estos campos al procesar cada evento

interface EnrichedEvent extends ParkEvent {
  occurred_at_client: string;  // Original del terminal (preservar)
  occurred_at_server: string;  // Asignado por servidor (nuevo)
  clock_drift_ms?: number;     // Diferencia detectada (para logging)
}

async function enrichEventWithServerTimestamp(event: ParkEvent): Promise<EnrichedEvent> {
  const serverNow = new Date();
  const clientTime = new Date(event.occurred_at);
  const driftMs = serverNow.getTime() - clientTime.getTime();
  
  // Warning si drift > 5 minutos (300,000 ms)
  if (Math.abs(driftMs) > 5 * 60 * 1000) {
    console.warn(`[ClockSkew] Terminal ${event.terminal_id} drift: ${driftMs}ms`);
    // TODO: Enviar a sistema de métricas cuando esté implementado
  }
  
  return {
    ...event,
    occurred_at_client: event.occurred_at,
    occurred_at_server: serverNow.toISOString(),
    clock_drift_ms: driftMs,
  };
}
```

### 2. Device Token System (Extender auth existente)

```typescript
// src/core/auth/device-token.ts
import { generateFingerprint } from './fingerprint';
import crypto from 'crypto';

interface DeviceToken {
  token: string;           // 256-bit hex string
  terminal_id: string;
  tenant_id: string;
  device_fingerprint: string;
  created_at: Date;
  expires_at: Date;
}

export async function generateDeviceToken(
  terminal_id: string,
  tenant_id: string
): Promise<DeviceToken> {
  const fingerprint = await generateFingerprint();
  const token = crypto.randomBytes(32).toString('hex');
  
  return {
    token,
    terminal_id,
    tenant_id,
    device_fingerprint: fingerprint,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
  };
}

export async function validateDeviceToken(
  token: string,
  expectedFingerprint: string
): Promise<{ valid: boolean; error?: string }> {
  const stored = await prisma.deviceToken.findUnique({ where: { token } });
  
  if (!stored) return { valid: false, error: 'TOKEN_NOT_FOUND' };
  if (stored.revoked) return { valid: false, error: 'TOKEN_REVOKED' };
  if (new Date() > stored.expires_at) return { valid: false, error: 'TOKEN_EXPIRED' };
  if (stored.device_fingerprint !== expectedFingerprint) {
    return { valid: false, error: 'FINGERPRINT_MISMATCH' };
  }
  
  return { valid: true };
}
```

### 3. Immutable Reducer Pattern (Refactor de sale.reducer.ts)

```typescript
// src/core/projections/sale.reducer.ts (refactorizado)

// ANTES (mutación directa):
// sale.lines[line_id] = { ... };
// sale.subtotal_cents = computeSubtotal(sale.lines);

// DESPUÉS (inmutable):
case "ORDER_ITEM_ADDED": {
  const { line } = e.payload;
  const { line_id, product_id, name, qty, unit_price_cents, status } = line;
  const prev = sale.lines[line_id];

  const newQty = (prev?.qty ?? 0) + qty;
  const line_total_cents = newQty * unit_price_cents;

  const newLine: SaleLine = {
    line_id,
    product_id,
    name: name || prev?.name || "Unknown",
    qty: newQty,
    unit_price_cents,
    line_total_cents,
    status: status ?? prev?.status ?? "PENDING",
  };

  const newLines = {
    ...sale.lines,
    [line_id]: newLine,
  };

  const newSubtotal = computeSubtotal(newLines);

  // Actualizar checks de forma inmutable
  const newChecks = sale.checks.map(check => {
    if (check.payment?.status === "PAID") return check;
    
    const existingLineIdx = check.lines.findIndex(l => l.line_id === line_id);
    const newCheckLines = existingLineIdx >= 0
      ? check.lines.map((l, i) => i === existingLineIdx ? { ...l, qty: newQty } : l)
      : [...check.lines, { line_id, qty: newQty }];
    
    const checkSubtotal = newCheckLines.reduce((sum, l) => {
      const masterLine = newLines[l.line_id];
      return sum + (masterLine ? masterLine.unit_price_cents * l.qty : 0);
    }, 0);
    
    return {
      ...check,
      lines: newCheckLines,
      subtotal_cents: checkSubtotal,
      total_cents: checkSubtotal,
    };
  });

  return {
    state: {
      ...sale,
      lines: newLines,
      subtotal_cents: newSubtotal,
      checks: newChecks,
      last_event_sequence: e.terminal_sequence,
    },
    warnings,
  };
}

// Helper para desarrollo
function freezeInDev<T>(obj: T): T {
  if (process.env.NODE_ENV === 'development') {
    return Object.freeze(obj) as T;
  }
  return obj;
}
```

### 4. Conflict Resolution (Optimistic Locking)

```typescript
// src/core/conflicts/resolver.ts
interface ConflictInfo {
  order_id: string;
  local_revision: number;
  server_revision: number;
  local_state: SaleProjection;
  server_state: SaleProjection;
  conflicting_events: ParkEvent[];
}

interface ConflictResolution {
  strategy: 'USE_LOCAL' | 'USE_SERVER' | 'MERGE';
  resolved_state?: SaleProjection;
  resolution_event: ParkEvent;
}

export async function detectConflict(
  event: ParkEvent,
  expectedRevision: number
): Promise<ConflictInfo | null> {
  if (!('expected_revision' in event.payload)) return null;
  
  const order = await prisma.order.findUnique({
    where: { id: event.payload.order_id }
  });
  
  if (!order) return null;
  if (order.revision === expectedRevision) return null;
  
  return {
    order_id: order.id,
    local_revision: expectedRevision,
    server_revision: order.revision,
    local_state: event.payload.local_state,
    server_state: await rebuildSale(order.id),
    conflicting_events: await getEventsSinceRevision(order.id, expectedRevision),
  };
}

export function mergeStates(
  local: SaleProjection,
  server: SaleProjection
): SaleProjection {
  // Merge items: unión de ambos conjuntos
  const mergedLines: Record<string, SaleLine> = { ...server.lines };
  
  for (const [lineId, localLine] of Object.entries(local.lines)) {
    if (!mergedLines[lineId]) {
      // Item solo en local, agregar
      mergedLines[lineId] = localLine;
    } else {
      // Item en ambos, usar mayor cantidad (nunca perder items)
      mergedLines[lineId] = {
        ...mergedLines[lineId],
        qty: Math.max(mergedLines[lineId].qty, localLine.qty),
      };
    }
  }
  
  return {
    ...server,
    lines: mergedLines,
    subtotal_cents: computeSubtotal(mergedLines),
    revision: server.revision + 1,
  };
}
```

### 5. Adaptive Snapshot System

```typescript
// src/core/snapshots/adaptive.ts
interface SnapshotConfig {
  maxStateSizeBytes: number;      // 50KB default
  maxEventsSinceSnapshot: number; // 500 default
  triggerOnOrderClose: boolean;   // true default
}

const DEFAULT_CONFIG: SnapshotConfig = {
  maxStateSizeBytes: 50 * 1024,  // 50KB
  maxEventsSinceSnapshot: 500,
  triggerOnOrderClose: true,
};

export function shouldCreateSnapshot(
  state: SaleProjection,
  eventCount: number,
  config: SnapshotConfig = DEFAULT_CONFIG
): boolean {
  const stateSize = JSON.stringify(state).length;
  
  // Trigger por tamaño
  if (stateSize > config.maxStateSizeBytes) return true;
  
  // Trigger por cantidad de eventos
  if (eventCount > config.maxEventsSinceSnapshot) return true;
  
  // Trigger al cerrar orden
  if (config.triggerOnOrderClose && 
      (state.status === 'CONFIRMED' || state.status === 'CANCELLED')) {
    return true;
  }
  
  return false;
}

export async function createSnapshot(
  orderId: string,
  state: SaleProjection,
  lastEventId: string
): Promise<void> {
  await prisma.snapshot.create({
    data: {
      id: crypto.randomUUID(),
      order_id: orderId,
      tenant_id: state.tenant_id,
      state: state as any,
      last_event_id: lastEventId,
      created_at: new Date(),
    },
  });
}

export async function rebuildFromSnapshot(orderId: string): Promise<SaleProjection | null> {
  // 1. Buscar último snapshot
  const snapshot = await prisma.snapshot.findFirst({
    where: { order_id: orderId },
    orderBy: { created_at: 'desc' },
  });
  
  let state = snapshot?.state as SaleProjection | null;
  const fromEventId = snapshot?.last_event_id;
  
  // 2. Aplicar eventos posteriores al snapshot
  const events = await prisma.event.findMany({
    where: {
      aggregate_id: orderId,
      ...(fromEventId ? { id: { gt: fromEventId } } : {}),
    },
    orderBy: { occurred_at_server: 'asc' },
  });
  
  for (const event of events) {
    const result = applySaleEvent(state, event as ParkEvent);
    state = result.state;
  }
  
  return state;
}
```

### 6. Event Schema Versioning

```typescript
// src/core/events/versioning.ts
const CURRENT_SCHEMA_VERSION = 2;

interface VersionedEvent extends ParkEvent {
  schema_version: number;
  _original_payload?: unknown;
}

type EventMigrator = (event: VersionedEvent) => VersionedEvent;

const migrations: Record<number, EventMigrator> = {
  // v1 -> v2: Agregar occurred_at_server
  2: (event) => {
    if (!event.occurred_at_server) {
      return {
        ...event,
        occurred_at_server: event.occurred_at,
        occurred_at_client: event.occurred_at,
        schema_version: 2,
        _original_payload: event._original_payload || event.payload,
      };
    }
    return { ...event, schema_version: 2 };
  },
};

export function migrateEvent(event: ParkEvent): VersionedEvent {
  let current: VersionedEvent = {
    ...event,
    schema_version: (event as any).schema_version || 1,
  };
  
  // Aplicar migraciones incrementales
  for (let v = current.schema_version + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    if (migrations[v]) {
      current = migrations[v](current);
    }
  }
  
  return current;
}

// Idempotencia: migrar múltiples veces produce mismo resultado
export function isMigrationIdempotent(event: ParkEvent): boolean {
  const once = migrateEvent(event);
  const twice = migrateEvent(once);
  return JSON.stringify(once) === JSON.stringify(twice);
}
```

## Data Models

### PostgreSQL Schema Additions

```prisma
// prisma/schema.prisma additions

model DeviceToken {
  id                 String   @id @default(uuid())
  token              String   @unique
  terminal_id        String
  tenant_id          String
  device_fingerprint String
  created_at         DateTime @default(now())
  expires_at         DateTime
  revoked            Boolean  @default(false)
  revoked_at         DateTime?
  
  @@index([terminal_id])
  @@index([tenant_id])
}

model Snapshot {
  id            String   @id @default(uuid())
  order_id      String
  tenant_id     String
  state         Json
  last_event_id String
  created_at    DateTime @default(now())
  
  @@index([order_id, created_at(sort: Desc)])
  @@index([tenant_id])
}

model SystemMetric {
  id            String   @id @default(uuid())
  tenant_id     String
  metric_name   String
  metric_value  Float
  terminal_id   String?
  recorded_at   DateTime @default(now())
  
  @@index([tenant_id, metric_name, recorded_at])
}

// Modificar Event existente
model Event {
  // ... campos existentes ...
  occurred_at_client DateTime? @db.Timestamptz
  occurred_at_server DateTime  @default(now()) @db.Timestamptz
  schema_version     Int       @default(1)
  clock_drift_ms     Int?
}

// Modificar Order existente
model Order {
  // ... campos existentes ...
  revision Int @default(0)
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Clock Skew Bounded
*For any* event, the absolute difference between `occurred_at_client` and `occurred_at_server` SHALL be recorded, and events with drift > 5 minutes SHALL generate warnings.
**Validates: Requirements 1.1, 1.4**

### Property 2: Device Token Uniqueness
*For any* two different device fingerprints, the generated Device_Tokens SHALL be different.
**Validates: Requirements 2.1**

### Property 3: Reducer Immutability
*For any* state S and event E, applying the reducer SHALL produce a new state S' where S remains unchanged (no mutation).
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: State Serialization Round-Trip
*For any* valid SaleState, JSON.stringify then JSON.parse SHALL produce an equivalent state.
**Validates: Requirements 4.6**

### Property 5: Optimistic Lock Detection
*For any* event with `expected_revision` different from current `revision`, the system SHALL detect and report a conflict.
**Validates: Requirements 5.2, 5.3**

### Property 6: Merge Preserves Items
*For any* merge of two states, all items present in either state SHALL be present in the merged result.
**Validates: Requirements 5.5**

### Property 7: Snapshot Rebuild Equivalence
*For any* order with a snapshot, rebuilding from snapshot + subsequent events SHALL produce the same state as rebuilding from all events.
**Validates: Requirements 6.3**

### Property 8: Event Migration Idempotence
*For any* event E, migrate(migrate(E)) SHALL equal migrate(E).
**Validates: Requirements 7.5**

## Error Handling

### Clock Skew Errors
| Condition | Action |
|-----------|--------|
| Drift > 5 min | Log warning, continue processing |
| Drift > 1 hour | Log error, flag terminal for review |

### Conflict Errors
| Error Code | HTTP Status | Description | Client Action |
|------------|-------------|-------------|---------------|
| REVISION_CONFLICT | 409 | Orden modificada por otro terminal | Mostrar UI de resolución |

### Authentication Errors
| Error Code | HTTP Status | Description | Client Action |
|------------|-------------|-------------|---------------|
| DEVICE_TOKEN_INVALID | 401 | Token no encontrado | Re-registrar terminal |
| FINGERPRINT_MISMATCH | 401 | Fingerprint no coincide | Re-registrar terminal |

## Testing Strategy

### Unit Tests
- Funciones de migración de eventos
- Lógica de detección de conflictos
- Cálculos de merge de estados
- Validación de Device Token

### Property-Based Tests (fast-check)
8 propiedades críticas con mínimo 100 iteraciones cada una:

```typescript
// Ejemplo: Property 3 - Reducer Immutability
import * as fc from 'fast-check';

describe('Reducer Immutability', () => {
  it('does not mutate original state', () => {
    fc.assert(
      fc.property(
        arbitrarySaleState(),
        arbitraryEvent(),
        (state, event) => {
          const originalJson = JSON.stringify(state);
          const result = applySaleEvent(state, event);
          const afterJson = JSON.stringify(state);
          
          // Estado original no debe cambiar
          return originalJson === afterJson;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests
- Flujo completo de autenticación con Device Token
- Detección y resolución de conflictos
- Rebuild de proyecciones desde snapshots
