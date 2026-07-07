# 💰 FIRMO POS — Plano de Seguridad Financiera

> **Objetivo:** Garantizar que el sistema NUNCA pierda dinero ni genere datos corruptos.

**Fecha:** Enero 2026  
**Estado:** 📋 Especificación (implementar antes de producción)

---

## 🎯 PRINCIPIO FUNDAMENTAL

```
En un sistema POS, hay 3 formas de perder dinero:
1. Cobrar menos de lo debido (totales incorrectos)
2. No registrar una venta (evento perdido)
3. Registrar una venta dos veces (duplicación)

Este documento resuelve las 3.
```

---

## 📋 CATÁLOGO DE RIESGOS FINANCIEROS

### 🔴 RIESGO 1: Totales Incorrectos por Proyección No Idempotente

**¿Qué es?**
Cuando un evento se procesa más de una vez y cada vez modifica el total, sumando valores que ya fueron sumados.

**Escenario real:**
```
1. Mesero agrega "1/4 Pollo" (S/25) a la orden #100
2. Terminal envía evento ORDER_ITEM_ADDED al servidor
3. Servidor recibe, guarda, proyecta: subtotal = 0 + 2500 = 2500 ✅
4. Conexión se corta ANTES de que el terminal reciba confirmación
5. Terminal reintenta (no sabe si llegó)
6. Servidor recibe DE NUEVO el mismo evento
7. Servidor proyecta DE NUEVO: subtotal = 2500 + 2500 = 5000 ❌
8. Cliente paga S/50 por un pollo de S/25
```

**Pérdida:** Cliente paga de más → reclamo → devolución → pérdida de confianza
**O peor:** Si el retry falla y no se suma → cliente paga de menos → pérdida directa

**Solución:** Event Deduplication (ver Solución 1)

---

### 🔴 RIESGO 2: Evento Perdido Entre Cliente y Servidor

**¿Qué es?**
El evento se guarda en el servidor pero nunca se notifica a otros terminales, o se notifica pero el servidor crashea antes de confirmar.

**Escenario real:**
```
1. Caja cobra orden #100 por S/50
2. Evento CHECK_MARKED_PAID se guarda en PostgreSQL ✅
3. Servidor intenta notificar via SSE a otros terminales
4. SSE falla (conexión rota, servidor reinicia, etc.)
5. Evento NUNCA llega a KDS ni a otros terminales
6. Cocina no sabe que la orden está pagada
7. Mesero no sabe que puede entregar
8. Cliente espera, se queja, pide devolución
```

**Pérdida:** Operación detenida → cliente insatisfecho → pérdida de venta futura

**Escenario peor:**
```
1. Terminal envía 50 eventos en batch
2. Servidor guarda evento 1-25 ✅
3. Servidor crashea en evento 26
4. Eventos 26-50 se pierden PARA SIEMPRE
5. Esas ventas nunca se registran
```

**Pérdida:** Ventas no registradas = dinero perdido

**Solución:** Outbox Pattern (ver Solución 2)

---

### 🔴 RIESGO 3: Colisión de Números de Orden

**¿Qué es?**
Dos terminales generan el mismo número de orden porque ambos están offline y usan el mismo contador.

**Escenario real:**
```
1. Terminal CAJA genera orden #100 (offline)
2. Terminal MESA_5 genera orden #100 (offline, mismo contador)
3. Ambos sincronizan cuando hay internet
4. Servidor tiene DOS órdenes #100
5. Cocina prepara "orden #100" → ¿cuál de las dos?
6. Mesero entrega a mesa equivocada
7. Cliente A recibe comida de Cliente B
8. Ambos clientes molestos
```

**Pérdida:** Confusión operativa → comida desperdiciada → clientes perdidos

**Escenario legal:**
```
1. Orden #100 de Terminal A: S/50, factura F001-100
2. Orden #100 de Terminal B: S/80, factura F001-100
3. SUNAT detecta dos facturas con mismo número
4. Multa por duplicidad de comprobantes
```

**Pérdida:** Multa de SUNAT + problemas contables

**Solución:** Range Allocation (ver Solución 3)

---

### 🔴 RIESGO 4: Pago Insuficiente Aceptado

**¿Qué es?**
El sistema acepta un pago menor al total de la cuenta sin validar.

**Escenario real:**
```
1. Cuenta total: S/100
2. Cajero (por error o malicia) registra pago de S/50
3. Sistema acepta evento CHECK_MARKED_PAID sin validar
4. Orden se marca como PAGADA
5. Cliente se va habiendo pagado S/50 menos
```

**Pérdida:** S/50 directos por cada caso

**Escenario de fraude interno:**
```
1. Cajero corrupto acuerda con cliente
2. Cuenta: S/100, registra pago: S/60
3. Cliente paga S/60 en efectivo
4. Cajero se queda S/20, cliente "ahorra" S/20
5. Restaurante pierde S/40
```

**Pérdida:** Robo hormiga sistemático

**Solución:** Server Validation (ver Solución 4)

---

### 🔴 RIESGO 5: Cambio Incorrecto Calculado

**¿Qué es?**
El sistema calcula o acepta un cambio mayor al que corresponde.

**Escenario real:**
```
1. Cuenta: S/80
2. Cliente paga con S/100
3. Cambio correcto: S/20
4. Cajero registra cambio: S/40 (error de tipeo)
5. Sistema acepta sin validar
6. Cajero entrega S/40 de cambio
7. Caja queda descuadrada en S/20
```

**Pérdida:** S/20 por transacción mal registrada

**Escenario de fraude:**
```
1. Cuenta: S/50
2. Cliente paga S/50 exacto
3. Cajero registra: pagó S/100, cambio S/50
4. Cajero se embolsa S/50 de la caja
5. En sistema: todo cuadra (pagó 100, cambio 50, neto 50)
6. En realidad: caja tiene S/50 menos
```

**Pérdida:** Robo directo de caja

**Solución:** Server Validation (ver Solución 4)

---

### 🔴 RIESGO 6: Reporte en Día Incorrecto por Timezone

**¿Qué es?**
Una venta se registra en el día equivocado porque el servidor usa UTC y el negocio está en Lima (UTC-5).

**Escenario real:**
```
1. Pollería en Lima, Perú (UTC-5)
2. Venta a las 11:00 PM del 5 de enero (hora Lima)
3. En UTC son las 4:00 AM del 6 de enero
4. Servidor guarda: business_date = 2026-01-06 ❌
5. Reporte del 5 de enero: falta esa venta
6. Reporte del 6 de enero: tiene venta que no corresponde
7. Cierre de caja del 5 de enero: no cuadra
```

**Pérdida:** Reportes incorrectos → decisiones erróneas → problemas contables

**Escenario de auditoría:**
```
1. SUNAT pide ventas del 5 de enero
2. Sistema reporta ventas con fecha UTC
3. Faltan ventas de 7PM-12AM (están en día 6)
4. Sobran ventas de 12AM-7AM (son del día 4)
5. Auditor encuentra inconsistencias
6. Multa o investigación
```

**Pérdida:** Problemas legales/tributarios

**Solución:** Timezone Handling (ver Solución 5)

---

### 🟡 RIESGO 7: Items Perdidos por Edición Concurrente

**¿Qué es?**
Dos meseros agregan items a la misma orden mientras están offline, y al sincronizar uno sobrescribe al otro.

**Escenario real:**
```
1. Orden #100 tiene: 1 Pollo (S/25)
2. Mesero A (offline) agrega: 1 Gaseosa (S/5)
   → Su versión: Pollo + Gaseosa = S/30
3. Mesero B (offline) agrega: 1 Porción Papas (S/8)
   → Su versión: Pollo + Papas = S/33
4. Mesero A sincroniza primero: orden = Pollo + Gaseosa ✅
5. Mesero B sincroniza después: orden = Pollo + Papas ❌
   → Gaseosa desaparece (Last-Write-Wins)
6. Cliente recibe: Pollo + Gaseosa + Papas
7. Sistema cobra: S/33 (solo Pollo + Papas)
8. Gaseosa no se cobró
```

**Pérdida:** S/5 por gaseosa no cobrada (y cualquier item "perdido")

**Solución:** Conflict Resolution con merge (ver P1)

---

### 🔴 RIESGO 8: Factura Emitida Sin Pago Confirmado

**¿Qué es?**
Se emite una factura/boleta para una cuenta que no está realmente pagada.

**Escenario real:**
```
1. Cliente pide factura antes de pagar
2. Cajero emite factura F001-500 por S/100
3. Cliente dice "ahora pago" y se va al baño
4. Cliente se escapa sin pagar
5. Factura ya emitida a SUNAT
6. No se puede anular fácilmente
7. Restaurante debe pagar IGV de venta que no cobró
```

**Pérdida:** 18% de IGV sobre venta no cobrada + trámite de anulación

**Escenario de error:**
```
1. Sistema permite emitir factura en estado OPEN
2. Cajero emite factura por error
3. Cliente decide no comprar
4. Factura ya reportada a SUNAT
5. Proceso de anulación costoso
```

**Pérdida:** Tiempo administrativo + posibles multas

**Solución:** State Validation - solo emitir factura si check.status === "PAID"

---

## 📊 RESUMEN DE IMPACTO FINANCIERO

| Riesgo | Pérdida por Incidente | Frecuencia Estimada | Pérdida Mensual |
|--------|----------------------|---------------------|-----------------|
| Totales duplicados | S/10-50 | 5-10/mes | S/50-500 |
| Eventos perdidos | S/20-100 | 2-5/mes | S/40-500 |
| Order number collision | S/30-80 | 1-3/mes | S/30-240 |
| Pago insuficiente | S/20-100 | 1-5/mes | S/20-500 |
| Cambio incorrecto | S/10-50 | 2-10/mes | S/20-500 |
| Timezone incorrecto | Multa SUNAT | 1/año | S/2,000+ |
| Items perdidos | S/5-30 | 10-20/mes | S/50-600 |
| Factura sin pago | S/50-200 + IGV | 1-2/mes | S/50-400 |

**Pérdida potencial total sin mitigación: S/2,000-5,000/mes**

---

## 🔧 SOLUCIÓN 1: Event Deduplication (Idempotencia)

### Problema
```typescript
// Evento llega 2 veces por retry
await tx.order.update({
  data: { subtotal_cents: order.subtotal_cents + 1000 } // ❌ Se suma 2 veces
});
```

### Solución
```sql
-- Nueva tabla
CREATE TABLE processed_events (
  event_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_processed_tenant (tenant_id, processed_at)
);
```

```typescript
// En projectEvent()
async function projectEvent(tx: PrismaTransaction, event: ParkEvent) {
  // 1. Check si ya procesado
  const exists = await tx.processedEvent.findUnique({
    where: { event_id: event.event_id }
  });
  
  if (exists) {
    console.log(`[Projection] Event ${event.event_id} already processed, skipping`);
    return; // ✅ Idempotente
  }
  
  // 2. Marcar como procesado ANTES de proyectar
  await tx.processedEvent.create({
    data: {
      event_id: event.event_id,
      tenant_id: event.tenant_id,
    }
  });
  
  // 3. Proyectar
  switch (event.event_type) {
    case "ORDER_ITEM_ADDED":
      await projectOrderItemAdded(tx, event);
      break;
    // ...
  }
}
```

### Cleanup (evitar tabla infinita)
```typescript
// Cron job diario
async function cleanupProcessedEvents() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7); // 7 días
  
  await prisma.processedEvent.deleteMany({
    where: { processed_at: { lt: cutoff } }
  });
}
```

---

## 🔧 SOLUCIÓN 2: Outbox Pattern (Garantía de Entrega)

### Problema
```typescript
await prisma.$transaction(async (tx) => {
  await tx.event.create({...});
  await projectEvent(tx, event);
});
// ❌ Si esto falla, evento guardado pero no notificado
eventBus.publish(event);
```

### Solución
```sql
CREATE TABLE event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_outbox_pending (tenant_id, published, created_at)
    WHERE published = FALSE
);
```

```typescript
// En ingest - TODO dentro de la transacción
await prisma.$transaction(async (tx) => {
  // 1. Guardar evento
  await tx.event.create({ data: eventData });
  
  // 2. Proyectar
  await projectEvent(tx, event);
  
  // 3. Agregar a outbox (ATÓMICO)
  await tx.eventOutbox.create({
    data: {
      tenant_id: event.tenant_id,
      event_id: event.event_id,
      payload: event,
    }
  });
});
// ✅ Todo o nada
```

```typescript
// Worker que publica (cada 100ms)
async function publishOutbox() {
  const pending = await prisma.eventOutbox.findMany({
    where: { published: false, attempts: { lt: 5 } },
    orderBy: { created_at: 'asc' },
    take: 100,
  });

  for (const item of pending) {
    try {
      await eventBus.publish(item.tenant_id, item.payload);
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { published: true }
      });
    } catch (error) {
      await prisma.eventOutbox.update({
        where: { id: item.id },
        data: { attempts: { increment: 1 } }
      });
    }
  }
}

setInterval(publishOutbox, 100);
```

---

## 🔧 SOLUCIÓN 3: Order Number - Range Allocation

### Problema
```typescript
// Terminal A offline: order_number = 100
// Terminal B offline: order_number = 100
// ❌ COLISIÓN
```

### Solución
```sql
CREATE TABLE terminal_number_ranges (
  terminal_id VARCHAR(50) PRIMARY KEY,
  tenant_id UUID NOT NULL,
  range_start INT NOT NULL,
  range_end INT NOT NULL,
  current_number INT NOT NULL,
  
  UNIQUE(tenant_id, range_start)
);
```

```typescript
// Al registrar terminal, asignar rango
async function registerTerminal(tenantId: string, terminalId: string) {
  const lastRange = await prisma.terminalNumberRange.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { range_end: 'desc' }
  });
  
  const rangeStart = (lastRange?.range_end ?? 0) + 1;
  const rangeEnd = rangeStart + 9999; // 10,000 números por terminal
  
  await prisma.terminalNumberRange.create({
    data: {
      terminal_id: terminalId,
      tenant_id: tenantId,
      range_start: rangeStart,
      range_end: rangeEnd,
      current_number: rangeStart,
    }
  });
  
  return { rangeStart, rangeEnd };
}

// En cliente - generar order_number
function getNextOrderNumber(): number {
  const range = getLocalRange(); // De localStorage
  
  if (range.current >= range.end) {
    throw new Error("RANGE_EXHAUSTED"); // Pedir nuevo rango online
  }
  
  range.current++;
  saveLocalRange(range);
  
  return range.current;
}
```

### Formato final de order_number
```typescript
// Formato: TXXXX donde T=terminal_suffix, XXXX=sequence
// Terminal "term_caja_1" → suffix "1"
// Order number: 10001, 10002, 10003...

// Terminal "term_mesa_5" → suffix "5"  
// Order number: 50001, 50002, 50003...

const orderNumber = `${terminalSuffix}${String(sequence).padStart(4, '0')}`;
// Resultado: "10001", "50023", etc.
```

---

## 🔧 SOLUCIÓN 4: Server-Side Validation (Reglas de Negocio)

### Validaciones OBLIGATORIAS antes de proyectar

```typescript
// src/core/validation/business-rules.ts

export async function validateEvent(
  tx: PrismaTransaction, 
  event: ParkEvent
): Promise<ValidationResult> {
  
  switch (event.event_type) {
    
    // ========== PAGOS ==========
    case "CHECK_MARKED_PAID": {
      const order = await tx.order.findUnique({
        where: { id: event.payload.order_id }
      });
      
      if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
      }
      
      const check = order.checks.find(c => c.check_id === event.payload.check_id);
      if (!check) {
        return { valid: false, error: "CHECK_NOT_FOUND" };
      }
      
      // Validar que pago >= total
      const payments = event.payload.payment.payments;
      const totalPaid = payments.reduce((sum, p) => sum + p.amount_cents, 0);
      
      if (totalPaid < check.total_cents) {
        return { 
          valid: false, 
          error: "INSUFFICIENT_PAYMENT",
          details: {
            required: check.total_cents,
            received: totalPaid,
            missing: check.total_cents - totalPaid
          }
        };
      }
      
      // Validar cambio
      const expectedChange = totalPaid - check.total_cents;
      if (event.payload.change_cents > expectedChange) {
        return {
          valid: false,
          error: "INVALID_CHANGE",
          details: {
            expected: expectedChange,
            claimed: event.payload.change_cents
          }
        };
      }
      
      return { valid: true };
    }
    
    // ========== FACTURAS ==========
    case "INVOICE_ISSUED": {
      const order = await tx.order.findUnique({
        where: { id: event.payload.order_id }
      });
      
      // Check debe estar PAID
      const check = order.checks.find(c => c.check_id === event.payload.check_id);
      if (check.status !== "PAID") {
        return { valid: false, error: "CHECK_NOT_PAID" };
      }
      
      // No debe existir factura previa para este check
      const existingInvoice = await tx.invoice.findFirst({
        where: { 
          order_id: event.payload.order_id,
          check_id: event.payload.check_id,
          status: { not: "VOIDED" }
        }
      });
      
      if (existingInvoice) {
        return { valid: false, error: "INVOICE_ALREADY_EXISTS" };
      }
      
      // Validar serie/número
      if (!event.payload.series || !event.payload.number) {
        return { valid: false, error: "INVALID_INVOICE_NUMBER" };
      }
      
      return { valid: true };
    }
    
    // ========== ITEMS ==========
    case "ORDER_ITEM_ADDED": {
      // Validar que producto existe y está activo
      const product = await tx.product.findUnique({
        where: { id: event.payload.line.product_id }
      });
      
      if (!product || !product.is_active) {
        return { valid: false, error: "PRODUCT_NOT_FOUND" };
      }
      
      // Validar precio (no puede ser negativo)
      if (event.payload.line.unit_price_cents < 0) {
        return { valid: false, error: "INVALID_PRICE" };
      }
      
      // Validar cantidad
      if (event.payload.line.quantity <= 0 || event.payload.line.quantity > 100) {
        return { valid: false, error: "INVALID_QUANTITY" };
      }
      
      return { valid: true };
    }
    
    // ========== VOIDS ==========
    case "ITEM_VOIDED": {
      // Solo MANAGER o ADMIN pueden anular
      const employee = await tx.employee.findUnique({
        where: { id: event.actor_id }
      });
      
      if (!["ADMIN", "MANAGER"].includes(employee.role)) {
        return { valid: false, error: "INSUFFICIENT_PERMISSIONS" };
      }
      
      // Debe tener razón
      if (!event.payload.reason || event.payload.reason.length < 3) {
        return { valid: false, error: "VOID_REASON_REQUIRED" };
      }
      
      return { valid: true };
    }
    
    default:
      return { valid: true };
  }
}
```

### Integración en Ingest API
```typescript
// src/app/api/events/ingest/route.ts
export async function POST(req: Request) {
  const { events } = await req.json();
  const results = [];
  
  for (const event of events) {
    await prisma.$transaction(async (tx) => {
      // 1. VALIDAR PRIMERO
      const validation = await validateEvent(tx, event);
      
      if (!validation.valid) {
        results.push({
          event_id: event.event_id,
          status: "REJECTED",
          error: validation.error,
          details: validation.details
        });
        return; // Skip este evento
      }
      
      // 2. Guardar evento
      await tx.event.create({ data: eventData });
      
      // 3. Proyectar (ya validado)
      await projectEvent(tx, event);
      
      // 4. Outbox
      await tx.eventOutbox.create({ data: { ... } });
      
      results.push({
        event_id: event.event_id,
        status: "OK"
      });
    });
  }
  
  return NextResponse.json({ results });
}
```

---

## 🔧 SOLUCIÓN 5: Timezone Handling

### Configuración por Tenant
```sql
ALTER TABLE tenant_settings ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Lima';
```

### Cálculo de Business Date
```typescript
// src/core/utils/business-date.ts
import { format, utcToZonedTime } from 'date-fns-tz';

export function getBusinessDate(
  occurredAt: string | Date, 
  timezone: string
): string {
  const zonedDate = utcToZonedTime(new Date(occurredAt), timezone);
  return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
}

// Uso en proyección
const tenantSettings = await tx.tenantSettings.findUnique({
  where: { tenant_id: event.tenant_id }
});

const businessDate = getBusinessDate(
  event.occurred_at, 
  tenantSettings.timezone // "America/Lima"
);

// Actualizar daily_sales_summary con businessDate correcto
await tx.dailySalesSummary.upsert({
  where: {
    tenant_id_business_date: {
      tenant_id: event.tenant_id,
      business_date: new Date(businessDate)
    }
  },
  update: {
    total_sales_cents: { increment: amount },
    // ...
  },
  create: {
    tenant_id: event.tenant_id,
    business_date: new Date(businessDate),
    total_sales_cents: amount,
    // ...
  }
});
```

### Regla de Cierre de Día
```typescript
// El día de negocio termina a las 6:00 AM del día siguiente
// Venta a las 2:00 AM del 6 de enero → business_date = 5 de enero

export function getBusinessDate(occurredAt: Date, timezone: string): string {
  const zonedDate = utcToZonedTime(occurredAt, timezone);
  const hour = zonedDate.getHours();
  
  // Si es antes de las 6 AM, pertenece al día anterior
  if (hour < 6) {
    zonedDate.setDate(zonedDate.getDate() - 1);
  }
  
  return format(zonedDate, 'yyyy-MM-dd', { timeZone: timezone });
}
```

---

## 🔧 SOLUCIÓN 6: Límites de Seguridad

### Constantes Globales
```typescript
// src/core/constants/limits.ts
export const LIMITS = {
  MAX_ITEMS_PER_ORDER: 50,
  MAX_CHECKS_PER_ORDER: 10,
  MAX_PAYMENTS_PER_CHECK: 5,
  MAX_ORDER_TOTAL_CENTS: 100_000_00, // S/100,000
  MAX_SINGLE_ITEM_CENTS: 10_000_00,  // S/10,000
  MAX_DISCOUNT_PERCENT: 100,
  MAX_EVENTS_PER_BATCH: 100,
  MAX_JSONB_SIZE_BYTES: 1_000_000,   // 1MB
};
```

### Validación de Límites
```typescript
// En validateEvent()
case "ORDER_ITEM_ADDED": {
  const order = await tx.order.findUnique({
    where: { id: event.payload.order_id }
  });
  
  // Límite de items
  if (order.items.length >= LIMITS.MAX_ITEMS_PER_ORDER) {
    return { valid: false, error: "MAX_ITEMS_EXCEEDED" };
  }
  
  // Límite de precio por item
  const lineTotal = event.payload.line.quantity * event.payload.line.unit_price_cents;
  if (lineTotal > LIMITS.MAX_SINGLE_ITEM_CENTS) {
    return { valid: false, error: "ITEM_PRICE_TOO_HIGH" };
  }
  
  // Límite de total de orden
  const newTotal = order.total_cents + lineTotal;
  if (newTotal > LIMITS.MAX_ORDER_TOTAL_CENTS) {
    return { valid: false, error: "ORDER_TOTAL_TOO_HIGH" };
  }
  
  return { valid: true };
}
```

---

## 📊 CHECKLIST DE IMPLEMENTACIÓN

### Antes de Producción (P0)

- [ ] Tabla `processed_events` creada
- [ ] `projectEvent()` verifica duplicados
- [ ] Tabla `event_outbox` creada
- [ ] Worker de outbox corriendo
- [ ] Tabla `terminal_number_ranges` creada
- [ ] Lógica de range allocation implementada
- [ ] `validateEvent()` implementado para:
  - [ ] CHECK_MARKED_PAID
  - [ ] INVOICE_ISSUED
  - [ ] ORDER_ITEM_ADDED
  - [ ] ITEM_VOIDED
- [ ] Timezone configurado por tenant
- [ ] `getBusinessDate()` usado en proyecciones
- [ ] Límites validados en cliente Y servidor

### Tests Requeridos

```typescript
describe('Money Safety', () => {
  it('rejects duplicate events', async () => {
    await ingest(event);
    await ingest(event); // Mismo event_id
    
    const order = await getOrder(orderId);
    expect(order.subtotal_cents).toBe(1000); // No 2000
  });
  
  it('rejects insufficient payment', async () => {
    const result = await ingest({
      event_type: "CHECK_MARKED_PAID",
      payload: {
        check_id: "c1",
        payment: { payments: [{ amount_cents: 500 }] }, // Total es 1000
      }
    });
    
    expect(result.status).toBe("REJECTED");
    expect(result.error).toBe("INSUFFICIENT_PAYMENT");
  });
  
  it('generates unique order numbers across terminals', async () => {
    const num1 = await createOrder("terminal_1");
    const num2 = await createOrder("terminal_2");
    
    expect(num1).not.toBe(num2);
  });
  
  it('assigns correct business date for late night sale', async () => {
    // Venta a las 2:00 AM del 6 de enero
    const event = createSaleEvent('2026-01-06T02:00:00-05:00');
    await ingest(event);
    
    const summary = await getDailySummary('2026-01-05'); // Día anterior
    expect(summary.total_sales_cents).toBeGreaterThan(0);
  });
});
```

---

## 🚨 ALERTAS DE MONITOREO

```yaml
# Alertas críticas para dinero
alerts:
  - name: DuplicateEventProcessed
    condition: processed_events.count_duplicates > 0
    severity: critical
    
  - name: OutboxBacklogHigh
    condition: event_outbox.pending_count > 1000
    severity: warning
    
  - name: PaymentValidationFailed
    condition: rate(validation_errors{type="INSUFFICIENT_PAYMENT"}) > 0
    severity: critical
    
  - name: OrderNumberCollision
    condition: orders.duplicate_numbers > 0
    severity: critical
```

---

**Este documento es el PLANO de seguridad financiera. Implementar TODO antes de producción.**
