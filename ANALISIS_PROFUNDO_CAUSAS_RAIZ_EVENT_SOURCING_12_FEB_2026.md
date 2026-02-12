# 🔴 Análisis Profundo: Causas Raíz de 8 Tests E2E Críticos Fallando

**Fecha:** 12 Febrero 2026  
**Analista:** Kiro AI  
**Prioridad:** 🔴 BLOQUEANTE para producción  
**Status:** ⚠️ CRÍTICO - Sistema NO está al 100%

---

## 📊 Resumen Ejecutivo

**Problema:** 8 de 228 tests E2E de Playwright están fallando (96.5% pasando, NO 100%)

**Impacto:** Sistema NO está listo para producción con 15 terminales concurrentes

**Tests Fallando:**
1. Test 18: Event Deduplication (Idempotency) - 44ms
2. Tests 23-27: Multi-Terminal Concurrency (5 tests) - 49-246ms
3. Test 29: Event Deduplication (Identical Events) - 42ms
4. Test 30: Out-of-Order Event Delivery - 105ms
5. Test 31: Rate Limiting (Burst Events) - 86ms

---

## 🔍 Análisis de Código Actual

### 1. Event Deduplication - PROBLEMA CRÍTICO ❌

**Archivo:** `src/app/api/events/ingest/route.ts`

**Implementación Actual:**
```typescript
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent): Promise<boolean> {
    // 1. Check if already processed (idempotency)
    const exists = await tx.processed_events.findUnique({
        where: { event_id: event.event_id }
    });

    if (exists) {
        console.log(`[Projection] Event ${event.event_id} already processed, skipping`);
        return false; // Already processed
    }

    // 2. Mark as processed BEFORE projecting (prevents race conditions)
    await tx.processed_events.create({
        data: {
            event_id: event.event_id,
            tenant_id: event.tenant_id,
        }
    });

    // 3. Project the event
    // ...
}
```

**CAUSA RAÍZ #1: Race Condition en Deduplication**

**Problema:**
- La verificación `findUnique()` y el `create()` NO son atómicas
- Dos requests simultáneos con el mismo `event_id` pueden:
  1. Ambos ejecutar `findUnique()` → ambos obtienen `null`
  2. Ambos ejecutar `create()` → el segundo falla con P2002 (unique constraint)
  3. El segundo request crashea o retorna error 500

**Evidencia en Schema:**
```prisma
model processed_events {
  event_id     String   @id @db.Uuid  // ✅ PK = UNIQUE constraint
  tenant_id    String   @db.Uuid
  processed_at DateTime @default(now()) @db.Timestamptz(6)
  aggregate_id String?  @db.Uuid
  event_type   String?
  processor    String?

  @@index([tenant_id, processed_at], map: "idx_processed_cleanup")
}
```

**Constraint UNIQUE existe:** ✅ `event_id` es PK  
**Problema:** ❌ El código NO maneja el error P2002 correctamente

**Solución Requerida:**
```typescript
try {
    await tx.processed_events.create({
        data: { event_id: event.event_id, tenant_id: event.tenant_id }
    });
} catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === "P2002") {
        // Evento ya procesado por otro request concurrente
        console.log(`[Dedup] Event ${event.event_id} already processed`);
        return false; // Skip
    }
    throw e; // Otro error
}
```

---

### 2. Inserción en Tabla `events` - PROBLEMA CRÍTICO ❌

**Archivo:** `src/app/api/events/ingest/route.ts` (líneas 200-220)

**Implementación Actual:**
```typescript
// 3. Try to create event, skip if duplicate
try {
    await tx.events.create({
        data: {
            id: ev.event_id,
            tenant_id: ev.tenant_id,
            occurred_at: new Date(ev.occurred_at),
            type: ev.event_type,
            entity_type: ev.aggregate_type,
            entity_id: ev.aggregate_id,
            actor_id: ev.actor_id ?? null,
            actor_role_snapshot: ev.actor_role_snapshot ?? null,
            terminal_id: ev.terminal_id,
            payload_version: ev.schema_version,
            payload: ev.payload as any,
        },
    });
} catch (e: unknown) {
    // Unique constraint = duplicate, skip
    if (e && typeof e === 'object' && 'code' in e && e.code === "P2002") {
        deduped_event_ids.push(ev.event_id);
        continue;
    }
    throw e;
}
```

**CAUSA RAÍZ #2: Deduplication en Lugar Incorrecto**

**Problema:**
- La deduplicación se hace en la tabla `events` (línea 200)
- PERO la verificación de `processed_events` se hace DENTRO de `projectEvent()` (línea 100)
- Esto causa:
  1. Evento se inserta en `events` ✅
  2. `projectEvent()` verifica `processed_events` ✅
  3. PERO si dos requests simultáneos llegan:
     - Ambos insertan en `events` (uno falla con P2002)
     - Ambos intentan insertar en `processed_events` (uno falla con P2002)
     - El segundo request NO proyecta, pero el evento YA está en `events`

**Evidencia en Schema:**
```prisma
model events {
  id                  String   @id @db.Uuid  // ✅ PK = UNIQUE constraint
  tenant_id           String   @db.Uuid
  occurred_at         DateTime @db.Timestamptz(6)
  type                String
  entity_type         String
  entity_id           String?  @db.Uuid
  // ...
}
```

**Constraint UNIQUE existe:** ✅ `id` (event_id) es PK  
**Problema:** ❌ La verificación de duplicados NO se hace ANTES de insertar en `events`

**Solución Requerida:**
1. Mover verificación de `processed_events` ANTES de insertar en `events`
2. Usar `processed_events` como "lock" atómico
3. Solo insertar en `events` si `processed_events.create()` tiene éxito

---

### 3. Multi-Terminal Concurrency - PROBLEMA CRÍTICO ❌

**Tests Fallando:**
- Test 23: "should handle simultaneous orders from multiple waiters"
- Test 24: "should handle same product added from 2 terminals to same order"
- Test 25: "should handle order number collision prevention"
- Test 26: "should handle rapid sequential events from same terminal"
- Test 27: "should handle 15 waiters + 1 cashier simultaneous operations"

**CAUSA RAÍZ #3: Falta Optimistic Locking**

**Problema:**
- La tabla `orders` tiene campo `revision` (default 1) ✅
- PERO el código NO verifica `revision` antes de aplicar eventos
- Esto causa:
  1. Terminal A lee order con revision=5
  2. Terminal B lee order con revision=5
  3. Terminal A aplica evento → revision=6
  4. Terminal B aplica evento → revision=7 (DEBERÍA FALLAR)
  5. Resultado: Conflicto no detectado, datos inconsistentes

**Evidencia en Schema:**
```prisma
model orders {
  id                  String            @id @db.Uuid
  tenant_id           String            @db.Uuid
  order_number        Int
  // ...
  revision            Int               @default(1)  // ✅ Campo existe
  // ...
}
```

**Campo `revision` existe:** ✅  
**Problema:** ❌ El código NO lo usa para detectar conflictos

**Código Actual en `projectEvent()`:**
```typescript
case "ORDER_ITEM_ADDED": {
    const p = payload as any;
    const order = await tx.orders.findUnique({ where: { id: p.order_id } });
    if (order) {
        const items = order.items as any[] || [];
        const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
        await tx.orders.update({
            where: { id: p.order_id },
            data: {
                items: [...items, p.line],
                subtotal_cents: order.subtotal_cents + lineCents,
                total_cents: order.total_cents + lineCents,
                updated_at: new Date(occurred_at),
            },
        });
    }
    break;
}
```

**Problema:** ❌ NO verifica `revision` antes de actualizar

**Solución Requerida:**
```typescript
case "ORDER_ITEM_ADDED": {
    const p = payload as any;
    const order = await tx.orders.findUnique({ 
        where: { id: p.order_id },
        select: { revision: true, items: true, subtotal_cents: true, total_cents: true }
    });
    
    if (order) {
        // Verificar revision esperada
        const expectedRevision = event.expected_revision || order.revision;
        if (order.revision !== expectedRevision) {
            // CONFLICTO DETECTADO
            throw new ConflictError('REVISION_CONFLICT', {
                expected: expectedRevision,
                actual: order.revision
            });
        }
        
        // Actualizar con incremento de revision
        await tx.orders.update({
            where: { 
                id: p.order_id,
                revision: expectedRevision  // Optimistic lock
            },
            data: {
                items: [...order.items, p.line],
                subtotal_cents: order.subtotal_cents + lineCents,
                total_cents: order.total_cents + lineCents,
                revision: { increment: 1 },  // Incrementar revision
                updated_at: new Date(occurred_at),
            },
        });
    }
    break;
}
```

---

### 4. Order Number Collision - PROBLEMA CRÍTICO ❌

**Test Fallando:**
- Test 25: "should handle order number collision prevention"

**CAUSA RAÍZ #4: Falta Order Number Range Service**

**Problema:**
- Cada terminal genera `order_number` localmente
- NO hay coordinación entre terminales
- Esto causa:
  1. Terminal A genera order_number=1001
  2. Terminal B genera order_number=1001 (COLISIÓN)
  3. Ambos intentan crear orden con mismo número
  4. Uno falla o ambos se aceptan (inconsistencia)

**Evidencia en Test:**
```typescript
test('should handle order number collision prevention', async ({ request }) => {
    const orderNumber = generateOrderNumber();  // ❌ Mismo número
    const orderId1 = uuid();
    const orderId2 = uuid();

    const event1 = createOrderEvent(orderId1, orderNumber, 'MOZO_01', 1);
    const event2 = createOrderEvent(orderId2, orderNumber, 'MOZO_02', 1);

    const [response1, response2] = await Promise.all([
        ingestEvent(request, event1, 'MOZO_01', 1),
        ingestEvent(request, event2, 'MOZO_02', 1),
    ]);

    // First should succeed, second may fail or be handled by conflict resolution
    expect(response1.ok()).toBeTruthy();
    // Note: Current implementation may accept both - conflict resolution is P1
});
```

**Problema:** ❌ NO hay validación de `order_number` único por tenant

**Solución Requerida:**
1. Crear tabla `terminal_number_ranges`:
```prisma
model terminal_number_ranges {
  tenant_id    String   @db.Uuid
  terminal_id  String
  range_start  Int
  range_end    Int
  next_number  Int
  allocated_at DateTime @default(now()) @db.Timestamptz(6)

  @@id([tenant_id, terminal_id])
}
```

2. Asignar rangos por terminal:
   - CAJA_01: 1-1000
   - MOZO_01: 1001-2000
   - MOZO_02: 2001-3000
   - etc.

3. Validar `order_number` en rango asignado

---

### 5. Out-of-Order Event Delivery - PROBLEMA CRÍTICO ❌

**Test Fallando:**
- Test 30: "should handle out-of-order event delivery"

**CAUSA RAÍZ #5: Falta Out-of-Order Event Queue**

**Problema:**
- Eventos pueden llegar fuera de orden por red
- Ejemplo:
  1. Evento `ORDER_ITEM_ADDED` (sequence=2) llega primero
  2. Evento `ORDER_CREATED` (sequence=1) llega después
  3. Sistema intenta proyectar item ANTES de crear orden
  4. Falla porque orden no existe

**Evidencia en Test:**
```typescript
test('should handle out-of-order event delivery', async ({ request }) => {
    const orderId = uuid();
    const orderNumber = generateOrderNumber();
    const terminalId = 'MOZO_01';

    // Send events out of order: item added before order created
    const itemEvent = createItemAddedEvent(orderId, terminalId, 2, 'PROD_01', 1);
    const orderEvent = createOrderEvent(orderId, orderNumber, terminalId, 1);

    // Item first (should queue or fail gracefully)
    const itemResponse = await ingestEvent(request, itemEvent, terminalId, 2);
    
    // Then order
    const orderResponse = await ingestEvent(request, orderEvent, terminalId, 1);
    expect(orderResponse.ok()).toBeTruthy();

    // System should handle this gracefully (no 500 errors)
    expect(itemResponse.status()).toBeLessThan(500);
});
```

**Problema:** ❌ NO hay cola para eventos fuera de orden

**Solución Requerida:**
1. Crear `OutOfOrderQueue` en memoria
2. Encolar eventos con gap en `terminal_sequence`
3. Procesar cola cuando llega evento faltante
4. Timeout de 60s → mover a Dead Letter Queue

---

### 6. Rate Limiting - PROBLEMA CRÍTICO ❌

**Test Fallando:**
- Test 31: "should handle burst of events gracefully"

**CAUSA RAÍZ #6: Falta Rate Limiter**

**Problema:**
- NO hay rate limiting en `/api/events/ingest`
- Burst de eventos puede:
  1. Saturar base de datos
  2. Causar timeouts
  3. Degradar performance para todos los terminales

**Evidencia en Código:**
```typescript
export async function POST(req: Request) {
    // Security: Validate API Secret
    const secret = req.headers.get("x-api-secret");
    if (secret !== process.env.PARK_API_SECRET) {
        return serverError(
            err("UNAUTHORIZED", "Acceso denegado.", "Verifica tus credenciales."),
            401
        );
    }

    // ❌ NO HAY RATE LIMITING AQUÍ

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return serverError(err("INVALID_JSON", "No se pudo parsear el JSON.", "Verifica el formato del body."), 400);
    }
    // ...
}
```

**Comentario en Código:**
```typescript
// Note: Rate limiting for this endpoint is handled at infrastructure level
// (e.g., Vercel Edge Config, Cloudflare) due to high throughput requirements
```

**Problema:** ❌ Rate limiting NO está implementado (ni en código ni en infraestructura)

**Solución Requerida:**
1. Implementar `RateLimiterService` con Redis
2. Sliding window algorithm
3. Límites: 100 req/s normal, 200 req/s burst
4. Retornar HTTP 429 con `Retry-After` header

---

### 7. Retry Logic en SyncClient - PROBLEMA MENOR ⚠️

**Archivo:** `src/core/sync/client.ts`

**Implementación Actual:**
```typescript
private async updateSyncAttempt(status: "OK" | "FAIL" | "OFFLINE") {
    const now = new Date().toISOString();
    try {
        const st = await db.sync_state.get("singleton");
        const backlog_count = await db.events.where("synced").equals(0).count();

        await db.sync_state.put({
            id: "singleton",
            last_terminal_sequence_acked: st?.last_terminal_sequence_acked ?? 0,
            backlog_count,
            last_sync_attempt_at: now,
            last_sync_ok_at: status === "OK" ? now : st?.last_sync_ok_at,
        });
    } catch (_e) { /* ignore db errors */ }
}
```

**Problema:** ⚠️ Retry logic existe pero puede mejorar:
- Exponential backoff: ✅ Implementado
- Jitter: ✅ Implementado
- Circuit breaker: ✅ Implementado
- Respeto de `Retry-After`: ❌ NO implementado

**Solución Requerida:**
```typescript
if (resp.status === 429) {
    const retryAfter = resp.headers.get('Retry-After');
    if (retryAfter) {
        const delayMs = parseInt(retryAfter) * 1000;
        await sleep(delayMs);
        return this.syncNow();
    }
}
```

---

## 📋 Resumen de Causas Raíz

| # | Problema | Causa Raíz | Severidad | Tests Afectados |
|---|----------|------------|-----------|-----------------|
| 1 | Event Deduplication | Race condition en `processed_events.create()` | 🔴 CRÍTICO | 18, 29 |
| 2 | Inserción en `events` | Deduplicación en lugar incorrecto | 🔴 CRÍTICO | 18, 29 |
| 3 | Multi-Terminal Concurrency | Falta optimistic locking con `revision` | 🔴 CRÍTICO | 23, 24, 26, 27 |
| 4 | Order Number Collision | Falta order number range service | 🔴 CRÍTICO | 25 |
| 5 | Out-of-Order Events | Falta out-of-order event queue | 🔴 CRÍTICO | 30 |
| 6 | Rate Limiting | Falta rate limiter con Redis | 🔴 CRÍTICO | 31 |
| 7 | Retry Logic | Falta respeto de `Retry-After` header | ⚠️ MENOR | Ninguno |

---

## 🎯 Plan de Acción Recomendado

### Fase 1: Fixes Críticos (Prioridad ALTA)

1. **Fix Event Deduplication** (2-3 horas)
   - Agregar manejo de P2002 en `processed_events.create()`
   - Mover verificación ANTES de insertar en `events`
   - Agregar tests unitarios

2. **Fix Optimistic Locking** (3-4 horas)
   - Implementar verificación de `revision` en `projectEvent()`
   - Agregar incremento de `revision` después de cada evento
   - Integrar con `detectAndResolveConflict()` existente
   - Agregar tests unitarios

3. **Fix Order Number Ranges** (4-5 horas)
   - Crear tabla `terminal_number_ranges`
   - Implementar `assignRange()` con SELECT FOR UPDATE
   - Agregar validación en `validateEvent()`
   - Agregar tests unitarios

### Fase 2: Fixes Importantes (Prioridad MEDIA)

4. **Fix Out-of-Order Events** (5-6 horas)
   - Crear clase `OutOfOrderQueue`
   - Implementar encolado y procesamiento
   - Crear tabla `dead_letter_queue`
   - Agregar tests unitarios

5. **Fix Rate Limiting** (4-5 horas)
   - Implementar `RateLimiterService` con Redis
   - Agregar middleware en `/api/events/ingest`
   - Configurar límites (100 req/s normal, 200 req/s burst)
   - Agregar tests unitarios

### Fase 3: Mejoras (Prioridad BAJA)

6. **Mejorar Retry Logic** (1-2 horas)
   - Agregar respeto de `Retry-After` header
   - Agregar tests unitarios

---

## ⏱️ Estimación de Tiempo

- **Fase 1 (Crítico):** 9-12 horas
- **Fase 2 (Importante):** 9-11 horas
- **Fase 3 (Mejora):** 1-2 horas

**Total:** 19-25 horas de desarrollo + testing

---

## ✅ Criterios de Éxito

1. ✅ 8 tests E2E fallando ahora pasan
2. ✅ 228/228 tests E2E pasando (100%)
3. ✅ Coverage ≥90% en componentes críticos
4. ✅ Property tests con 100 iteraciones pasando
5. ✅ Latencia <200ms p95 en `/api/events/ingest`
6. ✅ Sistema soporta 15 terminales concurrentes sin errores

---

## 📝 Notas Finales

**Conclusión:** El sistema tiene 6 problemas críticos que impiden su uso en producción con 15 terminales concurrentes. La documentación anterior afirmaba incorrectamente que el sistema estaba al 100%.

**Recomendación:** Implementar Fase 1 (fixes críticos) INMEDIATAMENTE antes de cualquier deploy a producción.

**Riesgo:** Si se despliega sin estos fixes, el sistema FALLARÁ bajo carga con múltiples terminales concurrentes.

---

**Última actualización:** 12 Febrero 2026  
**Próximo paso:** Implementar Task 1 del spec (Event Deduplication Service)
