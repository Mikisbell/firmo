# 🛠️ PARK POS — Guía de Implementación Paso a Paso

> **Objetivo:** Documentar TODOS los pasos necesarios para llevar el sistema a producción.  
> **Prerrequisito:** Leer `AUDITORIA_CRITICA.md` y `MONEY_SAFETY.md` primero.

**Fecha:** Enero 2026  
**Tiempo estimado:** 5 días  
**Prioridad:** Resolver problemas críticos antes de cualquier feature nuevo

---

## 📋 ÍNDICE

1. [Fase 1: Idempotencia en Proyecciones](#fase-1-idempotencia-en-proyecciones)
2. [Fase 2: Outbox Pattern](#fase-2-outbox-pattern)
3. [Fase 3: Validación de Reglas de Negocio](#fase-3-validación-de-reglas-de-negocio)
4. [Fase 4: Order Number - Range Allocation](#fase-4-order-number---range-allocation)
5. [Fase 5: Timezone Handling](#fase-5-timezone-handling)
6. [Fase 6: Límites y Validaciones](#fase-6-límites-y-validaciones)
7. [Fase 7: Índices de Performance](#fase-7-índices-de-performance)
8. [Fase 8: Seguridad de API](#fase-8-seguridad-de-api)
9. [Fase 9: Tests de Validación](#fase-9-tests-de-validación)
10. [Fase 10: Checklist Final](#fase-10-checklist-final)

---

## FASE 1: Idempotencia en Proyecciones

**Problema:** Si un evento llega 2 veces, los totales se duplican.  
**Tiempo:** 4 horas  
**Prioridad:** 🔴 CRÍTICO

### Paso 1.1: Crear migración de Prisma

**Archivo:** `prisma/schema.prisma`

Agregar al final del archivo:
```prisma
// ============================================================================
// SAFETY: Event Processing Tracking
// ============================================================================

model ProcessedEvent {
  event_id     String   @id @db.Uuid
  tenant_id    String   @db.Uuid
  processed_at DateTime @default(now()) @db.Timestamptz

  @@index([tenant_id, processed_at])
  @@map("processed_events")
}
```

### Paso 1.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_processed_events
```

### Paso 1.3: Modificar función projectEvent

**Archivo:** `src/app/api/events/ingest/route.ts`

**ANTES (línea ~45):**
```typescript
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent) {
  const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;
  // ... proyección directa
}
```

**DESPUÉS:**
```typescript
async function projectEvent(tx: Prisma.TransactionClient, event: ParkEvent): Promise<boolean> {
  // 1. VERIFICAR SI YA FUE PROCESADO
  const alreadyProcessed = await tx.processedEvent.findUnique({
    where: { event_id: event.event_id }
  });

  if (alreadyProcessed) {
    console.log(`[Projection] Event ${event.event_id} already processed, skipping`);
    return false; // Indica que fue duplicado
  }

  // 2. MARCAR COMO PROCESADO (antes de proyectar)
  await tx.processedEvent.create({
    data: {
      event_id: event.event_id,
      tenant_id: event.tenant_id,
    }
  });

  // 3. AHORA SÍ PROYECTAR
  const { event_type, tenant_id, payload, occurred_at, terminal_id, actor_id } = event;

  try {
    switch (event_type) {
      // ... casos existentes sin cambios
    }
    return true; // Proyección exitosa
  } catch (e) {
    console.error(`[Projections] Error projecting ${event_type} ${event.event_id}:`, e);
    throw e; // Re-throw para rollback de transacción
  }
}
```

### Paso 1.4: Actualizar loop de ingest

**Archivo:** `src/app/api/events/ingest/route.ts`

**ANTES (línea ~120):**
```typescript
for (const ev of events as ParkEvent[]) {
  try {
    await tx.event.create({ data: { ... } });
  } catch (e: any) {
    if (e.code === "P2002") {
      deduped_event_ids.push(ev.event_id);
      continue;
    }
    throw e;
  }
  await projectEvent(tx, ev);
}
```

**DESPUÉS:**
```typescript
for (const ev of events as ParkEvent[]) {
  // 1. Intentar crear evento en store
  try {
    await tx.event.create({ data: { ... } });
  } catch (e: any) {
    if (e.code === "P2002") {
      deduped_event_ids.push(ev.event_id);
      continue; // Evento ya existe, skip
    }
    throw e;
  }

  // 2. Proyectar (con verificación de idempotencia interna)
  const wasProjected = await projectEvent(tx, ev);
  if (!wasProjected) {
    deduped_event_ids.push(ev.event_id);
  }
}
```

### Paso 1.5: Crear job de cleanup

**Archivo:** `src/core/jobs/cleanup-processed-events.ts` (NUEVO)

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Limpia eventos procesados hace más de 7 días.
 * Ejecutar diariamente via cron o al iniciar servidor.
 */
export async function cleanupProcessedEvents() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const result = await prisma.processedEvent.deleteMany({
    where: {
      processed_at: { lt: cutoff }
    }
  });

  console.log(`[Cleanup] Deleted ${result.count} processed events older than 7 days`);
  return result.count;
}

// Si se ejecuta directamente
if (require.main === module) {
  cleanupProcessedEvents()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
```

### Paso 1.6: Test de validación

```typescript
// src/core/__tests__/idempotency.test.ts
import { describe, it, expect } from 'vitest';

describe('Event Idempotency', () => {
  it('should not duplicate totals when same event is sent twice', async () => {
    const eventId = 'test-event-123';
    const orderId = 'test-order-456';
    
    // Crear orden inicial
    await createTestOrder(orderId, { subtotal_cents: 0 });
    
    // Enviar evento de agregar item
    const event = {
      event_id: eventId,
      event_type: 'ORDER_ITEM_ADDED',
      payload: {
        order_id: orderId,
        line: { qty: 1, unit_price_cents: 2500 }
      }
    };
    
    // Primera vez
    await ingestEvents([event]);
    let order = await getOrder(orderId);
    expect(order.subtotal_cents).toBe(2500);
    
    // Segunda vez (mismo event_id)
    await ingestEvents([event]);
    order = await getOrder(orderId);
    expect(order.subtotal_cents).toBe(2500); // NO debe ser 5000
  });
});
```

### ✅ Criterios de Aceptación Fase 1

- [ ] Tabla `processed_events` existe en PostgreSQL
- [ ] `projectEvent()` verifica duplicados antes de proyectar
- [ ] Enviar mismo evento 2 veces NO duplica totales
- [ ] Job de cleanup elimina registros > 7 días
- [ ] Test de idempotencia pasa

---

## FASE 2: Outbox Pattern

**Problema:** Si el servidor cae después de guardar evento pero antes de confirmar al cliente, el cliente reenvía y puede causar inconsistencias.  
**Tiempo:** 6 horas  
**Prioridad:** 🔴 CRÍTICO

### Contexto del Problema

```
FLUJO ACTUAL (PELIGROSO):
Terminal → API → [Guardar Evento] → [Proyectar] → [Responder OK]
                       ↓
              Si cae aquí, el cliente reenvía
              pero el evento YA está guardado
```

```
FLUJO CON OUTBOX (SEGURO):
Terminal → API → [Guardar Evento + Outbox en TX] → [Responder OK]
                                                          ↓
                                              Worker async procesa Outbox
```

### Paso 2.1: Agregar modelo Outbox a Prisma

**Archivo:** `prisma/schema.prisma`

```prisma
// ============================================================================
// SAFETY: Outbox Pattern for Reliable Event Processing
// ============================================================================

model EventOutbox {
  id           String   @id @default(uuid()) @db.Uuid
  event_id     String   @db.Uuid
  tenant_id    String   @db.Uuid
  status       String   @default("pending") // pending, processing, completed, failed
  attempts     Int      @default(0)
  last_error   String?
  created_at   DateTime @default(now()) @db.Timestamptz
  processed_at DateTime? @db.Timestamptz

  @@index([status, created_at])
  @@index([tenant_id])
  @@map("event_outbox")
}
```

### Paso 2.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_event_outbox
```

### Paso 2.3: Modificar ingest para usar Outbox

**Archivo:** `src/app/api/events/ingest/route.ts`

**ANTES:**
```typescript
// Dentro de la transacción
for (const ev of events as ParkEvent[]) {
  await tx.event.create({ data: { ... } });
  await projectEvent(tx, ev); // ← Proyección síncrona
}
```

**DESPUÉS:**
```typescript
// Dentro de la transacción
for (const ev of events as ParkEvent[]) {
  // 1. Guardar evento
  try {
    await tx.event.create({ data: { ... } });
  } catch (e: any) {
    if (e.code === "P2002") {
      deduped_event_ids.push(ev.event_id);
      continue;
    }
    throw e;
  }

  // 2. Agregar a Outbox (en la MISMA transacción)
  await tx.eventOutbox.create({
    data: {
      event_id: ev.event_id,
      tenant_id: ev.tenant_id,
      status: 'pending'
    }
  });
}

// FUERA de la transacción: disparar procesamiento async
// (no bloquea la respuesta al cliente)
setImmediate(() => processOutbox());
```

### Paso 2.4: Crear Worker de Outbox

**Archivo:** `src/core/workers/outbox-processor.ts` (NUEVO)

```typescript
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 50;

/**
 * Procesa eventos pendientes en el Outbox.
 * Diseñado para ser llamado frecuentemente (cada 100ms o por trigger).
 */
export async function processOutbox(): Promise<number> {
  let processed = 0;

  // 1. Obtener batch de eventos pendientes
  const pending = await prisma.eventOutbox.findMany({
    where: {
      status: 'pending',
      attempts: { lt: MAX_ATTEMPTS }
    },
    orderBy: { created_at: 'asc' },
    take: BATCH_SIZE
  });

  if (pending.length === 0) return 0;

  // 2. Procesar cada uno
  for (const item of pending) {
    try {
      // Marcar como "processing" para evitar doble procesamiento
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { 
          status: 'processing',
          attempts: { increment: 1 }
        }
      });

      // Obtener el evento completo
      const event = await prisma.event.findUnique({
        where: { event_id: item.event_id }
      });

      if (!event) {
        // Evento no existe (raro), marcar como failed
        await prisma.eventOutbox.update({
          where: { id: item.id },
          data: { 
            status: 'failed',
            last_error: 'Event not found in store'
          }
        });
        continue;
      }

      // Proyectar en transacción
      await prisma.$transaction(async (tx) => {
        await projectEvent(tx, event as any);
        
        await tx.eventOutbox.update({
          where: { id: item.id },
          data: { 
            status: 'completed',
            processed_at: new Date()
          }
        });
      });

      processed++;

    } catch (error: any) {
      // Error en proyección
      const attempts = item.attempts + 1;
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { 
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          last_error: error.message?.substring(0, 500)
        }
      });
      console.error(`[Outbox] Error processing ${item.event_id}:`, error.message);
    }
  }

  return processed;
}

/**
 * Loop continuo para procesar outbox.
 * Usar en producción con un proceso dedicado.
 */
export async function startOutboxLoop(intervalMs = 100) {
  console.log('[Outbox] Starting processor loop...');
  
  const tick = async () => {
    try {
      const count = await processOutbox();
      if (count > 0) {
        console.log(`[Outbox] Processed ${count} events`);
      }
    } catch (e) {
      console.error('[Outbox] Loop error:', e);
    }
    setTimeout(tick, intervalMs);
  };

  tick();
}

// Importar projectEvent del archivo original
import { projectEvent } from "@/app/api/events/ingest/route";
```

### Paso 2.5: Endpoint para monitorear Outbox

**Archivo:** `src/app/api/admin/outbox/route.ts` (NUEVO)

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/core/lib/prisma";

export async function GET() {
  const stats = await prisma.eventOutbox.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  const failed = await prisma.eventOutbox.findMany({
    where: { status: 'failed' },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      id: true,
      event_id: true,
      attempts: true,
      last_error: true,
      created_at: true
    }
  });

  return NextResponse.json({
    stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    recent_failures: failed
  });
}
```

### Paso 2.6: Cleanup de Outbox completados

**Archivo:** `src/core/jobs/cleanup-outbox.ts` (NUEVO)

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Limpia entradas completadas del outbox (> 24 horas).
 * Los failed se mantienen para análisis.
 */
export async function cleanupOutbox() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  const result = await prisma.eventOutbox.deleteMany({
    where: {
      status: 'completed',
      processed_at: { lt: cutoff }
    }
  });

  console.log(`[Cleanup] Deleted ${result.count} completed outbox entries`);
  return result.count;
}
```

### ✅ Criterios de Aceptación Fase 2

- [ ] Tabla `event_outbox` existe en PostgreSQL
- [ ] Ingest guarda evento + outbox en misma transacción
- [ ] Worker procesa outbox de forma asíncrona
- [ ] Reintentos automáticos (máx 3)
- [ ] Endpoint `/api/admin/outbox` muestra estadísticas
- [ ] Si servidor cae, eventos se procesan al reiniciar

---

## FASE 3: Validación de Reglas de Negocio

**Problema:** El servidor acepta cualquier evento sin validar reglas de negocio (ej: descuento > 100%, cantidad negativa).  
**Tiempo:** 8 horas  
**Prioridad:** 🔴 CRÍTICO

### Contexto del Problema

```
ACTUAL:
Terminal envía: { discount_percent: 150 } → Servidor acepta ✓ → Pérdida de dinero 💸

CORRECTO:
Terminal envía: { discount_percent: 150 } → Servidor rechaza ✗ → "Descuento máximo 50%"
```

### Paso 3.1: Crear módulo de validadores

**Archivo:** `src/core/validation/business-rules.ts` (NUEVO)

```typescript
import { z } from "zod";

// ============================================================================
// CONSTANTES DE NEGOCIO
// ============================================================================

export const BUSINESS_LIMITS = {
  // Descuentos
  MAX_LINE_DISCOUNT_PERCENT: 50,      // Máximo 50% por línea
  MAX_ORDER_DISCOUNT_PERCENT: 30,     // Máximo 30% a nivel orden
  MAX_DISCOUNT_REQUIRES_MANAGER: 20,  // > 20% requiere autorización
  
  // Cantidades
  MAX_ITEM_QUANTITY: 100,             // Máximo 100 unidades por línea
  MIN_ITEM_QUANTITY: 1,
  
  // Precios
  MAX_UNIT_PRICE_CENTS: 100000_00,    // S/ 100,000 máximo
  MIN_UNIT_PRICE_CENTS: 1,            // Mínimo 1 céntimo
  
  // Órdenes
  MAX_LINES_PER_ORDER: 50,            // Máximo 50 líneas por orden
  MAX_ORDER_TOTAL_CENTS: 500000_00,   // S/ 500,000 máximo por orden
  
  // Pagos
  MAX_CASH_PAYMENT_CENTS: 10000_00,   // S/ 10,000 máximo en efectivo (SUNAT)
  MAX_TIP_PERCENT: 20,                // Máximo 20% de propina
  
  // Turnos
  MAX_SHIFT_DURATION_HOURS: 16,       // Máximo 16 horas de turno
  MAX_CASH_VARIANCE_CENTS: 1000,      // S/ 10 máximo de descuadre
} as const;

// ============================================================================
// SCHEMAS DE VALIDACIÓN POR EVENTO
// ============================================================================

const MoneySchema = z.number().int().min(0).max(BUSINESS_LIMITS.MAX_ORDER_TOTAL_CENTS);
const QuantitySchema = z.number().int().min(BUSINESS_LIMITS.MIN_ITEM_QUANTITY).max(BUSINESS_LIMITS.MAX_ITEM_QUANTITY);
const PercentSchema = z.number().min(0).max(100);

// ORDER_ITEM_ADDED
export const OrderItemAddedSchema = z.object({
  order_id: z.string().uuid(),
  line: z.object({
    line_id: z.string().uuid(),
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional(),
    qty: QuantitySchema,
    unit_price_cents: z.number().int().min(BUSINESS_LIMITS.MIN_UNIT_PRICE_CENTS).max(BUSINESS_LIMITS.MAX_UNIT_PRICE_CENTS),
    discount_percent: PercentSchema.max(BUSINESS_LIMITS.MAX_LINE_DISCOUNT_PERCENT).optional(),
    modifiers: z.array(z.object({
      modifier_id: z.string().uuid(),
      price_cents: MoneySchema
    })).max(10).optional(),
    notes: z.string().max(200).optional()
  })
});

// ORDER_DISCOUNT_APPLIED
export const OrderDiscountAppliedSchema = z.object({
  order_id: z.string().uuid(),
  discount: z.object({
    type: z.enum(['percent', 'fixed']),
    value: z.number(),
    reason: z.string().max(100).optional(),
    authorized_by: z.string().uuid().optional()
  })
}).refine(
  (data) => {
    if (data.discount.type === 'percent') {
      return data.discount.value <= BUSINESS_LIMITS.MAX_ORDER_DISCOUNT_PERCENT;
    }
    return data.discount.value <= BUSINESS_LIMITS.MAX_ORDER_TOTAL_CENTS;
  },
  { message: `Descuento máximo: ${BUSINESS_LIMITS.MAX_ORDER_DISCOUNT_PERCENT}%` }
).refine(
  (data) => {
    // Si descuento > 20%, debe tener authorized_by
    if (data.discount.type === 'percent' && data.discount.value > BUSINESS_LIMITS.MAX_DISCOUNT_REQUIRES_MANAGER) {
      return !!data.discount.authorized_by;
    }
    return true;
  },
  { message: `Descuentos > ${BUSINESS_LIMITS.MAX_DISCOUNT_REQUIRES_MANAGER}% requieren autorización de gerente` }
);

// PAYMENT_ADDED
export const PaymentAddedSchema = z.object({
  order_id: z.string().uuid(),
  payment: z.object({
    payment_id: z.string().uuid(),
    method: z.enum(['cash', 'card', 'yape', 'plin', 'transfer']),
    amount_cents: MoneySchema.positive(),
    reference: z.string().max(50).optional()
  })
}).refine(
  (data) => {
    // Efectivo máximo S/ 10,000 (regulación SUNAT)
    if (data.payment.method === 'cash') {
      return data.payment.amount_cents <= BUSINESS_LIMITS.MAX_CASH_PAYMENT_CENTS;
    }
    return true;
  },
  { message: `Pago en efectivo máximo: S/ ${BUSINESS_LIMITS.MAX_CASH_PAYMENT_CENTS / 100}` }
);

// SHIFT_CLOSED
export const ShiftClosedSchema = z.object({
  shift_id: z.string().uuid(),
  counted_cash_cents: MoneySchema,
  expected_cash_cents: MoneySchema,
  variance_cents: z.number().int(),
  notes: z.string().max(500).optional()
}).refine(
  (data) => {
    // Descuadre máximo permitido sin autorización
    return Math.abs(data.variance_cents) <= BUSINESS_LIMITS.MAX_CASH_VARIANCE_CENTS;
  },
  { message: `Descuadre máximo sin autorización: S/ ${BUSINESS_LIMITS.MAX_CASH_VARIANCE_CENTS / 100}` }
);

// TIP_ADDED
export const TipAddedSchema = z.object({
  order_id: z.string().uuid(),
  tip_cents: MoneySchema,
  order_subtotal_cents: MoneySchema
}).refine(
  (data) => {
    const tipPercent = (data.tip_cents / data.order_subtotal_cents) * 100;
    return tipPercent <= BUSINESS_LIMITS.MAX_TIP_PERCENT;
  },
  { message: `Propina máxima: ${BUSINESS_LIMITS.MAX_TIP_PERCENT}%` }
);

// ============================================================================
// MAPA DE VALIDADORES
// ============================================================================

export const EVENT_VALIDATORS: Record<string, z.ZodSchema> = {
  'ORDER_ITEM_ADDED': OrderItemAddedSchema,
  'ORDER_ITEM_UPDATED': OrderItemAddedSchema, // Mismas reglas
  'ORDER_DISCOUNT_APPLIED': OrderDiscountAppliedSchema,
  'PAYMENT_ADDED': PaymentAddedSchema,
  'SHIFT_CLOSED': ShiftClosedSchema,
  'TIP_ADDED': TipAddedSchema,
  // Agregar más según se necesiten
};

// ============================================================================
// FUNCIÓN PRINCIPAL DE VALIDACIÓN
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export function validateEventPayload(eventType: string, payload: unknown): ValidationResult {
  const validator = EVENT_VALIDATORS[eventType];
  
  // Si no hay validador específico, aceptar (pero loguear warning)
  if (!validator) {
    console.warn(`[Validation] No validator for event type: ${eventType}`);
    return { valid: true };
  }

  const result = validator.safeParse(payload);
  
  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  };
}
```

### Paso 3.2: Integrar validación en ingest

**Archivo:** `src/app/api/events/ingest/route.ts`

**Agregar import:**
```typescript
import { validateEventPayload, ValidationResult } from "@/core/validation/business-rules";
```

**Modificar el loop de procesamiento:**

```typescript
// Antes del loop de eventos
const validationErrors: Array<{ event_id: string; errors: string[] }> = [];

for (const ev of events as ParkEvent[]) {
  // 1. VALIDAR REGLAS DE NEGOCIO
  const validation = validateEventPayload(ev.event_type, ev.payload);
  
  if (!validation.valid) {
    validationErrors.push({
      event_id: ev.event_id,
      errors: validation.errors || ['Validation failed']
    });
    continue; // Skip este evento
  }

  // 2. Guardar evento (código existente)
  try {
    await tx.event.create({ data: { ... } });
  } catch (e: any) {
    // ... manejo existente
  }

  // 3. Agregar a Outbox
  await tx.eventOutbox.create({ ... });
}

// En la respuesta, incluir errores de validación
return NextResponse.json({
  ok: true,
  accepted: events.length - validationErrors.length - deduped_event_ids.length,
  deduped: deduped_event_ids.length,
  rejected: validationErrors.length,
  validation_errors: validationErrors.length > 0 ? validationErrors : undefined
});
```

### Paso 3.3: Validaciones adicionales con estado

**Archivo:** `src/core/validation/stateful-rules.ts` (NUEVO)

```typescript
import { PrismaClient } from "@prisma/client";
import { BUSINESS_LIMITS } from "./business-rules";

const prisma = new PrismaClient();

/**
 * Validaciones que requieren consultar el estado actual.
 * Más costosas pero necesarias para ciertas reglas.
 */

export async function validateOrderItemAdd(
  tenantId: string,
  orderId: string,
  newLine: { qty: number; unit_price_cents: number }
): Promise<{ valid: boolean; error?: string }> {
  
  // 1. Verificar que la orden existe y está abierta
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    select: { 
      status: true, 
      subtotal_cents: true,
      _count: { select: { lines: true } }
    }
  });

  if (!order) {
    return { valid: false, error: 'Orden no encontrada' };
  }

  if (order.status !== 'open' && order.status !== 'in_progress') {
    return { valid: false, error: `No se puede modificar orden en estado: ${order.status}` };
  }

  // 2. Verificar límite de líneas
  if (order._count.lines >= BUSINESS_LIMITS.MAX_LINES_PER_ORDER) {
    return { valid: false, error: `Máximo ${BUSINESS_LIMITS.MAX_LINES_PER_ORDER} líneas por orden` };
  }

  // 3. Verificar que el total no exceda el límite
  const lineTotal = newLine.qty * newLine.unit_price_cents;
  const newTotal = order.subtotal_cents + lineTotal;
  
  if (newTotal > BUSINESS_LIMITS.MAX_ORDER_TOTAL_CENTS) {
    return { 
      valid: false, 
      error: `Total excedería el límite de S/ ${BUSINESS_LIMITS.MAX_ORDER_TOTAL_CENTS / 100}` 
    };
  }

  return { valid: true };
}

export async function validatePayment(
  tenantId: string,
  orderId: string,
  paymentCents: number
): Promise<{ valid: boolean; error?: string }> {
  
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    select: { 
      status: true,
      total_cents: true,
      paid_cents: true
    }
  });

  if (!order) {
    return { valid: false, error: 'Orden no encontrada' };
  }

  // No permitir pago si ya está pagada
  if (order.status === 'paid' || order.status === 'closed') {
    return { valid: false, error: 'Orden ya está pagada/cerrada' };
  }

  // No permitir sobrepago excesivo (máx 10% de propina implícita)
  const remaining = order.total_cents - order.paid_cents;
  const maxPayment = remaining * 1.2; // 20% extra máximo
  
  if (paymentCents > maxPayment) {
    return { 
      valid: false, 
      error: `Pago excesivo. Pendiente: S/ ${remaining / 100}, máximo aceptado: S/ ${maxPayment / 100}` 
    };
  }

  return { valid: true };
}

export async function validateShiftClose(
  tenantId: string,
  shiftId: string,
  terminalId: string
): Promise<{ valid: boolean; error?: string }> {
  
  const shift = await prisma.shift.findUnique({
    where: { shift_id: shiftId },
    select: { 
      status: true,
      terminal_id: true,
      opened_at: true
    }
  });

  if (!shift) {
    return { valid: false, error: 'Turno no encontrado' };
  }

  if (shift.status !== 'open') {
    return { valid: false, error: 'Turno ya está cerrado' };
  }

  if (shift.terminal_id !== terminalId) {
    return { valid: false, error: 'Solo el terminal que abrió el turno puede cerrarlo' };
  }

  // Verificar duración máxima
  const hoursOpen = (Date.now() - shift.opened_at.getTime()) / (1000 * 60 * 60);
  if (hoursOpen > BUSINESS_LIMITS.MAX_SHIFT_DURATION_HOURS) {
    console.warn(`[Validation] Shift ${shiftId} open for ${hoursOpen.toFixed(1)} hours`);
    // Warning pero no bloquear
  }

  return { valid: true };
}
```

### Paso 3.4: Tests de validación

**Archivo:** `src/core/__tests__/business-rules.test.ts` (NUEVO)

```typescript
import { describe, it, expect } from 'vitest';
import { validateEventPayload, BUSINESS_LIMITS } from '../validation/business-rules';

describe('Business Rules Validation', () => {
  describe('ORDER_ITEM_ADDED', () => {
    it('should reject quantity > 100', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        line: {
          line_id: '123e4567-e89b-12d3-a456-426614174001',
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          qty: 150, // > 100
          unit_price_cents: 2500
        }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('qty'));
    });

    it('should reject discount > 50%', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        line: {
          line_id: '123e4567-e89b-12d3-a456-426614174001',
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          qty: 1,
          unit_price_cents: 2500,
          discount_percent: 75 // > 50%
        }
      });
      
      expect(result.valid).toBe(false);
    });

    it('should accept valid item', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        line: {
          line_id: '123e4567-e89b-12d3-a456-426614174001',
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          qty: 2,
          unit_price_cents: 2500,
          discount_percent: 10
        }
      });
      
      expect(result.valid).toBe(true);
    });
  });

  describe('ORDER_DISCOUNT_APPLIED', () => {
    it('should require authorization for discount > 20%', () => {
      const result = validateEventPayload('ORDER_DISCOUNT_APPLIED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        discount: {
          type: 'percent',
          value: 25 // > 20%, sin authorized_by
        }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('autorización');
    });

    it('should accept discount > 20% with authorization', () => {
      const result = validateEventPayload('ORDER_DISCOUNT_APPLIED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        discount: {
          type: 'percent',
          value: 25,
          authorized_by: '123e4567-e89b-12d3-a456-426614174999'
        }
      });
      
      expect(result.valid).toBe(true);
    });
  });

  describe('PAYMENT_ADDED', () => {
    it('should reject cash > S/ 10,000', () => {
      const result = validateEventPayload('PAYMENT_ADDED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        payment: {
          payment_id: '123e4567-e89b-12d3-a456-426614174001',
          method: 'cash',
          amount_cents: 1500000 // S/ 15,000
        }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('10000');
    });

    it('should accept card payment > S/ 10,000', () => {
      const result = validateEventPayload('PAYMENT_ADDED', {
        order_id: '123e4567-e89b-12d3-a456-426614174000',
        payment: {
          payment_id: '123e4567-e89b-12d3-a456-426614174001',
          method: 'card',
          amount_cents: 1500000 // S/ 15,000 con tarjeta OK
        }
      });
      
      expect(result.valid).toBe(true);
    });
  });
});
```

### ✅ Criterios de Aceptación Fase 3

- [ ] Módulo `business-rules.ts` con constantes y schemas Zod
- [ ] Ingest valida payload antes de guardar
- [ ] Descuentos > 50% rechazados
- [ ] Descuentos > 20% requieren `authorized_by`
- [ ] Efectivo > S/ 10,000 rechazado
- [ ] Cantidades > 100 rechazadas
- [ ] Response incluye `validation_errors` cuando aplica
- [ ] Tests de validación pasan

---

## FASE 4: Order Number - Range Allocation

**Problema:** Múltiples terminales pueden generar el mismo número de orden si usan contador local.  
**Tiempo:** 4 horas  
**Prioridad:** 🟡 ALTO

### Contexto del Problema

```
PROBLEMA:
Terminal A: genera orden #001
Terminal B: genera orden #001  ← COLISIÓN!
Cliente confundido, cocina confundida

SOLUCIÓN: Range Allocation
Servidor asigna rangos exclusivos a cada terminal:
- Terminal A: 001-100
- Terminal B: 101-200
- Terminal C: 201-300
```

### Paso 4.1: Agregar modelo de rangos

**Archivo:** `prisma/schema.prisma`

```prisma
// ============================================================================
// SAFETY: Order Number Range Allocation
// ============================================================================

model OrderNumberRange {
  id           String   @id @default(uuid()) @db.Uuid
  tenant_id    String   @db.Uuid
  terminal_id  String   @db.Uuid
  range_start  Int
  range_end    Int
  current      Int      // Próximo número a usar
  allocated_at DateTime @default(now()) @db.Timestamptz
  expires_at   DateTime @db.Timestamptz
  
  @@unique([tenant_id, terminal_id])
  @@index([tenant_id, expires_at])
  @@map("order_number_ranges")
}

model OrderNumberCounter {
  tenant_id    String   @id @db.Uuid
  last_range   Int      @default(0) // Último rango asignado
  updated_at   DateTime @default(now()) @db.Timestamptz
  
  @@map("order_number_counters")
}
```

### Paso 4.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_order_number_ranges
```

### Paso 4.3: Crear servicio de asignación de rangos

**Archivo:** `src/core/services/order-number.service.ts` (NUEVO)

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RANGE_SIZE = 100;           // Cada terminal recibe 100 números
const RANGE_EXPIRY_HOURS = 24;    // Rango expira en 24 horas
const DAILY_RESET_HOUR = 5;       // Reset a las 5 AM

export interface OrderNumberRange {
  range_start: number;
  range_end: number;
  current: number;
  expires_at: Date;
}

/**
 * Obtiene o asigna un rango de números de orden para un terminal.
 * Usa transacción con lock para evitar colisiones.
 */
export async function getOrAllocateRange(
  tenantId: string,
  terminalId: string
): Promise<OrderNumberRange> {
  
  return await prisma.$transaction(async (tx) => {
    // 1. Buscar rango existente no expirado
    const existing = await tx.orderNumberRange.findUnique({
      where: {
        tenant_id_terminal_id: {
          tenant_id: tenantId,
          terminal_id: terminalId
        }
      }
    });

    const now = new Date();

    // Si existe y no ha expirado y tiene números disponibles
    if (existing && existing.expires_at > now && existing.current <= existing.range_end) {
      return {
        range_start: existing.range_start,
        range_end: existing.range_end,
        current: existing.current,
        expires_at: existing.expires_at
      };
    }

    // 2. Necesitamos asignar nuevo rango
    // Obtener o crear contador del tenant
    let counter = await tx.orderNumberCounter.findUnique({
      where: { tenant_id: tenantId }
    });

    if (!counter) {
      counter = await tx.orderNumberCounter.create({
        data: { tenant_id: tenantId, last_range: 0 }
      });
    }

    // Verificar si debemos resetear (nuevo día)
    const shouldReset = shouldResetDaily(counter.updated_at, now);
    const baseRange = shouldReset ? 0 : counter.last_range;

    // Calcular nuevo rango
    const newRangeStart = baseRange + 1;
    const newRangeEnd = baseRange + RANGE_SIZE;

    // Actualizar contador
    await tx.orderNumberCounter.update({
      where: { tenant_id: tenantId },
      data: {
        last_range: newRangeEnd,
        updated_at: now
      }
    });

    // Calcular expiración
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + RANGE_EXPIRY_HOURS);

    // Crear o actualizar rango del terminal
    const range = await tx.orderNumberRange.upsert({
      where: {
        tenant_id_terminal_id: {
          tenant_id: tenantId,
          terminal_id: terminalId
        }
      },
      create: {
        tenant_id: tenantId,
        terminal_id: terminalId,
        range_start: newRangeStart,
        range_end: newRangeEnd,
        current: newRangeStart,
        expires_at: expiresAt
      },
      update: {
        range_start: newRangeStart,
        range_end: newRangeEnd,
        current: newRangeStart,
        allocated_at: now,
        expires_at: expiresAt
      }
    });

    console.log(`[OrderNumber] Allocated range ${newRangeStart}-${newRangeEnd} to terminal ${terminalId}`);

    return {
      range_start: range.range_start,
      range_end: range.range_end,
      current: range.current,
      expires_at: range.expires_at
    };
  }, {
    isolationLevel: 'Serializable' // Máxima consistencia
  });
}

/**
 * Consume un número del rango asignado.
 * Retorna el número usado o null si el rango está agotado.
 */
export async function consumeOrderNumber(
  tenantId: string,
  terminalId: string
): Promise<number | null> {
  
  const result = await prisma.orderNumberRange.updateMany({
    where: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      current: { lte: prisma.orderNumberRange.fields.range_end }
    },
    data: {
      current: { increment: 1 }
    }
  });

  if (result.count === 0) {
    // Rango agotado, necesita nuevo
    return null;
  }

  // Obtener el número que acabamos de usar
  const range = await prisma.orderNumberRange.findUnique({
    where: {
      tenant_id_terminal_id: {
        tenant_id: tenantId,
        terminal_id: terminalId
      }
    }
  });

  return range ? range.current - 1 : null;
}

/**
 * Determina si debemos resetear los números (nuevo día operativo).
 * El día operativo empieza a las 5 AM.
 */
function shouldResetDaily(lastUpdate: Date, now: Date): boolean {
  const getOperativeDay = (date: Date): string => {
    const d = new Date(date);
    // Si es antes de las 5 AM, pertenece al día anterior
    if (d.getHours() < DAILY_RESET_HOUR) {
      d.setDate(d.getDate() - 1);
    }
    return d.toISOString().split('T')[0];
  };

  return getOperativeDay(lastUpdate) !== getOperativeDay(now);
}

/**
 * Formatea número de orden para mostrar.
 * Ej: 42 → "042", 123 → "123"
 */
export function formatOrderNumber(num: number): string {
  return num.toString().padStart(3, '0');
}
```

### Paso 4.4: API endpoint para obtener rango

**Archivo:** `src/app/api/terminals/[terminalId]/order-range/route.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getOrAllocateRange } from "@/core/services/order-number.service";

export async function GET(
  request: NextRequest,
  { params }: { params: { terminalId: string } }
) {
  const tenantId = request.headers.get('x-tenant-id');
  
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant ID' }, { status: 400 });
  }

  try {
    const range = await getOrAllocateRange(tenantId, params.terminalId);
    
    return NextResponse.json({
      range_start: range.range_start,
      range_end: range.range_end,
      current: range.current,
      available: range.range_end - range.current + 1,
      expires_at: range.expires_at.toISOString()
    });
  } catch (error: any) {
    console.error('[OrderRange] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Paso 4.5: Integrar en cliente (Dexie)

**Archivo:** `src/core/sync/order-number-client.ts` (NUEVO)

```typescript
/**
 * Cliente para manejo de números de orden en terminal.
 * Mantiene rango en memoria y sincroniza con servidor.
 */

interface LocalRange {
  range_start: number;
  range_end: number;
  current: number;
  expires_at: Date;
}

let localRange: LocalRange | null = null;

export async function getNextOrderNumber(
  tenantId: string,
  terminalId: string
): Promise<string> {
  
  // 1. Verificar si tenemos rango válido local
  if (localRange && isRangeValid(localRange)) {
    const num = localRange.current;
    localRange.current++;
    return formatOrderNumber(num);
  }

  // 2. Solicitar nuevo rango al servidor
  try {
    const response = await fetch(`/api/terminals/${terminalId}/order-range`, {
      headers: { 'x-tenant-id': tenantId }
    });

    if (!response.ok) {
      throw new Error('Failed to get order range');
    }

    const data = await response.json();
    localRange = {
      range_start: data.range_start,
      range_end: data.range_end,
      current: data.current,
      expires_at: new Date(data.expires_at)
    };

    const num = localRange.current;
    localRange.current++;
    return formatOrderNumber(num);

  } catch (error) {
    // 3. Fallback offline: usar timestamp + random
    console.warn('[OrderNumber] Offline, using fallback');
    return generateOfflineFallback();
  }
}

function isRangeValid(range: LocalRange): boolean {
  return range.current <= range.range_end && 
         range.expires_at > new Date();
}

function formatOrderNumber(num: number): string {
  return num.toString().padStart(3, '0');
}

function generateOfflineFallback(): string {
  // Formato: X + últimos 2 dígitos del minuto + random 2 dígitos
  // Ej: X4523 (indica que es offline)
  const min = new Date().getMinutes().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `X${min}${rand}`;
}
```

### ✅ Criterios de Aceptación Fase 4

- [ ] Tablas `order_number_ranges` y `order_number_counters` existen
- [ ] Cada terminal recibe rango exclusivo de 100 números
- [ ] Rangos expiran en 24 horas
- [ ] Reset diario a las 5 AM
- [ ] Fallback offline genera números con prefijo "X"
- [ ] No hay colisiones entre terminales

---

## FASE 5: Timezone Handling

**Problema:** Eventos con timestamps inconsistentes causan reportes incorrectos y problemas de ordenamiento.  
**Tiempo:** 3 horas  
**Prioridad:** 🟡 ALTO

### Contexto del Problema

```
PROBLEMA:
Terminal A (reloj adelantado): 14:05:00
Terminal B (reloj correcto):   14:00:00
Servidor:                      14:02:00

Evento de A llega con occurred_at = 14:05:00
Evento de B llega con occurred_at = 14:00:00
→ Orden incorrecto en reportes
→ "Venta del futuro" aparece antes que ventas actuales
```

### Paso 5.1: Agregar campo server_received_at

**Archivo:** `prisma/schema.prisma`

Modificar modelo Event:
```prisma
model Event {
  event_id          String   @id @db.Uuid
  tenant_id         String   @db.Uuid
  terminal_id       String   @db.Uuid
  event_type        String
  payload           Json
  occurred_at       DateTime @db.Timestamptz  // Timestamp del cliente
  server_received_at DateTime @default(now()) @db.Timestamptz  // NUEVO: Timestamp del servidor
  actor_id          String?  @db.Uuid
  version           Int      @default(1)
  
  @@index([tenant_id, server_received_at])  // Índice para ordenar por recepción
  @@index([tenant_id, occurred_at])
  @@map("events")
}
```

### Paso 5.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_server_received_at
```

### Paso 5.3: Crear utilidades de timezone

**Archivo:** `src/core/utils/timezone.ts` (NUEVO)

```typescript
/**
 * Utilidades para manejo consistente de timezones.
 * PARK POS opera en Perú (America/Lima, UTC-5).
 */

export const PERU_TIMEZONE = 'America/Lima';
export const PERU_OFFSET_HOURS = -5;

// Tolerancia para clock skew (5 minutos)
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// Hora de inicio del día operativo (5 AM)
export const OPERATIVE_DAY_START_HOUR = 5;

/**
 * Obtiene la fecha/hora actual en timezone de Perú.
 */
export function nowPeru(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: PERU_TIMEZONE }));
}

/**
 * Convierte una fecha a timezone de Perú.
 */
export function toPeru(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: PERU_TIMEZONE }));
}

/**
 * Obtiene el inicio del día operativo (5 AM del día actual en Perú).
 */
export function getOperativeDayStart(date: Date = new Date()): Date {
  const peru = toPeru(date);
  
  // Si es antes de las 5 AM, el día operativo es el anterior
  if (peru.getHours() < OPERATIVE_DAY_START_HOUR) {
    peru.setDate(peru.getDate() - 1);
  }
  
  peru.setHours(OPERATIVE_DAY_START_HOUR, 0, 0, 0);
  return peru;
}

/**
 * Obtiene el fin del día operativo (4:59:59 AM del día siguiente).
 */
export function getOperativeDayEnd(date: Date = new Date()): Date {
  const start = getOperativeDayStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(-1);
  return end;
}

/**
 * Valida que un timestamp del cliente no tenga clock skew excesivo.
 * Retorna el timestamp corregido si está dentro de tolerancia.
 */
export function validateAndCorrectTimestamp(
  clientTimestamp: Date,
  serverNow: Date = new Date()
): { valid: boolean; corrected: Date; skewMs: number } {
  
  const skewMs = clientTimestamp.getTime() - serverNow.getTime();
  
  // Si el cliente está en el futuro (reloj adelantado)
  if (skewMs > MAX_CLOCK_SKEW_MS) {
    return {
      valid: false,
      corrected: serverNow,
      skewMs
    };
  }
  
  // Si el cliente está muy en el pasado (más de 1 hora)
  if (skewMs < -60 * 60 * 1000) {
    return {
      valid: false,
      corrected: serverNow,
      skewMs
    };
  }
  
  // Dentro de tolerancia
  return {
    valid: true,
    corrected: clientTimestamp,
    skewMs
  };
}

/**
 * Formatea fecha para reportes en formato peruano.
 */
export function formatDatePeru(date: Date): string {
  return date.toLocaleDateString('es-PE', {
    timeZone: PERU_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea hora para reportes.
 */
export function formatTimePeru(date: Date): string {
  return date.toLocaleTimeString('es-PE', {
    timeZone: PERU_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Obtiene el ID del día operativo (YYYY-MM-DD).
 * Útil para agrupar ventas por día.
 */
export function getOperativeDayId(date: Date = new Date()): string {
  const start = getOperativeDayStart(date);
  return start.toISOString().split('T')[0];
}
```

### Paso 5.4: Integrar validación en ingest

**Archivo:** `src/app/api/events/ingest/route.ts`

**Agregar import:**
```typescript
import { validateAndCorrectTimestamp } from "@/core/utils/timezone";
```

**Modificar procesamiento de eventos:**
```typescript
const serverNow = new Date();

for (const ev of events as ParkEvent[]) {
  // 1. Validar y corregir timestamp
  const timestampCheck = validateAndCorrectTimestamp(
    new Date(ev.occurred_at),
    serverNow
  );

  if (!timestampCheck.valid) {
    console.warn(
      `[Ingest] Clock skew detected for terminal ${ev.terminal_id}: ${timestampCheck.skewMs}ms`
    );
  }

  // 2. Guardar evento con ambos timestamps
  try {
    await tx.event.create({
      data: {
        event_id: ev.event_id,
        tenant_id: ev.tenant_id,
        terminal_id: ev.terminal_id,
        event_type: ev.event_type,
        payload: ev.payload,
        occurred_at: timestampCheck.corrected, // Timestamp corregido
        server_received_at: serverNow,          // Timestamp del servidor
        actor_id: ev.actor_id,
        version: ev.version || 1
      }
    });
  } catch (e: any) {
    // ... manejo existente
  }
}
```

### Paso 5.5: Usar server_received_at en queries de reportes

**Archivo:** `src/core/queries/sales-report.ts` (ejemplo)

```typescript
import { getOperativeDayStart, getOperativeDayEnd } from "@/core/utils/timezone";

/**
 * Obtiene ventas del día operativo actual.
 * USA server_received_at para ordenamiento consistente.
 */
export async function getDailySales(tenantId: string, date?: Date) {
  const dayStart = getOperativeDayStart(date);
  const dayEnd = getOperativeDayEnd(date);

  return await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      status: { in: ['paid', 'closed'] },
      // Usar server_received_at para consistencia
      created_at: {
        gte: dayStart,
        lte: dayEnd
      }
    },
    orderBy: {
      created_at: 'asc' // Orden por recepción en servidor
    }
  });
}

/**
 * Obtiene eventos para replay/debug.
 * Ordena por server_received_at para reproducibilidad.
 */
export async function getEventsForReplay(
  tenantId: string,
  fromDate: Date,
  toDate: Date
) {
  return await prisma.event.findMany({
    where: {
      tenant_id: tenantId,
      server_received_at: {
        gte: fromDate,
        lte: toDate
      }
    },
    orderBy: [
      { server_received_at: 'asc' },
      { event_id: 'asc' } // Desempate determinístico
    ]
  });
}
```

### ✅ Criterios de Aceptación Fase 5

- [ ] Campo `server_received_at` existe en tabla events
- [ ] Timestamps del cliente se validan contra servidor
- [ ] Clock skew > 5 minutos se corrige automáticamente
- [ ] Reportes usan `server_received_at` para ordenamiento
- [ ] Día operativo empieza a las 5 AM (Perú)
- [ ] Utilidades de timezone documentadas y testeadas

---

## FASE 6: Límites y Validaciones de Seguridad

**Problema:** Sin límites, un atacante o bug puede saturar el sistema con datos excesivos.  
**Tiempo:** 4 horas  
**Prioridad:** 🟡 ALTO

### Paso 6.1: Agregar constantes de límites

**Archivo:** `src/core/constants/limits.ts` (NUEVO)

```typescript
/**
 * Límites del sistema para prevenir abuso y garantizar rendimiento.
 */

export const SYSTEM_LIMITS = {
  // ============================================================================
  // API LIMITS
  // ============================================================================
  
  /** Máximo eventos por request de ingest */
  MAX_EVENTS_PER_INGEST: 100,
  
  /** Tamaño máximo de payload JSON (bytes) */
  MAX_PAYLOAD_SIZE_BYTES: 1024 * 1024, // 1 MB
  
  /** Tamaño máximo de un evento individual (bytes) */
  MAX_EVENT_SIZE_BYTES: 64 * 1024, // 64 KB
  
  /** Requests por minuto por terminal */
  RATE_LIMIT_PER_TERMINAL: 60,
  
  /** Requests por minuto por tenant */
  RATE_LIMIT_PER_TENANT: 500,

  // ============================================================================
  // DATA LIMITS
  // ============================================================================
  
  /** Máximo líneas por orden */
  MAX_LINES_PER_ORDER: 50,
  
  /** Máximo modificadores por línea */
  MAX_MODIFIERS_PER_LINE: 10,
  
  /** Máximo pagos por orden */
  MAX_PAYMENTS_PER_ORDER: 10,
  
  /** Máximo caracteres en notas */
  MAX_NOTES_LENGTH: 500,
  
  /** Máximo órdenes abiertas por terminal */
  MAX_OPEN_ORDERS_PER_TERMINAL: 20,
  
  /** Máximo productos en catálogo */
  MAX_PRODUCTS_PER_TENANT: 1000,

  // ============================================================================
  // STORAGE LIMITS
  // ============================================================================
  
  /** Días de retención de eventos procesados */
  PROCESSED_EVENTS_RETENTION_DAYS: 7,
  
  /** Días de retención de outbox completados */
  OUTBOX_RETENTION_DAYS: 1,
  
  /** Máximo eventos en IndexedDB antes de cleanup */
  MAX_INDEXEDDB_EVENTS: 10000,
  
  /** Días de eventos en IndexedDB */
  INDEXEDDB_RETENTION_DAYS: 30,

  // ============================================================================
  // SYNC LIMITS
  // ============================================================================
  
  /** Máximo eventos por sync batch */
  MAX_SYNC_BATCH_SIZE: 50,
  
  /** Timeout de sync request (ms) */
  SYNC_TIMEOUT_MS: 30000,
  
  /** Máximo reintentos de sync */
  MAX_SYNC_RETRIES: 5,
  
  /** Backoff inicial para retry (ms) */
  SYNC_RETRY_BACKOFF_MS: 1000,

} as const;

export type SystemLimits = typeof SYSTEM_LIMITS;
```

### Paso 6.2: Middleware de validación de tamaño

**Archivo:** `src/core/middleware/size-validator.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_LIMITS } from "@/core/constants/limits";

/**
 * Valida tamaño del request antes de procesarlo.
 */
export async function validateRequestSize(
  request: NextRequest
): Promise<{ valid: boolean; error?: string }> {
  
  // 1. Verificar Content-Length header
  const contentLength = request.headers.get('content-length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > SYSTEM_LIMITS.MAX_PAYLOAD_SIZE_BYTES) {
      return {
        valid: false,
        error: `Payload too large: ${size} bytes (max: ${SYSTEM_LIMITS.MAX_PAYLOAD_SIZE_BYTES})`
      };
    }
  }

  return { valid: true };
}

/**
 * Valida array de eventos.
 */
export function validateEventsArray(events: unknown[]): { valid: boolean; error?: string } {
  // 1. Verificar cantidad
  if (events.length > SYSTEM_LIMITS.MAX_EVENTS_PER_INGEST) {
    return {
      valid: false,
      error: `Too many events: ${events.length} (max: ${SYSTEM_LIMITS.MAX_EVENTS_PER_INGEST})`
    };
  }

  // 2. Verificar tamaño individual
  for (let i = 0; i < events.length; i++) {
    const eventSize = JSON.stringify(events[i]).length;
    if (eventSize > SYSTEM_LIMITS.MAX_EVENT_SIZE_BYTES) {
      return {
        valid: false,
        error: `Event ${i} too large: ${eventSize} bytes (max: ${SYSTEM_LIMITS.MAX_EVENT_SIZE_BYTES})`
      };
    }
  }

  return { valid: true };
}
```

### Paso 6.3: Rate Limiting simple

**Archivo:** `src/core/middleware/rate-limiter.ts` (NUEVO)

```typescript
import { SYSTEM_LIMITS } from "@/core/constants/limits";

/**
 * Rate limiter en memoria (para MVP).
 * En producción usar Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const terminalLimits = new Map<string, RateLimitEntry>();
const tenantLimits = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minuto

/**
 * Verifica y actualiza rate limit.
 * Retorna true si está dentro del límite.
 */
export function checkRateLimit(
  type: 'terminal' | 'tenant',
  id: string
): { allowed: boolean; remaining: number; resetIn: number } {
  
  const limits = type === 'terminal' ? terminalLimits : tenantLimits;
  const maxRequests = type === 'terminal' 
    ? SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL 
    : SYSTEM_LIMITS.RATE_LIMIT_PER_TENANT;

  const now = Date.now();
  let entry = limits.get(id);

  // Reset si la ventana expiró
  if (!entry || entry.resetAt <= now) {
    entry = {
      count: 0,
      resetAt: now + WINDOW_MS
    };
  }

  entry.count++;
  limits.set(id, entry);

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetIn = Math.max(0, entry.resetAt - now);

  return { allowed, remaining, resetIn };
}

/**
 * Middleware para aplicar rate limiting.
 */
export function rateLimitMiddleware(
  tenantId: string,
  terminalId: string
): { allowed: boolean; headers: Record<string, string> } {
  
  const tenantCheck = checkRateLimit('tenant', tenantId);
  const terminalCheck = checkRateLimit('terminal', `${tenantId}:${terminalId}`);

  const allowed = tenantCheck.allowed && terminalCheck.allowed;
  
  return {
    allowed,
    headers: {
      'X-RateLimit-Limit': SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL.toString(),
      'X-RateLimit-Remaining': Math.min(tenantCheck.remaining, terminalCheck.remaining).toString(),
      'X-RateLimit-Reset': Math.max(tenantCheck.resetIn, terminalCheck.resetIn).toString()
    }
  };
}

// Cleanup periódico de entradas expiradas
setInterval(() => {
  const now = Date.now();
  
  for (const [key, entry] of terminalLimits) {
    if (entry.resetAt <= now) {
      terminalLimits.delete(key);
    }
  }
  
  for (const [key, entry] of tenantLimits) {
    if (entry.resetAt <= now) {
      tenantLimits.delete(key);
    }
  }
}, 60 * 1000); // Cada minuto
```

### Paso 6.4: Integrar en ingest

**Archivo:** `src/app/api/events/ingest/route.ts`

**Agregar imports:**
```typescript
import { validateRequestSize, validateEventsArray } from "@/core/middleware/size-validator";
import { rateLimitMiddleware } from "@/core/middleware/rate-limiter";
```

**Agregar al inicio del handler:**
```typescript
export async function POST(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  const terminalId = request.headers.get('x-terminal-id');

  if (!tenantId || !terminalId) {
    return NextResponse.json(
      { error: 'Missing tenant or terminal ID' },
      { status: 400 }
    );
  }

  // 1. Rate limiting
  const rateLimit = rateLimitMiddleware(tenantId, terminalId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: rateLimit.headers }
    );
  }

  // 2. Validar tamaño del request
  const sizeCheck = await validateRequestSize(request);
  if (!sizeCheck.valid) {
    return NextResponse.json(
      { error: sizeCheck.error },
      { status: 413 }
    );
  }

  // 3. Parsear body
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const events = body.events || [body];

  // 4. Validar array de eventos
  const eventsCheck = validateEventsArray(events);
  if (!eventsCheck.valid) {
    return NextResponse.json(
      { error: eventsCheck.error },
      { status: 400 }
    );
  }

  // ... resto del procesamiento
}
```

### Paso 6.5: Cleanup de IndexedDB en cliente

**Archivo:** `src/core/sync/indexeddb-cleanup.ts` (NUEVO)

```typescript
import { db } from "@/core/db/dexie";
import { SYSTEM_LIMITS } from "@/core/constants/limits";

/**
 * Limpia eventos antiguos de IndexedDB.
 * Ejecutar periódicamente en el cliente.
 */
export async function cleanupIndexedDB(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - SYSTEM_LIMITS.INDEXEDDB_RETENTION_DAYS);

  // 1. Eliminar eventos antiguos
  const deletedEvents = await db.events
    .where('occurred_at')
    .below(cutoffDate)
    .delete();

  // 2. Si aún hay demasiados, eliminar los más antiguos
  const totalEvents = await db.events.count();
  
  if (totalEvents > SYSTEM_LIMITS.MAX_INDEXEDDB_EVENTS) {
    const excess = totalEvents - SYSTEM_LIMITS.MAX_INDEXEDDB_EVENTS;
    const oldestEvents = await db.events
      .orderBy('occurred_at')
      .limit(excess)
      .primaryKeys();
    
    await db.events.bulkDelete(oldestEvents);
    
    console.log(`[Cleanup] Deleted ${excess} excess events from IndexedDB`);
    return deletedEvents + excess;
  }

  console.log(`[Cleanup] Deleted ${deletedEvents} old events from IndexedDB`);
  return deletedEvents;
}

/**
 * Obtiene estadísticas de uso de IndexedDB.
 */
export async function getIndexedDBStats() {
  const eventsCount = await db.events.count();
  const ordersCount = await db.orders.count();
  
  // Estimar tamaño (aproximado)
  const estimatedSizeKB = (eventsCount * 2 + ordersCount * 1); // ~2KB por evento, ~1KB por orden
  
  return {
    events: eventsCount,
    orders: ordersCount,
    estimatedSizeKB,
    limits: {
      maxEvents: SYSTEM_LIMITS.MAX_INDEXEDDB_EVENTS,
      retentionDays: SYSTEM_LIMITS.INDEXEDDB_RETENTION_DAYS
    }
  };
}
```

### ✅ Criterios de Aceptación Fase 6

- [ ] Constantes de límites centralizadas en `limits.ts`
- [ ] Requests > 1MB rechazados con 413
- [ ] Más de 100 eventos por request rechazados
- [ ] Rate limiting: 60 req/min por terminal
- [ ] Rate limiting: 500 req/min por tenant
- [ ] Headers de rate limit en responses
- [ ] Cleanup de IndexedDB implementado

---

## FASE 7: Índices de Performance

**Problema:** Queries lentas en tablas grandes sin índices apropiados.  
**Tiempo:** 2 horas  
**Prioridad:** 🟡 ALTO

### Contexto del Problema

```
SIN ÍNDICES:
SELECT * FROM orders WHERE tenant_id = X AND status = 'open'
→ Full table scan: 500ms con 100K órdenes

CON ÍNDICES:
→ Index scan: 5ms
```

### Paso 7.1: Agregar índices a Prisma schema

**Archivo:** `prisma/schema.prisma`

Agregar índices a los modelos existentes:

```prisma
model Event {
  event_id           String   @id @db.Uuid
  tenant_id          String   @db.Uuid
  terminal_id        String   @db.Uuid
  event_type         String
  payload            Json
  occurred_at        DateTime @db.Timestamptz
  server_received_at DateTime @default(now()) @db.Timestamptz
  actor_id           String?  @db.Uuid
  version            Int      @default(1)

  // ÍNDICES CRÍTICOS
  @@index([tenant_id, server_received_at])           // Queries por fecha
  @@index([tenant_id, event_type, server_received_at]) // Filtro por tipo
  @@index([tenant_id, terminal_id, server_received_at]) // Por terminal
  @@map("events")
}

model Order {
  order_id       String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  terminal_id    String   @db.Uuid
  order_number   String
  status         String   @default("open")
  order_type     String   @default("dine_in")
  table_id       String?  @db.Uuid
  customer_name  String?
  subtotal_cents Int      @default(0)
  discount_cents Int      @default(0)
  tax_cents      Int      @default(0)
  total_cents    Int      @default(0)
  paid_cents     Int      @default(0)
  created_at     DateTime @default(now()) @db.Timestamptz
  updated_at     DateTime @updatedAt @db.Timestamptz
  closed_at      DateTime? @db.Timestamptz

  lines    OrderLine[]
  payments Payment[]

  // ÍNDICES CRÍTICOS
  @@unique([tenant_id, order_number])                // Búsqueda por número
  @@index([tenant_id, status])                       // Órdenes abiertas
  @@index([tenant_id, status, created_at])           // Listado con fecha
  @@index([tenant_id, terminal_id, status])          // Por terminal
  @@index([tenant_id, table_id, status])             // Por mesa
  @@index([tenant_id, created_at])                   // Reportes diarios
  @@index([tenant_id, closed_at])                    // Ventas cerradas
  @@map("orders")
}

model OrderLine {
  line_id          String  @id @db.Uuid
  order_id         String  @db.Uuid
  product_id       String  @db.Uuid
  variant_id       String? @db.Uuid
  product_name     String
  variant_name     String?
  qty              Int
  unit_price_cents Int
  discount_percent Int     @default(0)
  subtotal_cents   Int
  notes            String?
  status           String  @default("pending")
  
  order Order @relation(fields: [order_id], references: [order_id])

  // ÍNDICES
  @@index([order_id])                    // JOIN con orden
  @@index([product_id])                  // Reportes por producto
  @@map("order_lines")
}

model Payment {
  payment_id   String   @id @db.Uuid
  order_id     String   @db.Uuid
  method       String
  amount_cents Int
  reference    String?
  created_at   DateTime @default(now()) @db.Timestamptz

  order Order @relation(fields: [order_id], references: [order_id])

  // ÍNDICES
  @@index([order_id])                    // JOIN con orden
  @@index([method, created_at])          // Reportes por método
  @@map("payments")
}

model Shift {
  shift_id            String    @id @db.Uuid
  tenant_id           String    @db.Uuid
  terminal_id         String    @db.Uuid
  cashier_id          String    @db.Uuid
  status              String    @default("open")
  opening_cash_cents  Int
  expected_cash_cents Int       @default(0)
  counted_cash_cents  Int?
  variance_cents      Int?
  opened_at           DateTime  @default(now()) @db.Timestamptz
  closed_at           DateTime? @db.Timestamptz

  // ÍNDICES
  @@index([tenant_id, status])                      // Turnos abiertos
  @@index([tenant_id, terminal_id, status])         // Por terminal
  @@index([tenant_id, cashier_id, opened_at])       // Por cajero
  @@index([tenant_id, opened_at])                   // Reportes
  @@map("shifts")
}

model Product {
  product_id  String  @id @db.Uuid
  tenant_id   String  @db.Uuid
  category_id String  @db.Uuid
  name        String
  sku         String?
  price_cents Int
  is_active   Boolean @default(true)
  sort_order  Int     @default(0)

  variants ProductVariant[]

  // ÍNDICES
  @@unique([tenant_id, sku])                        // Búsqueda por SKU
  @@index([tenant_id, category_id, is_active])      // Catálogo activo
  @@index([tenant_id, is_active, sort_order])       // Listado ordenado
  @@map("products")
}
```

### Paso 7.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_performance_indices
```

### Paso 7.3: Crear índices adicionales con SQL raw

**Archivo:** `prisma/migrations/XXXXXX_add_custom_indices/migration.sql`

Para índices más avanzados que Prisma no soporta directamente:

```sql
-- Índice parcial: solo órdenes abiertas (más eficiente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_open 
ON orders (tenant_id, created_at) 
WHERE status IN ('open', 'in_progress');

-- Índice parcial: solo turnos abiertos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_open 
ON shifts (tenant_id, terminal_id) 
WHERE status = 'open';

-- Índice para búsqueda de texto en productos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_search 
ON products USING gin (to_tsvector('spanish', name));

-- Índice para JSONB payload (búsquedas específicas)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_payload_order_id 
ON events ((payload->>'order_id')) 
WHERE event_type LIKE 'ORDER_%';

-- Estadísticas extendidas para mejor planificación
CREATE STATISTICS IF NOT EXISTS orders_tenant_status 
ON tenant_id, status FROM orders;

-- Índice BRIN para eventos (muy eficiente para datos temporales)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_brin 
ON events USING brin (server_received_at) 
WITH (pages_per_range = 32);
```

### Paso 7.4: Script de análisis de queries lentas

**Archivo:** `scripts/analyze-slow-queries.sql`

```sql
-- Habilitar logging de queries lentas (ejecutar como admin)
-- ALTER SYSTEM SET log_min_duration_statement = 100; -- 100ms
-- SELECT pg_reload_conf();

-- Ver queries más lentas (requiere pg_stat_statements)
SELECT 
  substring(query, 1, 100) as query_preview,
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) as percent
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;

-- Ver índices no utilizados
SELECT 
  schemaname || '.' || relname as table,
  indexrelname as index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) as size,
  idx_scan as scans
FROM pg_stat_user_indexes i
JOIN pg_index USING (indexrelid)
WHERE idx_scan = 0
  AND NOT indisunique
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- Ver tablas que necesitan VACUUM
SELECT 
  schemaname || '.' || relname as table,
  n_dead_tup as dead_rows,
  n_live_tup as live_rows,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) as dead_percent,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### Paso 7.5: Configuración de auto-vacuum

**Archivo:** `sql/003_vacuum_config.sql`

```sql
-- Configurar auto-vacuum más agresivo para tablas de alto tráfico
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- 5% en vez de 20%
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE order_lines SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- Actualizar estadísticas
ANALYZE events;
ANALYZE orders;
ANALYZE order_lines;
ANALYZE payments;
ANALYZE shifts;
ANALYZE products;
```

### ✅ Criterios de Aceptación Fase 7

- [ ] Índices agregados a schema Prisma
- [ ] Índices parciales para órdenes/turnos abiertos
- [ ] Índice BRIN para eventos (eficiente en datos temporales)
- [ ] Script de análisis de queries lentas
- [ ] Auto-vacuum configurado para tablas de alto tráfico
- [ ] Query de órdenes abiertas < 10ms

---

## FASE 8: Seguridad de API

**Problema:** APIs expuestas sin autenticación/autorización adecuada.  
**Tiempo:** 4 horas  
**Prioridad:** 🔴 CRÍTICO

### Contexto del Problema

```
ACTUAL:
Cualquiera con el tenant_id puede enviar eventos
→ Atacante puede inyectar ventas falsas
→ Atacante puede cerrar turnos ajenos
→ Sin auditoría de quién hizo qué

CORRECTO:
Terminal autenticado + API Key + Validación de permisos
```

### Paso 8.1: Modelo de API Keys

**Archivo:** `prisma/schema.prisma`

```prisma
// ============================================================================
// SECURITY: API Keys & Terminal Authentication
// ============================================================================

model ApiKey {
  id          String   @id @default(uuid()) @db.Uuid
  tenant_id   String   @db.Uuid
  terminal_id String?  @db.Uuid  // null = key de admin
  key_hash    String   @unique   // SHA-256 del key
  key_prefix  String             // Primeros 8 chars para identificar
  name        String             // "Terminal Caja 1", "Admin Key"
  permissions String[]           // ["events:write", "orders:read", etc]
  is_active   Boolean  @default(true)
  last_used   DateTime?
  expires_at  DateTime?
  created_at  DateTime @default(now())
  created_by  String   @db.Uuid

  @@index([tenant_id, is_active])
  @@index([key_hash])
  @@map("api_keys")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  tenant_id   String   @db.Uuid
  terminal_id String?  @db.Uuid
  actor_id    String?  @db.Uuid
  action      String             // "events:ingest", "shift:close", etc
  resource    String?            // ID del recurso afectado
  ip_address  String?
  user_agent  String?
  status      String             // "success", "denied", "error"
  details     Json?
  created_at  DateTime @default(now()) @db.Timestamptz

  @@index([tenant_id, created_at])
  @@index([tenant_id, actor_id, created_at])
  @@index([tenant_id, action, created_at])
  @@map("audit_logs")
}
```

### Paso 8.2: Ejecutar migración

```bash
npx prisma migrate dev --name add_api_keys_audit
```

### Paso 8.3: Servicio de API Keys

**Archivo:** `src/core/auth/api-key.service.ts` (NUEVO)

```typescript
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const KEY_LENGTH = 32; // 256 bits
const PREFIX_LENGTH = 8;

export interface ApiKeyInfo {
  id: string;
  tenant_id: string;
  terminal_id: string | null;
  permissions: string[];
  name: string;
}

/**
 * Genera una nueva API key.
 * Retorna el key en texto plano (solo esta vez).
 */
export async function generateApiKey(
  tenantId: string,
  terminalId: string | null,
  name: string,
  permissions: string[],
  createdBy: string,
  expiresAt?: Date
): Promise<{ key: string; keyInfo: ApiKeyInfo }> {
  
  // Generar key random
  const keyBytes = crypto.randomBytes(KEY_LENGTH);
  const key = `pk_${keyBytes.toString('base64url')}`; // pk_ prefix para identificar
  
  // Hash para almacenar
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.substring(0, PREFIX_LENGTH + 3); // "pk_XXXXX"

  const apiKey = await prisma.apiKey.create({
    data: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      permissions,
      expires_at: expiresAt,
      created_by: createdBy
    }
  });

  return {
    key, // Solo se muestra una vez
    keyInfo: {
      id: apiKey.id,
      tenant_id: apiKey.tenant_id,
      terminal_id: apiKey.terminal_id,
      permissions: apiKey.permissions,
      name: apiKey.name
    }
  };
}

/**
 * Valida una API key y retorna su información.
 */
export async function validateApiKey(key: string): Promise<ApiKeyInfo | null> {
  if (!key || !key.startsWith('pk_')) {
    return null;
  }

  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { key_hash: keyHash }
  });

  if (!apiKey) {
    return null;
  }

  // Verificar si está activa
  if (!apiKey.is_active) {
    return null;
  }

  // Verificar expiración
  if (apiKey.expires_at && apiKey.expires_at < new Date()) {
    return null;
  }

  // Actualizar last_used (async, no bloquea)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { last_used: new Date() }
  }).catch(() => {}); // Ignorar errores

  return {
    id: apiKey.id,
    tenant_id: apiKey.tenant_id,
    terminal_id: apiKey.terminal_id,
    permissions: apiKey.permissions,
    name: apiKey.name
  };
}

/**
 * Verifica si una key tiene un permiso específico.
 */
export function hasPermission(keyInfo: ApiKeyInfo, permission: string): boolean {
  // Admin tiene todos los permisos
  if (keyInfo.permissions.includes('*')) {
    return true;
  }

  // Permiso exacto
  if (keyInfo.permissions.includes(permission)) {
    return true;
  }

  // Permiso wildcard (ej: "events:*" incluye "events:write")
  const [resource] = permission.split(':');
  if (keyInfo.permissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * Revocar una API key.
 */
export async function revokeApiKey(keyId: string, tenantId: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { 
      id: keyId, 
      tenant_id: tenantId 
    },
    data: { is_active: false }
  });

  return result.count > 0;
}
```

### Paso 8.4: Middleware de autenticación

**Archivo:** `src/core/auth/auth.middleware.ts` (NUEVO)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasPermission, ApiKeyInfo } from "./api-key.service";
import { prisma } from "@/core/lib/prisma";

export interface AuthContext {
  keyInfo: ApiKeyInfo;
  tenantId: string;
  terminalId: string | null;
}

/**
 * Middleware de autenticación para APIs.
 */
export async function authenticateRequest(
  request: NextRequest,
  requiredPermission?: string
): Promise<{ success: true; context: AuthContext } | { success: false; response: NextResponse }> {
  
  // 1. Extraer API key del header
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      )
    };
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer "

  // 2. Validar key
  const keyInfo = await validateApiKey(apiKey);
  
  if (!keyInfo) {
    await logAuditEvent({
      action: 'auth:failed',
      status: 'denied',
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      details: { reason: 'Invalid API key' }
    });

    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 }
      )
    };
  }

  // 3. Verificar permiso si se requiere
  if (requiredPermission && !hasPermission(keyInfo, requiredPermission)) {
    await logAuditEvent({
      tenant_id: keyInfo.tenant_id,
      terminal_id: keyInfo.terminal_id,
      action: 'auth:forbidden',
      status: 'denied',
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      details: { 
        required: requiredPermission,
        has: keyInfo.permissions 
      }
    });

    return {
      success: false,
      response: NextResponse.json(
        { error: `Permission denied: ${requiredPermission}` },
        { status: 403 }
      )
    };
  }

  // 4. Verificar que terminal_id del header coincide (si aplica)
  const headerTerminalId = request.headers.get('x-terminal-id');
  if (keyInfo.terminal_id && headerTerminalId && keyInfo.terminal_id !== headerTerminalId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Terminal ID mismatch' },
        { status: 403 }
      )
    };
  }

  return {
    success: true,
    context: {
      keyInfo,
      tenantId: keyInfo.tenant_id,
      terminalId: keyInfo.terminal_id || headerTerminalId
    }
  };
}

/**
 * Registra evento de auditoría.
 */
export async function logAuditEvent(data: {
  tenant_id?: string;
  terminal_id?: string | null;
  actor_id?: string;
  action: string;
  resource?: string;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'denied' | 'error';
  details?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        tenant_id: data.tenant_id || '00000000-0000-0000-0000-000000000000',
        terminal_id: data.terminal_id,
        actor_id: data.actor_id,
        action: data.action,
        resource: data.resource,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        status: data.status,
        details: data.details
      }
    });
  } catch (e) {
    console.error('[Audit] Failed to log:', e);
  }
}
```

### Paso 8.5: Integrar en ingest

**Archivo:** `src/app/api/events/ingest/route.ts`

**Agregar al inicio:**
```typescript
import { authenticateRequest, logAuditEvent } from "@/core/auth/auth.middleware";

export async function POST(request: NextRequest) {
  // 1. Autenticar
  const auth = await authenticateRequest(request, 'events:write');
  
  if (!auth.success) {
    return auth.response;
  }

  const { tenantId, terminalId } = auth.context;

  // ... resto del código usando tenantId y terminalId del contexto auth
  
  // Al final, loguear éxito
  await logAuditEvent({
    tenant_id: tenantId,
    terminal_id: terminalId,
    action: 'events:ingest',
    status: 'success',
    details: { 
      events_count: events.length,
      accepted: acceptedCount 
    }
  });
}
```

### Paso 8.6: Permisos por rol

**Archivo:** `src/core/auth/permissions.ts` (NUEVO)

```typescript
/**
 * Definición de permisos por rol.
 */

export const PERMISSIONS = {
  // Eventos
  'events:write': 'Enviar eventos al servidor',
  'events:read': 'Leer eventos históricos',
  
  // Órdenes
  'orders:create': 'Crear órdenes',
  'orders:read': 'Ver órdenes',
  'orders:update': 'Modificar órdenes',
  'orders:delete': 'Anular órdenes',
  'orders:discount': 'Aplicar descuentos',
  'orders:discount:high': 'Aplicar descuentos > 20%',
  
  // Pagos
  'payments:create': 'Registrar pagos',
  'payments:refund': 'Procesar devoluciones',
  
  // Turnos
  'shifts:open': 'Abrir turno',
  'shifts:close': 'Cerrar turno',
  'shifts:read': 'Ver turnos',
  
  // Catálogo
  'catalog:read': 'Ver catálogo',
  'catalog:write': 'Modificar catálogo',
  
  // Admin
  'admin:keys': 'Gestionar API keys',
  'admin:users': 'Gestionar usuarios',
  'admin:reports': 'Ver reportes',
  '*': 'Todos los permisos'
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Permisos predefinidos por rol.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  terminal: [
    'events:write',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:discount',
    'payments:create',
    'shifts:open',
    'shifts:close',
    'catalog:read'
  ],
  
  cashier: [
    'events:write',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:discount',
    'orders:discount:high',
    'payments:create',
    'payments:refund',
    'shifts:open',
    'shifts:close',
    'shifts:read',
    'catalog:read'
  ],
  
  manager: [
    'events:write',
    'events:read',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:delete',
    'orders:discount',
    'orders:discount:high',
    'payments:create',
    'payments:refund',
    'shifts:open',
    'shifts:close',
    'shifts:read',
    'catalog:read',
    'catalog:write',
    'admin:reports'
  ],
  
  admin: ['*']
};
```

### ✅ Criterios de Aceptación Fase 8

- [ ] Tabla `api_keys` con hash seguro
- [ ] Tabla `audit_logs` para trazabilidad
- [ ] Middleware de autenticación funcional
- [ ] API keys con permisos granulares
- [ ] Requests sin auth retornan 401
- [ ] Requests sin permiso retornan 403
- [ ] Auditoría de accesos exitosos y fallidos

---

## FASE 9: Tests de Validación

**Problema:** Sin tests, no hay garantía de que las implementaciones funcionen correctamente.  
**Tiempo:** 6 horas  
**Prioridad:** 🟡 ALTO

### Paso 9.1: Configurar Vitest

**Archivo:** `vitest.config.ts` (verificar/actualizar)

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts']
    },
    setupFiles: ['./src/test/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Paso 9.2: Setup de tests

**Archivo:** `src/test/setup.ts` (NUEVO)

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Cliente de Prisma para tests
export const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

beforeAll(async () => {
  // Conectar a DB de test
  await testPrisma.$connect();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  // Limpiar tablas antes de cada test (orden importante por FKs)
  await testPrisma.$transaction([
    testPrisma.auditLog.deleteMany(),
    testPrisma.eventOutbox.deleteMany(),
    testPrisma.processedEvent.deleteMany(),
    testPrisma.payment.deleteMany(),
    testPrisma.orderLine.deleteMany(),
    testPrisma.order.deleteMany(),
    testPrisma.shift.deleteMany(),
    testPrisma.event.deleteMany(),
    testPrisma.apiKey.deleteMany(),
  ]);
});
```

### Paso 9.3: Tests de Idempotencia

**Archivo:** `src/core/__tests__/idempotency.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { testPrisma } from '@/test/setup';

describe('Event Idempotency', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const terminalId = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    // Crear orden de prueba
    await testPrisma.order.create({
      data: {
        order_id: '33333333-3333-3333-3333-333333333333',
        tenant_id: tenantId,
        terminal_id: terminalId,
        order_number: '001',
        status: 'open',
        subtotal_cents: 0,
        total_cents: 0
      }
    });
  });

  it('should not duplicate projection when same event processed twice', async () => {
    const eventId = '44444444-4444-4444-4444-444444444444';
    const orderId = '33333333-3333-3333-3333-333333333333';

    // Simular primera proyección
    await testPrisma.$transaction(async (tx) => {
      // Verificar si ya procesado
      const existing = await tx.processedEvent.findUnique({
        where: { event_id: eventId }
      });
      expect(existing).toBeNull();

      // Marcar como procesado
      await tx.processedEvent.create({
        data: { event_id: eventId, tenant_id: tenantId }
      });

      // Actualizar orden
      await tx.order.update({
        where: { order_id: orderId },
        data: { subtotal_cents: { increment: 2500 } }
      });
    });

    // Verificar resultado
    let order = await testPrisma.order.findUnique({
      where: { order_id: orderId }
    });
    expect(order?.subtotal_cents).toBe(2500);

    // Simular segunda proyección (mismo event_id)
    await testPrisma.$transaction(async (tx) => {
      const existing = await tx.processedEvent.findUnique({
        where: { event_id: eventId }
      });
      
      // Debe existir, así que NO proyectamos
      expect(existing).not.toBeNull();
      // No hacemos update
    });

    // Verificar que NO se duplicó
    order = await testPrisma.order.findUnique({
      where: { order_id: orderId }
    });
    expect(order?.subtotal_cents).toBe(2500); // Sigue siendo 2500, no 5000
  });
});
```

### Paso 9.4: Tests de Validación de Negocio

**Archivo:** `src/core/__tests__/business-validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateEventPayload, BUSINESS_LIMITS } from '@/core/validation/business-rules';

describe('Business Rules Validation', () => {
  
  describe('ORDER_ITEM_ADDED', () => {
    const validPayload = {
      order_id: '11111111-1111-1111-1111-111111111111',
      line: {
        line_id: '22222222-2222-2222-2222-222222222222',
        product_id: '33333333-3333-3333-3333-333333333333',
        qty: 2,
        unit_price_cents: 2500
      }
    };

    it('should accept valid payload', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', validPayload);
      expect(result.valid).toBe(true);
    });

    it('should reject qty > MAX_ITEM_QUANTITY', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        ...validPayload,
        line: { ...validPayload.line, qty: 150 }
      });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('qty');
    });

    it('should reject qty < 1', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        ...validPayload,
        line: { ...validPayload.line, qty: 0 }
      });
      expect(result.valid).toBe(false);
    });

    it('should reject negative price', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        ...validPayload,
        line: { ...validPayload.line, unit_price_cents: -100 }
      });
      expect(result.valid).toBe(false);
    });

    it('should reject discount > 50%', () => {
      const result = validateEventPayload('ORDER_ITEM_ADDED', {
        ...validPayload,
        line: { ...validPayload.line, discount_percent: 75 }
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('PAYMENT_ADDED', () => {
    it('should reject cash > S/ 10,000', () => {
      const result = validateEventPayload('PAYMENT_ADDED', {
        order_id: '11111111-1111-1111-1111-111111111111',
        payment: {
          payment_id: '22222222-2222-2222-2222-222222222222',
          method: 'cash',
          amount_cents: 1500000 // S/ 15,000
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('10000');
    });

    it('should accept card > S/ 10,000', () => {
      const result = validateEventPayload('PAYMENT_ADDED', {
        order_id: '11111111-1111-1111-1111-111111111111',
        payment: {
          payment_id: '22222222-2222-2222-2222-222222222222',
          method: 'card',
          amount_cents: 1500000
        }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('ORDER_DISCOUNT_APPLIED', () => {
    it('should require authorization for discount > 20%', () => {
      const result = validateEventPayload('ORDER_DISCOUNT_APPLIED', {
        order_id: '11111111-1111-1111-1111-111111111111',
        discount: {
          type: 'percent',
          value: 25
          // Sin authorized_by
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors?.[0]).toContain('autorización');
    });

    it('should accept discount > 20% with authorization', () => {
      const result = validateEventPayload('ORDER_DISCOUNT_APPLIED', {
        order_id: '11111111-1111-1111-1111-111111111111',
        discount: {
          type: 'percent',
          value: 25,
          authorized_by: '44444444-4444-4444-4444-444444444444'
        }
      });
      expect(result.valid).toBe(true);
    });
  });
});
```

### Paso 9.5: Tests de Rate Limiting

**Archivo:** `src/core/__tests__/rate-limiter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit } from '@/core/middleware/rate-limiter';
import { SYSTEM_LIMITS } from '@/core/constants/limits';

describe('Rate Limiter', () => {
  // Note: En tests reales, mockear el tiempo o usar fake timers

  it('should allow requests within limit', () => {
    const terminalId = 'test-terminal-1';
    
    for (let i = 0; i < SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL; i++) {
      const result = checkRateLimit('terminal', terminalId);
      expect(result.allowed).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const terminalId = 'test-terminal-2';
    
    // Agotar el límite
    for (let i = 0; i < SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL; i++) {
      checkRateLimit('terminal', terminalId);
    }

    // El siguiente debe ser bloqueado
    const result = checkRateLimit('terminal', terminalId);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track remaining requests', () => {
    const terminalId = 'test-terminal-3';
    
    const result1 = checkRateLimit('terminal', terminalId);
    expect(result1.remaining).toBe(SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL - 1);

    const result2 = checkRateLimit('terminal', terminalId);
    expect(result2.remaining).toBe(SYSTEM_LIMITS.RATE_LIMIT_PER_TERMINAL - 2);
  });
});
```

### Paso 9.6: Tests de Timezone

**Archivo:** `src/core/__tests__/timezone.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  validateAndCorrectTimestamp, 
  getOperativeDayStart,
  getOperativeDayId,
  MAX_CLOCK_SKEW_MS 
} from '@/core/utils/timezone';

describe('Timezone Utils', () => {
  
  describe('validateAndCorrectTimestamp', () => {
    it('should accept timestamp within tolerance', () => {
      const serverNow = new Date('2026-01-05T14:00:00Z');
      const clientTime = new Date('2026-01-05T14:02:00Z'); // 2 min adelante
      
      const result = validateAndCorrectTimestamp(clientTime, serverNow);
      
      expect(result.valid).toBe(true);
      expect(result.corrected).toEqual(clientTime);
    });

    it('should reject and correct timestamp too far in future', () => {
      const serverNow = new Date('2026-01-05T14:00:00Z');
      const clientTime = new Date('2026-01-05T14:10:00Z'); // 10 min adelante
      
      const result = validateAndCorrectTimestamp(clientTime, serverNow);
      
      expect(result.valid).toBe(false);
      expect(result.corrected).toEqual(serverNow);
      expect(result.skewMs).toBeGreaterThan(MAX_CLOCK_SKEW_MS);
    });

    it('should reject timestamp too far in past', () => {
      const serverNow = new Date('2026-01-05T14:00:00Z');
      const clientTime = new Date('2026-01-05T12:00:00Z'); // 2 horas atrás
      
      const result = validateAndCorrectTimestamp(clientTime, serverNow);
      
      expect(result.valid).toBe(false);
    });
  });

  describe('getOperativeDayStart', () => {
    it('should return 5 AM of current day if after 5 AM', () => {
      const date = new Date('2026-01-05T14:00:00-05:00'); // 2 PM Perú
      const start = getOperativeDayStart(date);
      
      expect(start.getHours()).toBe(5);
      expect(start.getMinutes()).toBe(0);
    });

    it('should return 5 AM of previous day if before 5 AM', () => {
      const date = new Date('2026-01-05T03:00:00-05:00'); // 3 AM Perú
      const start = getOperativeDayStart(date);
      
      // Debe ser 5 AM del día 4
      expect(start.getDate()).toBe(4);
      expect(start.getHours()).toBe(5);
    });
  });

  describe('getOperativeDayId', () => {
    it('should return same day ID for times between 5 AM and midnight', () => {
      const morning = new Date('2026-01-05T08:00:00-05:00');
      const evening = new Date('2026-01-05T23:00:00-05:00');
      
      expect(getOperativeDayId(morning)).toBe(getOperativeDayId(evening));
    });

    it('should return same day ID for late night and early morning', () => {
      const lateNight = new Date('2026-01-05T23:30:00-05:00');
      const earlyMorning = new Date('2026-01-06T03:00:00-05:00');
      
      // Ambos pertenecen al día operativo del 5 de enero
      expect(getOperativeDayId(lateNight)).toBe(getOperativeDayId(earlyMorning));
    });
  });
});
```

### Paso 9.7: Script para correr tests

**Archivo:** `package.json` (agregar scripts)

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### ✅ Criterios de Aceptación Fase 9

- [ ] Vitest configurado correctamente
- [ ] Setup de tests con limpieza de DB
- [ ] Tests de idempotencia pasan
- [ ] Tests de validación de negocio pasan
- [ ] Tests de rate limiting pasan
- [ ] Tests de timezone pasan
- [ ] Coverage > 70% en módulos críticos

---

## FASE 10: Checklist Final de Producción

**Objetivo:** Verificar que todo está listo antes de ir a producción.  
**Tiempo:** 2 horas  
**Prioridad:** 🔴 CRÍTICO

### Checklist de Código

```
□ Idempotencia
  □ Tabla processed_events creada
  □ projectEvent verifica duplicados
  □ Test de idempotencia pasa

□ Outbox Pattern
  □ Tabla event_outbox creada
  □ Ingest guarda evento + outbox en TX
  □ Worker procesa outbox async
  □ Endpoint /api/admin/outbox funciona

□ Validación de Negocio
  □ business-rules.ts con schemas Zod
  □ Ingest valida antes de guardar
  □ Tests de validación pasan

□ Order Numbers
  □ Tablas de rangos creadas
  □ API de asignación funciona
  □ Fallback offline implementado

□ Timezone
  □ Campo server_received_at existe
  □ Timestamps se validan/corrigen
  □ Reportes usan server_received_at

□ Límites
  □ Rate limiting funciona
  □ Tamaño de payload validado
  □ Cleanup de IndexedDB implementado

□ Índices
  □ Índices de Prisma aplicados
  □ Índices parciales creados
  □ Auto-vacuum configurado

□ Seguridad
  □ API Keys implementadas
  □ Audit logs funcionando
  □ Permisos por rol definidos
```

### Checklist de Infraestructura

```
□ Base de Datos
  □ PostgreSQL 15+ instalado
  □ Extensiones: uuid-ossp, pg_stat_statements
  □ Backups automáticos configurados
  □ Connection pooling (PgBouncer o Supabase)

□ Supabase
  □ Proyecto creado
  □ RLS policies configuradas
  □ Realtime habilitado para SSE

□ Monitoreo
  □ Logs centralizados
  □ Alertas de errores configuradas
  □ Dashboard de métricas básico

□ SSL/TLS
  □ HTTPS en producción
  □ Certificados válidos
```

### Checklist de Datos

```
□ Migraciones
  □ Todas las migraciones aplicadas
  □ prisma migrate deploy ejecutado
  □ Seed data cargado (catálogo, usuarios)

□ Catálogo
  □ Productos cargados
  □ Categorías configuradas
  □ Precios en centavos verificados

□ Usuarios
  □ Admin creado
  □ Cajeros creados
  □ API Keys generadas para terminales
```

### Checklist de Terminales

```
□ Configuración
  □ URL de API configurada
  □ API Key almacenada segura
  □ Tenant ID configurado

□ Offline
  □ Service Worker registrado
  □ IndexedDB inicializado
  □ Sync queue funciona

□ UI
  □ POS principal funciona
  □ KDS muestra órdenes
  □ Impresión de tickets funciona
```

### Script de Verificación

**Archivo:** `scripts/verify-production.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Verificar tablas existen
  const tables = [
    'events', 'orders', 'order_lines', 'payments', 'shifts',
    'products', 'categories', 'processed_events', 'event_outbox',
    'api_keys', 'audit_logs', 'order_number_ranges'
  ];

  for (const table of tables) {
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM ${table} LIMIT 1`);
      results.push({ name: `Table: ${table}`, status: 'pass', message: 'Exists' });
    } catch (e) {
      results.push({ name: `Table: ${table}`, status: 'fail', message: 'Missing' });
    }
  }

  // 2. Verificar índices críticos
  const indexCheck = await prisma.$queryRaw<any[]>`
    SELECT indexname FROM pg_indexes 
    WHERE tablename = 'orders' AND indexname LIKE '%status%'
  `;
  results.push({
    name: 'Index: orders_status',
    status: indexCheck.length > 0 ? 'pass' : 'warn',
    message: indexCheck.length > 0 ? 'Exists' : 'Missing - performance may suffer'
  });

  // 3. Verificar datos mínimos
  const productCount = await prisma.product.count();
  results.push({
    name: 'Products loaded',
    status: productCount > 0 ? 'pass' : 'fail',
    message: `${productCount} products`
  });

  const apiKeyCount = await prisma.apiKey.count({ where: { is_active: true } });
  results.push({
    name: 'API Keys configured',
    status: apiKeyCount > 0 ? 'pass' : 'fail',
    message: `${apiKeyCount} active keys`
  });

  // 4. Verificar configuración
  const hasProcessedEvents = await prisma.$queryRaw<any[]>`
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'processed_events'
  `;
  results.push({
    name: 'Idempotency table',
    status: hasProcessedEvents.length > 0 ? 'pass' : 'fail',
    message: hasProcessedEvents.length > 0 ? 'Ready' : 'Missing - CRITICAL'
  });

  // 5. Verificar outbox vacío (no hay eventos pendientes)
  const pendingOutbox = await prisma.eventOutbox.count({
    where: { status: 'pending' }
  });
  results.push({
    name: 'Outbox pending',
    status: pendingOutbox === 0 ? 'pass' : 'warn',
    message: `${pendingOutbox} pending events`
  });

  // 6. Verificar failed outbox
  const failedOutbox = await prisma.eventOutbox.count({
    where: { status: 'failed' }
  });
  results.push({
    name: 'Outbox failed',
    status: failedOutbox === 0 ? 'pass' : 'fail',
    message: `${failedOutbox} failed events`
  });

  return results;
}

async function main() {
  console.log('🔍 Running production verification checks...\n');
  
  const results = await runChecks();
  
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.message}`);
    
    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warnCount++;
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n❌ NOT READY FOR PRODUCTION');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log('\n⚠️ READY WITH WARNINGS');
    process.exit(0);
  } else {
    console.log('\n✅ READY FOR PRODUCTION');
    process.exit(0);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Ejecutar verificación

```bash
npx ts-node scripts/verify-production.ts
```

### Orden de Despliegue

```
1. Aplicar migraciones de DB
   npx prisma migrate deploy

2. Cargar seed data
   npx prisma db seed

3. Generar API Keys para terminales
   npx ts-node scripts/generate-api-keys.ts

4. Verificar producción
   npx ts-node scripts/verify-production.ts

5. Desplegar aplicación
   npm run build && npm start

6. Verificar endpoints
   curl -X POST https://api.example.com/api/events/ingest \
     -H "Authorization: Bearer pk_xxx" \
     -H "Content-Type: application/json" \
     -d '{"events":[]}'

7. Configurar terminales con API Keys

8. Monitorear logs primeras horas
```

### ✅ Criterios de Aceptación Fase 10

- [ ] Script verify-production.ts pasa sin errores
- [ ] Todas las migraciones aplicadas
- [ ] API Keys generadas para todos los terminales
- [ ] Catálogo cargado con precios correctos
- [ ] Al menos un test de ingest exitoso
- [ ] Logs de auditoría registrando accesos
- [ ] Backup de DB configurado

---

## 📊 RESUMEN DE IMPLEMENTACIÓN

| Fase | Tiempo | Prioridad | Archivos Principales |
|------|--------|-----------|---------------------|
| 1. Idempotencia | 4h | 🔴 | schema.prisma, ingest/route.ts |
| 2. Outbox | 6h | 🔴 | schema.prisma, outbox-processor.ts |
| 3. Validación | 8h | 🔴 | business-rules.ts, ingest/route.ts |
| 4. Order Numbers | 4h | 🟡 | order-number.service.ts |
| 5. Timezone | 3h | 🟡 | timezone.ts, ingest/route.ts |
| 6. Límites | 4h | 🟡 | limits.ts, rate-limiter.ts |
| 7. Índices | 2h | 🟡 | schema.prisma, SQL |
| 8. Seguridad | 4h | 🔴 | api-key.service.ts, auth.middleware.ts |
| 9. Tests | 6h | 🟡 | *.test.ts |
| 10. Checklist | 2h | 🔴 | verify-production.ts |

**Total estimado:** 43 horas (~5 días)

---

## 🚀 SIGUIENTE PASO

Una vez completada esta documentación, el orden de implementación recomendado es:

1. **Fase 1 + 2** (Idempotencia + Outbox) - Son dependientes
2. **Fase 3** (Validación) - Crítico para seguridad de dinero
3. **Fase 8** (Seguridad API) - Antes de exponer a internet
4. **Fase 4-7** (Resto) - En paralelo si hay recursos
5. **Fase 9** (Tests) - Validar todo
6. **Fase 10** (Checklist) - Verificación final

---

**Documento creado:** Enero 2026  
**Autor:** Arquitectura PARK POS  
**Versión:** 1.0
