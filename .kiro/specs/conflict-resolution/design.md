# Design Document: Conflict Resolution

## Overview

Este documento describe el diseño técnico para implementar resolución de conflictos en PARK POS. El sistema usa Event Sourcing con múltiples terminales offline-first, lo que requiere estrategias específicas para detectar y resolver conflictos cuando los terminales sincronizan.

La estrategia principal es **Optimistic Locking con Merge Selectivo**:
- Items de orden → Merge automático
- Estados de items → Last-Write-Wins
- Pagos → Rechazo + intervención manual

## Architecture

### Diagrama de Flujo de Conflictos

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONFLICT RESOLUTION FLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Terminal A (offline)          Server              Terminal B (offline)  │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐   │
│  │ Order #123      │     │ Order #123      │     │ Order #123      │   │
│  │ revision: 5     │     │ revision: 5     │     │ revision: 5     │   │
│  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘   │
│           │                       │                       │             │
│           ▼                       │                       ▼             │
│  ┌─────────────────┐              │              ┌─────────────────┐   │
│  │ ADD_ITEM        │              │              │ ADD_ITEM        │   │
│  │ expected_rev: 5 │              │              │ expected_rev: 5 │   │
│  │ item: "Pollo"   │              │              │ item: "Papas"   │   │
│  └────────┬────────┘              │              └────────┬────────┘   │
│           │                       │                       │             │
│           │    ┌──────────────────┴──────────────────┐    │             │
│           └───►│         SYNC (A first)              │◄───┘             │
│                │  1. Check revision: 5 == 5 ✓        │                  │
│                │  2. Apply event, revision → 6       │                  │
│                └──────────────────┬──────────────────┘                  │
│                                   │                                      │
│                ┌──────────────────┴──────────────────┐                  │
│                │         SYNC (B second)             │                  │
│                │  1. Check revision: 5 != 6 ✗        │                  │
│                │  2. CONFLICT DETECTED               │                  │
│                │  3. Apply MERGE strategy            │                  │
│                │  4. Both items added, rev → 7       │                  │
│                └─────────────────────────────────────┘                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes Afectados

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONFLICT RESOLUTION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Prisma Schema  │    │   Conflict       │    │   Sync Client    │  │
│  │   + revision     │    │   Resolver       │    │   + refresh      │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                       │                       │             │
│           ▼                       ▼                       ▼             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        API Ingest                                 │  │
│  │  1. Validate revision                                            │  │
│  │  2. Detect conflict                                              │  │
│  │  3. Apply resolution strategy                                    │  │
│  │  4. Return conflict info in response                             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   Conflict Log   │    │   Soft Locks     │    │   Conflict UI    │  │
│  │   (auditoría)    │    │   (prevención)   │    │   (resolución)   │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Schema Changes - Order Revision

```prisma
// prisma/schema.prisma

model Order {
  // Campos existentes...
  
  // NUEVO: Revision para optimistic locking
  revision          Int       @default(1)
  
  // Índice para queries de conflicto
  @@index([tenant_id, id, revision])
}
```

### 2. Event Schema - Expected Revision

```typescript
// src/core/domain/events.ts

// Agregar a BaseEnvelopeSchema
export const BaseEnvelopeSchema = z.object({
  // Campos existentes...
  
  // NUEVO: Revision esperada para detección de conflictos
  expected_revision: z.number().int().nonnegative().nullish(),
});

// Agregar a OrderItemAddedPayload
const OrderItemAddedPayload = z.object({
  order_id: uuidSchema,
  line: OrderLineSchema,
  expected_revision: z.number().int().nonnegative().optional(), // Para conflictos
});
```

### 3. Conflict Log Table

```prisma
// prisma/schema.prisma

model ConflictLog {
  id                String    @id @default(uuid()) @db.Uuid
  tenant_id         String    @db.Uuid
  aggregate_type    String    // ORDER, SHIFT, etc.
  aggregate_id      String    @db.Uuid
  conflict_type     String    // REVISION_CONFLICT, PAYMENT_CONFLICT
  resolution        String    // MERGED, LWW, REJECTED, MANUAL
  
  // Eventos involucrados
  event_id          String    @db.Uuid
  expected_revision Int
  actual_revision   Int
  
  // Detalles
  local_state       Json?     // Estado que el cliente esperaba
  server_state      Json?     // Estado actual del servidor
  merged_state      Json?     // Estado después del merge (si aplica)
  
  // Metadata
  terminal_id       String
  resolved_by       String?   @db.Uuid  // Si fue manual
  resolved_at       DateTime  @default(now()) @db.Timestamptz
  
  @@index([tenant_id, aggregate_id, resolved_at(sort: Desc)])
  @@index([tenant_id, conflict_type])
  @@map("conflict_logs")
}
```

### 4. Soft Lock Table

```prisma
// prisma/schema.prisma

model SoftLock {
  id            String    @id @default(uuid()) @db.Uuid
  tenant_id     String    @db.Uuid
  aggregate_type String   // ORDER, SHIFT
  aggregate_id  String    @db.Uuid
  terminal_id   String
  locked_at     DateTime  @default(now()) @db.Timestamptz
  expires_at    DateTime  @db.Timestamptz
  
  @@unique([tenant_id, aggregate_type, aggregate_id])
  @@index([expires_at])
  @@map("soft_locks")
}
```

### 5. Conflict Resolver Service

```typescript
// src/core/conflict/conflict-resolver.ts

import { PrismaClient, Prisma } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";

export type ConflictType = 
  | "REVISION_CONFLICT" 
  | "PAYMENT_CONFLICT" 
  | "STATE_CONFLICT";

export type ResolutionStrategy = 
  | "MERGE" 
  | "LWW" 
  | "REJECT" 
  | "MANUAL";

export interface ConflictInfo {
  type: ConflictType;
  aggregate_id: string;
  expected_revision: number;
  actual_revision: number;
  resolution: ResolutionStrategy;
  merged_state?: unknown;
  rejected_reason?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: ConflictInfo;
  shouldApply: boolean;
  mergedEvent?: ParkEvent;
}

export async function detectAndResolveConflict(
  tx: Prisma.TransactionClient,
  event: ParkEvent,
  currentRevision: number
): Promise<ConflictResult> {
  const expectedRevision = (event as any).expected_revision ?? 
                           (event.payload as any).expected_revision;
  
  // No revision check = no conflict detection
  if (expectedRevision === undefined || expectedRevision === null) {
    return { hasConflict: false, shouldApply: true };
  }
  
  // Revision matches = no conflict
  if (expectedRevision === currentRevision) {
    return { hasConflict: false, shouldApply: true };
  }
  
  // CONFLICT DETECTED
  console.log(`[Conflict] Detected: expected=${expectedRevision}, actual=${currentRevision}`);
  
  // Determine resolution strategy based on event type
  const strategy = getResolutionStrategy(event.event_type);
  
  switch (strategy) {
    case "MERGE":
      return await resolveMerge(tx, event, currentRevision, expectedRevision);
    
    case "LWW":
      return await resolveLWW(tx, event, currentRevision, expectedRevision);
    
    case "REJECT":
      return await resolveReject(tx, event, currentRevision, expectedRevision);
    
    default:
      return { 
        hasConflict: true, 
        shouldApply: false,
        conflict: {
          type: "REVISION_CONFLICT",
          aggregate_id: event.aggregate_id,
          expected_revision: expectedRevision,
          actual_revision: currentRevision,
          resolution: "REJECT",
          rejected_reason: "Unknown event type for conflict resolution",
        }
      };
  }
}

function getResolutionStrategy(eventType: string): ResolutionStrategy {
  // Items → MERGE (no perder datos)
  if (eventType === "ORDER_ITEM_ADDED" || eventType === "ORDER_ITEM_QTY_CHANGED") {
    return "MERGE";
  }
  
  // Estados → LWW (último gana)
  if (eventType === "ORDER_ITEM_STATUS_CHANGED") {
    return "LWW";
  }
  
  // Pagos → REJECT (requiere intervención)
  if (eventType.includes("PAYMENT") || eventType === "CHECK_MARKED_PAID") {
    return "REJECT";
  }
  
  // Default: LWW
  return "LWW";
}

async function resolveMerge(
  tx: Prisma.TransactionClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  // Para ORDER_ITEM_ADDED: simplemente aplicar el item
  // El merge real ocurre porque ambos items se agregan
  
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "REVISION_CONFLICT",
    resolution: "MERGED",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  return {
    hasConflict: true,
    shouldApply: true, // Aplicar de todas formas (merge)
    conflict: {
      type: "REVISION_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "MERGE",
    }
  };
}

async function resolveLWW(
  tx: Prisma.TransactionClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  // Para LWW, siempre aplicamos el evento más reciente
  // El servidor ya tiene eventos anteriores aplicados
  // Este evento es más reciente (llegó después)
  
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "REVISION_CONFLICT",
    resolution: "LWW",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  return {
    hasConflict: true,
    shouldApply: true,
    conflict: {
      type: "REVISION_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "LWW",
    }
  };
}

async function resolveReject(
  tx: Prisma.TransactionClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "PAYMENT_CONFLICT",
    resolution: "REJECTED",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  return {
    hasConflict: true,
    shouldApply: false, // NO aplicar
    conflict: {
      type: "PAYMENT_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "REJECT",
      rejected_reason: "Payment conflicts require manual resolution",
    }
  };
}

async function logConflict(
  tx: Prisma.TransactionClient,
  data: {
    tenant_id: string;
    aggregate_type: string;
    aggregate_id: string;
    conflict_type: string;
    resolution: string;
    event_id: string;
    expected_revision: number;
    actual_revision: number;
    terminal_id: string;
  }
) {
  await tx.conflictLog.create({ data });
}
```

### 6. Soft Lock Service

```typescript
// src/core/conflict/soft-lock.service.ts

import { PrismaClient } from "@prisma/client";

const LOCK_TTL_MS = 30000; // 30 seconds

export interface LockInfo {
  isLocked: boolean;
  lockedBy?: string;
  expiresAt?: Date;
  remainingMs?: number;
}

export async function acquireSoftLock(
  prisma: PrismaClient,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<LockInfo> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);
  
  try {
    // Try to create or update lock
    await prisma.softLock.upsert({
      where: {
        tenant_id_aggregate_type_aggregate_id: {
          tenant_id: tenantId,
          aggregate_type: aggregateType,
          aggregate_id: aggregateId,
        }
      },
      create: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        terminal_id: terminalId,
        locked_at: now,
        expires_at: expiresAt,
      },
      update: {
        terminal_id: terminalId,
        locked_at: now,
        expires_at: expiresAt,
      },
    });
    
    return { isLocked: false };
  } catch (e) {
    // Check if locked by another terminal
    const existing = await prisma.softLock.findUnique({
      where: {
        tenant_id_aggregate_type_aggregate_id: {
          tenant_id: tenantId,
          aggregate_type: aggregateType,
          aggregate_id: aggregateId,
        }
      }
    });
    
    if (existing && existing.expires_at > now && existing.terminal_id !== terminalId) {
      return {
        isLocked: true,
        lockedBy: existing.terminal_id,
        expiresAt: existing.expires_at,
        remainingMs: existing.expires_at.getTime() - now.getTime(),
      };
    }
    
    return { isLocked: false };
  }
}

export async function releaseSoftLock(
  prisma: PrismaClient,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<void> {
  await prisma.softLock.deleteMany({
    where: {
      tenant_id: tenantId,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      terminal_id: terminalId,
    }
  });
}

export async function checkSoftLock(
  prisma: PrismaClient,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<LockInfo> {
  const now = new Date();
  
  const existing = await prisma.softLock.findUnique({
    where: {
      tenant_id_aggregate_type_aggregate_id: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
      }
    }
  });
  
  if (!existing || existing.expires_at <= now) {
    return { isLocked: false };
  }
  
  if (existing.terminal_id === terminalId) {
    return { isLocked: false }; // Own lock
  }
  
  return {
    isLocked: true,
    lockedBy: existing.terminal_id,
    expiresAt: existing.expires_at,
    remainingMs: existing.expires_at.getTime() - now.getTime(),
  };
}

// Cleanup expired locks (run periodically)
export async function cleanupExpiredLocks(prisma: PrismaClient): Promise<number> {
  const result = await prisma.softLock.deleteMany({
    where: {
      expires_at: { lt: new Date() }
    }
  });
  return result.count;
}
```

### 7. Updated Ingest Route

```typescript
// src/app/api/events/ingest/route.ts (modificaciones)

import { detectAndResolveConflict, type ConflictInfo } from "@/src/core/conflict/conflict-resolver";

// En la función POST, después de validación:

// Dentro del loop de eventos:
for (const ev of events as ParkEvent[]) {
  // ... validación existente ...
  
  // NUEVO: Detectar conflictos para eventos de ORDER
  if (ev.aggregate_type === "ORDER") {
    const order = await tx.order.findUnique({
      where: { id: ev.aggregate_id },
      select: { revision: true }
    });
    
    if (order) {
      const conflictResult = await detectAndResolveConflict(
        tx, 
        ev, 
        order.revision
      );
      
      if (conflictResult.hasConflict) {
        if (!conflictResult.shouldApply) {
          // Rechazado - agregar a rejected[]
          rejected.push({
            event_id: ev.event_id,
            error: conflictResult.conflict!.type,
            details: {
              expected_revision: conflictResult.conflict!.expected_revision,
              actual_revision: conflictResult.conflict!.actual_revision,
              resolution: conflictResult.conflict!.resolution,
              reason: conflictResult.conflict!.rejected_reason,
            }
          });
          continue; // Skip this event
        }
        
        // Merged - agregar a merged[]
        merged.push({
          event_id: ev.event_id,
          merge_type: conflictResult.conflict!.resolution,
        });
      }
    }
  }
  
  // ... resto del procesamiento ...
  
  // NUEVO: Incrementar revision después de proyectar
  if (ev.aggregate_type === "ORDER") {
    await tx.order.update({
      where: { id: ev.aggregate_id },
      data: { revision: { increment: 1 } }
    });
  }
}

// En la respuesta:
return NextResponse.json({
  accepted: true,
  tenant_id,
  terminal_id,
  acked_through_terminal_sequence: to_terminal_sequence,
  deduped_event_ids,
  rejected,
  merged, // NUEVO
});
```

### 8. Order State Endpoint

```typescript
// src/app/api/orders/[orderId]/state/route.ts

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  
  // Auth check
  const secret = req.headers.get("x-api-secret");
  if (secret !== process.env.PARK_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shift: { select: { id: true, status: true } },
    }
  });
  
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  
  return NextResponse.json({
    order: {
      id: order.id,
      tenant_id: order.tenant_id,
      order_number: order.order_number,
      order_type: order.order_type,
      order_status: order.order_status,
      items: order.items,
      checks: order.checks,
      subtotal_cents: order.subtotal_cents,
      discount_cents: order.discount_cents,
      total_cents: order.total_cents,
      revision: order.revision,
      updated_at: order.updated_at,
    },
    revision: order.revision,
    last_updated_at: order.updated_at,
  });
}
```

### 9. Sync Client Updates

```typescript
// src/core/sync/client.ts (modificaciones)

// Agregar al tipo IngestResponse:
export type IngestResponse = {
  // ... campos existentes ...
  merged?: Array<{ event_id: string; merge_type: string }>;
};

// Agregar método para refresh de orden:
async refreshOrder(orderId: string): Promise<Order | null> {
  try {
    const resp = await fetch(`/api/orders/${orderId}/state`, {
      headers: {
        "x-api-secret": "park_secret_mvp_2025"
      }
    });
    
    if (!resp.ok) return null;
    
    const data = await resp.json();
    
    // Actualizar estado local
    await db.transaction('rw', db.orders, async () => {
      await db.orders.put({
        ...data.order,
        synced: 1,
      });
    });
    
    return data.order;
  } catch (e) {
    console.error("[Sync] Failed to refresh order:", e);
    return null;
  }
}

// En syncOnce, manejar conflictos:
if (resp.rejected && resp.rejected.length > 0) {
  for (const rejection of resp.rejected) {
    if (rejection.error === "REVISION_CONFLICT" || rejection.error === "PAYMENT_CONFLICT") {
      // Refresh the order from server
      const orderId = rejection.details?.aggregate_id;
      if (orderId) {
        await this.refreshOrder(orderId);
      }
      
      // Notify UI
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("conflict-detected", {
          detail: rejection
        }));
      }
    }
  }
}
```

## Data Models

### Diagrama ER - Conflict Resolution

```
┌─────────────────┐
│     Order       │
├─────────────────┤
│ id              │
│ revision    ◄───┼──── Incrementa con cada evento
│ ...             │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  ConflictLog    │
├─────────────────┤
│ id              │
│ aggregate_id    │
│ conflict_type   │
│ resolution      │
│ expected_rev    │
│ actual_rev      │
│ terminal_id     │
│ resolved_at     │
└─────────────────┘

┌─────────────────┐
│   SoftLock      │
├─────────────────┤
│ id              │
│ aggregate_id    │
│ terminal_id     │
│ expires_at      │
└─────────────────┘
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Revision Consistency

*For any* Order and any sequence of events applied to it, the Order's `revision` SHALL equal the count of events successfully applied to that Order.

**Validates: Requirements 1.1, 1.4, 2.6**

### Property 2: Conflict Detection Accuracy

*For any* event with `expected_revision` that differs from the Order's current `revision`, the system SHALL detect and report a conflict.

**Validates: Requirements 1.3, 1.4, 1.6**

### Property 3: Merge Preserves All Items

*For any* two ORDER_ITEM_ADDED events with conflicting revisions applied to the same Order, the resulting Order SHALL contain both items (no data loss).

**Validates: Requirements 2.1, 2.2, 2.4**

### Property 4: Merge Combines Duplicate Items

*For any* two ORDER_ITEM_ADDED events with the same product_id and modifiers, the resulting Order SHALL have a single line with quantity equal to the sum of both quantities.

**Validates: Requirements 2.3**

### Property 5: Last-Write-Wins by Timestamp

*For any* two ORDER_ITEM_STATUS_CHANGED events with conflicting revisions, the event with the later `occurred_at` timestamp SHALL determine the final state.

**Validates: Requirements 3.1, 3.3**

### Property 6: State Transition Validity

*For any* ORDER_ITEM_STATUS_CHANGED event, the system SHALL reject transitions that violate the state machine (e.g., DONE→PENDING, READY→COOKING).

**Validates: Requirements 3.6**

### Property 7: Payment Conflict Rejection

*For any* CHECK_PAYMENT_ADDED or CHECK_MARKED_PAID event with a revision conflict, the system SHALL reject the event and NOT apply the payment.

**Validates: Requirements 4.1, 4.4**

### Property 8: Conflict Log Completeness

*For any* detected conflict (regardless of resolution strategy), there SHALL exist a corresponding entry in `conflict_log` with the correct conflict_type and resolution.

**Validates: Requirements 1.5, 2.5, 3.5, 4.5**

### Property 9: Response Structure Correctness

*For any* rejected event due to conflict, the IngestResponse SHALL include the event in `rejected[]` with event_id, error_code, expected_revision, and actual_revision.

**Validates: Requirements 5.1, 5.2**

### Property 10: Soft Lock TTL Expiration

*For any* SoftLock, after the TTL (30 seconds) has elapsed, the lock SHALL be considered expired and not block other terminals.

**Validates: Requirements 8.5, 8.6**

### Property 11: Conflict Event Round-Trip

*For any* valid conflict event (CONFLICT_DETECTED, CONFLICT_AUTO_RESOLVED, CONFLICT_REJECTED), serializing then deserializing SHALL produce an equivalent event.

**Validates: Requirements 9.1-9.4**

## Error Handling

### Errores de Conflicto

| Código | Descripción | Estrategia | Acción Cliente |
|--------|-------------|------------|----------------|
| `REVISION_CONFLICT` | Revisión no coincide | MERGE o LWW | Refresh orden |
| `PAYMENT_CONFLICT` | Conflicto en pago | REJECT | Mostrar UI manual |
| `STATE_CONFLICT` | Transición inválida | REJECT | Refresh orden |
| `LOCK_HELD` | Otro terminal editando | WARN | Mostrar advertencia |

### Manejo de Errores en Cliente

```typescript
// Cuando se recibe REVISION_CONFLICT
if (rejection.error === "REVISION_CONFLICT") {
  // 1. Refresh orden desde servidor
  await syncClient.refreshOrder(orderId);
  
  // 2. Re-aplicar eventos locales pendientes
  const localPending = await db.events
    .where({ aggregate_id: orderId, synced: 0 })
    .toArray();
  
  // 3. Si falla, descartar y notificar
  if (localPending.length > 0) {
    toast.warning("Cambios locales descartados por conflicto");
  }
}

// Cuando se recibe PAYMENT_CONFLICT
if (rejection.error === "PAYMENT_CONFLICT") {
  // Mostrar modal de resolución manual
  showConflictResolutionModal({
    type: "PAYMENT",
    orderId,
    localState: rejection.details.local_state,
    serverState: rejection.details.server_state,
  });
}
```

## Testing Strategy

### Unit Tests

- Validación de schemas Zod para eventos con `expected_revision`
- Lógica de detección de conflictos (expected vs actual)
- Lógica de merge para items duplicados
- Lógica de LWW con timestamps
- Validación de transiciones de estado

### Property-Based Tests

Se usará **fast-check** para validar las 11 propiedades definidas:

```typescript
// Ejemplo: Property 3 - Merge Preserves All Items
import fc from 'fast-check';

describe('Conflict Resolution Properties', () => {
  it('merge preserves all items', () => {
    fc.assert(
      fc.property(
        fc.uuid(),                    // orderId
        orderLineArb,                 // item1
        orderLineArb,                 // item2
        fc.integer({ min: 1, max: 100 }), // revision
        async (orderId, item1, item2, revision) => {
          // Setup: Create order with revision
          const order = await createTestOrder(orderId, revision);
          
          // Create two conflicting events
          const event1 = createItemAddedEvent(orderId, item1, revision);
          const event2 = createItemAddedEvent(orderId, item2, revision);
          
          // Apply both with conflict resolution
          await applyWithConflictResolution(event1);
          await applyWithConflictResolution(event2);
          
          // Verify both items exist
          const finalOrder = await getOrder(orderId);
          const hasItem1 = finalOrder.items.some(i => i.line_id === item1.line_id);
          const hasItem2 = finalOrder.items.some(i => i.line_id === item2.line_id);
          
          return hasItem1 && hasItem2;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

- Flujo completo: Terminal A offline → Terminal B offline → Ambos sync → Merge
- Flujo de pago con conflicto → Rechazo → UI manual → Resolución
- Soft lock: Terminal A edita → Terminal B intenta → Warning → TTL expira → Terminal B puede editar

## Migration Strategy

### Fase 1: Schema Changes

1. Agregar campo `revision` a Order (default 1)
2. Crear tabla `conflict_log`
3. Crear tabla `soft_locks`

### Fase 2: Backend Updates

1. Modificar ingest para detectar conflictos
2. Implementar conflict resolver
3. Implementar soft lock service
4. Crear endpoint de refresh

### Fase 3: Client Updates

1. Agregar `expected_revision` a eventos
2. Manejar respuestas con conflictos
3. Implementar refresh de órdenes

### Fase 4: UI Updates

1. Toast de conflictos
2. Modal de resolución manual
3. Indicador de soft lock
