# 🔍 PARK POS — Análisis de Huecos e Inconsistencias Críticas

**Fecha:** 2026-01-05  
**Tipo:** Auditoría Arquitectónica Profunda  
**Severidad:** 🔴 Crítico | 🟡 Alto | 🟠 Medio | 🟢 Bajo

---

## 📋 RESUMEN EJECUTIVO

Después de revisar exhaustivamente tu arquitectura, código y documentación, he identificado **23 huecos críticos** que podrían causar problemas en producción. Algunos son sutiles pero peligrosos.

**Distribución por Severidad:**
- 🔴 **Crítico (Bloquea producción):** 8
- 🟡 **Alto (Riesgo significativo):** 7
- 🟠 **Medio (Mejora importante):** 5
- 🟢 **Bajo (Nice to have):** 3

---

## 🔴 HUECOS CRÍTICOS (Bloquean Producción)

### 1. 🔴 Falta de Manejo de Clock Skew (Desincronización de Relojes)

**Problema:**
```typescript
// En terminal offline
const event = {
  occurred_at: new Date().toISOString(), // ❌ Reloj local puede estar mal
  terminal_sequence: 123
};
```

**Escenario Real:**
- Terminal A tiene reloj adelantado 5 minutos
- Terminal B tiene reloj correcto
- Eventos de A aparecen "en el futuro"
- Rebuild de proyecciones falla porque orden temporal es incorrecto

**Impacto:** 🔥 **CRÍTICO**
- Proyecciones inconsistentes
- KDS muestra pedidos en orden incorrecto
- Reportes con timestamps erróneos

**Solución:**

```typescript
// Opción 1: Hybrid Timestamp (Recomendado)
interface HybridTimestamp {
  logical_clock: number;      // Monótono por terminal
  physical_clock: string;     // ISO timestamp
  terminal_id: string;
}

// Opción 2: Server-Assigned Timestamp
// En ingest API
const event = {
  ...clientEvent,
  occurred_at_client: clientEvent.occurred_at,
  occurred_at_server: new Date().toISOString(), // ✅ Timestamp confiable
};

// Opción 3: NTP Sync en Terminales
// Sincronizar reloj con servidor NTP cada hora
```

**Recomendación:** Usar **Opción 2** (Server-Assigned) + validación de drift máximo (5 min).

---

### 2. 🔴 Race Condition en Order Number Generation

**Problema:**
```typescript
// En POSActions.createOrder()
let orderNumberCounter = 1; // ❌ Variable global en memoria

// Terminal A (offline): Crea orden #123
// Terminal B (offline): Crea orden #123
// Ambos sincronizan → CONFLICTO
```

**Impacto:** 🔥 **CRÍTICO**
- Órdenes duplicadas con mismo número
- Confusión en cocina
- Problemas legales (facturación)

**Solución:**

```typescript
// Opción 1: UUID como Order Number (Recomendado para MVP)
order_number: `${terminal_id}-${Date.now()}-${random()}`

// Opción 2: Sequence Server-Side
// POST /api/orders/reserve-number
// Response: { order_number: 12345 }
// Requiere online

// Opción 3: Range Allocation
// Terminal A: 1-1000
// Terminal B: 1001-2000
// Terminal C: 2001-3000
```

**Recomendación:** **Opción 3** (Range Allocation) para offline + fallback a Opción 1.

---

### 3. 🔴 Falta de Idempotencia en Proyecciones

**Problema:**
```typescript
// En projectEvent()
await tx.order.update({
  where: { id: p.order_id },
  data: {
    subtotal_cents: order.subtotal_cents + lineCents, // ❌ No idempotente
  },
});
```

**Escenario:**
- Evento `ORDER_ITEM_ADDED` llega 2 veces (retry)
- Subtotal se suma 2 veces
- Total incorrecto

**Impacto:** 🔥 **CRÍTICO**
- Totales incorrectos
- Cobros erróneos
- Pérdida de dinero

**Solución:**

```typescript
// Opción 1: Event Deduplication Table
CREATE TABLE processed_events (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

// En projectEvent()
const exists = await tx.processedEvents.findUnique({
  where: { event_id: event.event_id }
});
if (exists) return; // ✅ Ya procesado

await tx.processedEvents.create({ event_id: event.event_id });
// ... proyectar

// Opción 2: Rebuild Completo desde Events
// Siempre reconstruir desde cero, nunca incremental
```

**Recomendación:** **Opción 1** + cleanup de eventos > 30 días.

---

### 4. 🔴 Falta de Validación de Business Rules en Server

**Problema:**
```typescript
// Cliente puede enviar cualquier cosa
const event = {
  type: "CHECK_MARKED_PAID",
  payload: {
    order_id: "...",
    check_id: "c1",
    change_cents: 1000000, // ❌ Sin validar
  }
};
```

**Impacto:** 🔥 **CRÍTICO**
- Cliente malicioso puede robar dinero
- Errores de lógica pasan desapercibidos
- Datos corruptos en DB

**Solución:**

```typescript
// En ingest API
async function validateBusinessRules(event: ParkEvent) {
  switch (event.event_type) {
    case "CHECK_MARKED_PAID": {
      const order = await prisma.order.findUnique({
        where: { id: event.payload.order_id }
      });
      
      const check = order.checks.find(c => c.check_id === event.payload.check_id);
      
      // Validar que pago >= total
      const paidTotal = check.payment.payments.reduce((sum, p) => sum + p.amount_cents, 0);
      if (paidTotal < check.total_cents) {
        throw new Error("INSUFFICIENT_PAYMENT");
      }
      
      // Validar change
      const expectedChange = paidTotal - check.total_cents;
      if (event.payload.change_cents > expectedChange) {
        throw new Error("INVALID_CHANGE");
      }
      
      break;
    }
    
    case "INVOICE_ISSUED": {
      // Validar que check esté PAID
      // Validar que no exista invoice previa
      // Validar series/número
      break;
    }
  }
}
```

**Recomendación:** Validar **TODAS** las reglas de negocio en server antes de proyectar.

---

### 5. 🔴 Falta de Manejo de Partial Failures en Batch Sync

**Problema:**
```typescript
// En ingest API
for (const event of events) {
  await tx.event.create({...}); // ❌ Si falla evento 50/100, rollback todo
  await projectEvent(tx, event);
}
```

**Impacto:** 🔥 **CRÍTICO**
- 1 evento malo bloquea 99 buenos
- Sync se atasca
- Backlog crece infinitamente

**Solución:**

```typescript
// Opción 1: Individual Try-Catch
const results = [];
for (const event of events) {
  try {
    await tx.event.create({...});
    await projectEvent(tx, event);
    results.push({ event_id: event.event_id, status: "OK" });
  } catch (error) {
    results.push({ 
      event_id: event.event_id, 
      status: "FAILED",
      error: error.message 
    });
  }
}

// Response
return {
  accepted: true,
  results,
  acked_through_terminal_sequence: lastSuccessfulSeq,
};

// Opción 2: Dead Letter Queue
// Eventos que fallan 3 veces → tabla `failed_events`
// Admin puede revisar y reprocessar
```

**Recomendación:** **Opción 1** + **Opción 2** para eventos críticos.

---

### 6. 🔴 Falta de Límite de Tamaño en JSONB

**Problema:**
```typescript
// orders.items puede crecer infinitamente
const order = {
  items: [
    // 1000 items... ❌ JSONB > 1MB
  ]
};
```

**Impacto:** 🔥 **CRÍTICO**
- Query lento (JSONB scanning)
- Memoria agotada en cliente
- Crash de app

**Solución:**

```typescript
// Validación en cliente
const MAX_ITEMS_PER_ORDER = 100;
if (order.items.length >= MAX_ITEMS_PER_ORDER) {
  throw new Error("MAX_ITEMS_EXCEEDED");
}

// Validación en server
if (event.payload.items?.length > MAX_ITEMS_PER_ORDER) {
  return { 
    accepted: false, 
    error: "MAX_ITEMS_EXCEEDED" 
  };
}

// Alternativa: Paginación de Items
// orders.items_page_1, orders.items_page_2
```

**Recomendación:** Límite de **50 items por orden** + validación en ambos lados.

---

### 7. 🔴 Falta de Manejo de Timezone en Reportes

**Problema:**
```typescript
// daily_sales_summary usa business_date
// ¿Qué timezone?
// Terminal en Lima: 2026-01-05 23:30 (UTC-5)
// Server en UTC: 2026-01-06 04:30
// ❌ Venta se cuenta en día incorrecto
```

**Impacto:** 🔥 **CRÍTICO**
- Reportes diarios incorrectos
- Cierre de caja no cuadra
- Problemas contables

**Solución:**

```typescript
// Usar timezone del tenant
const tenantSettings = await prisma.tenantSettings.findUnique({
  where: { tenant_id }
});

const timezone = tenantSettings.timezone; // "America/Lima"

// Convertir a business date
import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

const businessDate = format(
  utcToZonedTime(event.occurred_at, timezone),
  'yyyy-MM-dd',
  { timeZone: timezone }
);

// Guardar en daily_sales_summary
await prisma.dailySalesSummary.upsert({
  where: {
    tenant_id_business_date: {
      tenant_id,
      business_date: new Date(businessDate)
    }
  },
  // ...
});
```

**Recomendación:** **SIEMPRE** usar `tenant_settings.timezone` para business logic.

---

### 8. 🔴 Falta de Cleanup de Datos Locales (IndexedDB)

**Problema:**
```typescript
// IndexedDB crece infinitamente
// Después de 6 meses: 10GB de eventos
// ❌ Tablet se queda sin espacio
```

**Impacto:** 🔥 **CRÍTICO**
- App crashea
- Performance degradada
- Usuario borra app y pierde datos

**Solución:**

```typescript
// Cleanup Job (diario)
async function cleanupOldEvents() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 días

  // Solo borrar eventos sincronizados
  await db.events
    .where('synced').equals(1)
    .and(e => new Date(e.occurred_at) < cutoffDate)
    .delete();
  
  console.log(`[Cleanup] Deleted events older than 30 days`);
}

// Ejecutar al abrir app
cleanupOldEvents();

// Alternativa: Compaction con Snapshots
// Borrar eventos < último snapshot
```

**Recomendación:** Cleanup automático de eventos > 30 días + snapshots.

---

## 🟡 HUECOS DE ALTO RIESGO

### 9. 🟡 Falta de Manejo de Concurrent Edits (Split Brain)

**Problema:**
```typescript
// Terminal A (offline): Edita orden #123, agrega item
// Terminal B (offline): Edita orden #123, agrega item
// Ambos sincronizan → ¿Cuál gana?
```

**Solución:**

```typescript
// Opción 1: Last-Write-Wins (Simple)
// El evento con occurred_at más reciente gana
// + Alerta al usuario

// Opción 2: Operational Transformation
// Merge automático de cambios
// Complejo pero correcto

// Opción 3: Lock Optimista
// orders.revision incrementa con cada cambio
// Evento rechazado si revision no coincide
```

**Recomendación:** **Opción 3** (Lock Optimista) + UI para resolver conflictos.

---

### 10. 🟡 Falta de Rate Limiting por Tenant

**Problema:**
```typescript
// Tenant A envía 10,000 eventos/seg
// ❌ Satura servidor
// Tenant B no puede sincronizar
```

**Solución:**

```typescript
import { Ratelimit } from "@upstash/ratelimit";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(1000, "1 m"), // 1000 eventos/min por tenant
});

const { success } = await ratelimit.limit(`tenant:${tenant_id}`);
if (!success) {
  return NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 });
}
```

---

### 11. 🟡 Falta de Validación de Roles en Eventos

**Problema:**
```typescript
// WAITER puede enviar SHIFT_CLOSED
// ❌ Sin validar actor_role
```

**Solución:**

```typescript
const ROLE_PERMISSIONS = {
  ADMIN: ["*"],
  MANAGER: ["SHIFT_*", "INVOICE_VOIDED", "ITEM_VOIDED"],
  CASHIER: ["CHECK_*", "INVOICE_ISSUED"],
  WAITER: ["ORDER_*", "CHECK_CREATED"],
  KITCHEN: ["ORDER_ITEM_STATUS_CHANGED"],
};

function validateRole(event: ParkEvent) {
  const employee = await prisma.employee.findUnique({
    where: { id: event.actor_id }
  });
  
  const allowed = ROLE_PERMISSIONS[employee.role];
  const eventPattern = event.event_type;
  
  if (!allowed.some(pattern => 
    pattern === "*" || eventPattern.startsWith(pattern.replace("*", ""))
  )) {
    throw new Error("INSUFFICIENT_PERMISSIONS");
  }
}
```

---

### 12. 🟡 Falta de Manejo de Duplicate Terminal IDs

**Problema:**
```typescript
// 2 tablets con mismo terminal_id
// ❌ terminal_sequence colisiona
```

**Solución:**

```typescript
// Generar terminal_id único al instalar
const terminal_id = `${tenant_id}-${uuid()}`;
localStorage.setItem("terminal_id", terminal_id);

// Validar en server
const existing = await prisma.terminal.findUnique({
  where: { tenant_id_terminal_id: { tenant_id, terminal_id } }
});

if (!existing) {
  throw new Error("TERMINAL_NOT_REGISTERED");
}
```

---

### 13. 🟡 Falta de Backup Automático de IndexedDB

**Problema:**
```typescript
// Usuario borra cache del navegador
// ❌ Pierde eventos no sincronizados
```

**Solución:**

```typescript
// Backup automático cada hora
setInterval(async () => {
  const unsyncedCount = await db.events.where('synced').equals(0).count();
  
  if (unsyncedCount > 0) {
    const backup = await exportEncrypted();
    // Guardar en localStorage como fallback
    localStorage.setItem('emergency_backup', backup);
    
    // O enviar a server
    await fetch('/api/backup', {
      method: 'POST',
      body: backup
    });
  }
}, 3600000); // 1 hora
```

---

### 14. 🟡 Falta de Manejo de Network Partitions

**Problema:**
```typescript
// Terminal pierde conexión por 2 horas
// Backlog: 5000 eventos
// ❌ Sync toma 10 minutos
// UI bloqueada
```

**Solución:**

```typescript
// Sync en background con Web Worker
const syncWorker = new Worker('/sync-worker.js');

syncWorker.postMessage({ action: 'START_SYNC' });

// UI no se bloquea
// Progress indicator
syncWorker.onmessage = (e) => {
  if (e.data.type === 'PROGRESS') {
    updateSyncProgress(e.data.percent);
  }
};
```

---

### 15. 🟡 Falta de Validación de Catálogo en Eventos

**Problema:**
```typescript
// Terminal usa catalog_version 1
// Server tiene catalog_version 2
// Producto ya no existe
// ❌ Evento con product_id inválido
```

**Solución:**

```typescript
// Validar en server
const product = await prisma.product.findUnique({
  where: { id: event.payload.line.product_id }
});

if (!product || !product.is_active) {
  return {
    accepted: false,
    error: {
      code: "PRODUCT_NOT_FOUND",
      message: "Producto no existe o está inactivo",
      user_action: "Actualiza el catálogo en el terminal"
    }
  };
}
```

---


## 🟠 HUECOS DE RIESGO MEDIO

### 16. 🟠 Falta de Manejo de Large Transactions

**Problema:**
```typescript
// Batch de 500 eventos
// Transaction timeout después de 30s
// ❌ Rollback de todo
```

**Solución:**

```typescript
// Procesar en micro-batches
const MICRO_BATCH_SIZE = 50;

for (let i = 0; i < events.length; i += MICRO_BATCH_SIZE) {
  const batch = events.slice(i, i + MICRO_BATCH_SIZE);
  
  await prisma.$transaction(async (tx) => {
    for (const event of batch) {
      await tx.event.create({...});
      await projectEvent(tx, event);
    }
  }, {
    timeout: 10000, // 10s por micro-batch
  });
}
```

---

### 17. 🟠 Falta de Monitoring de IndexedDB Quota

**Problema:**
```typescript
// IndexedDB tiene límite (50MB - 10GB según navegador)
// ❌ App crashea al llegar al límite
```

**Solución:**

```typescript
async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const percentUsed = (estimate.usage! / estimate.quota!) * 100;
    
    if (percentUsed > 80) {
      toast.warning("Espacio de almacenamiento bajo. Sincroniza pronto.");
      // Trigger cleanup
      await cleanupOldEvents();
    }
    
    if (percentUsed > 95) {
      toast.error("Almacenamiento casi lleno. No puedes crear más pedidos.");
      // Block new orders
    }
  }
}

// Check cada 5 minutos
setInterval(checkStorageQuota, 300000);
```

---

### 18. 🟠 Falta de Manejo de Stale Reads

**Problema:**
```typescript
// Terminal A: Crea orden #123
// Terminal B: Lee orden #123 antes de recibir SSE
// ❌ Terminal B ve estado viejo
```

**Solución:**

```typescript
// Opción 1: Read-Your-Writes Consistency
// Siempre leer de local primero
const order = await db.orders.get(orderId) || await fetchFromServer(orderId);

// Opción 2: Version Vectors
// Cada terminal trackea qué eventos ha visto de otros
const myVector = { term_a: 100, term_b: 50, term_c: 75 };

// Opción 3: Eventual Consistency UI
// Mostrar "Sincronizando..." mientras SSE no llega
```

---

### 19. 🟠 Falta de Validación de Delivery Address

**Problema:**
```typescript
// orders.delivery.address_snapshot puede ser null
// ❌ Motorizado no sabe dónde entregar
```

**Solución:**

```typescript
// Validar en ORDER_CREATED
if (event.payload.order_type === "DELIVERY") {
  if (!event.payload.delivery?.address_snapshot) {
    throw new Error("DELIVERY_ADDRESS_REQUIRED");
  }
  
  // Validar campos mínimos
  const addr = event.payload.delivery.address_snapshot;
  if (!addr.address_text || addr.address_text.length < 10) {
    throw new Error("INVALID_DELIVERY_ADDRESS");
  }
}
```

---

### 20. 🟠 Falta de Manejo de Printer Failures

**Problema:**
```typescript
// Impresora offline
// ❌ Ticket no se imprime
// Usuario no se entera
```

**Solución:**

```typescript
// Retry con exponential backoff
async function printWithRetry(ticket: Ticket, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await print(ticket);
      return { success: true };
    } catch (error) {
      if (i === maxRetries - 1) {
        // Último intento falló
        toast.error("Impresora no disponible. Ticket guardado para reimprimir.");
        
        // Guardar en cola
        await db.printQueue.add({
          ticket,
          attempts: i + 1,
          status: 'FAILED',
        });
        
        return { success: false, error };
      }
      
      // Wait antes de reintentar
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

---

## 🟢 HUECOS DE BAJO RIESGO

### 21. 🟢 Falta de Soft Delete en Products

**Problema:**
```typescript
// Producto se borra (is_active = false)
// Órdenes viejas tienen product_id inválido
// ❌ Reportes históricos fallan
```

**Solución:**

```typescript
// Nunca borrar productos, solo marcar inactivos
// Agregar deleted_at para soft delete
model Product {
  // ...
  is_active Boolean @default(true)
  deleted_at DateTime? @db.Timestamptz
}

// Query solo activos
const products = await prisma.product.findMany({
  where: { 
    tenant_id,
    is_active: true,
    deleted_at: null
  }
});
```

---

### 22. 🟢 Falta de Audit Log de Cambios en Catálogo

**Problema:**
```typescript
// Admin cambia precio de S/25 a S/30
// ❌ No hay registro de quién y cuándo
```

**Solución:**

```typescript
// Tabla de auditoría
model CatalogAuditLog {
  id String @id @default(uuid())
  tenant_id String
  product_id String
  action String // CREATED|UPDATED|DELETED
  changes Json // { price_cents: { from: 2500, to: 3000 } }
  changed_by String
  changed_at DateTime @default(now())
}
```

---

### 23. 🟢 Falta de Manejo de Browser Compatibility

**Problema:**
```typescript
// IndexedDB no disponible en modo incógnito (Safari)
// ❌ App no funciona
```

**Solución:**

```typescript
// Detectar y mostrar error amigable
function checkBrowserSupport() {
  if (!('indexedDB' in window)) {
    showError("Tu navegador no soporta almacenamiento local. Usa Chrome o Firefox.");
    return false;
  }
  
  // Test IndexedDB
  try {
    const testDB = indexedDB.open('test');
    testDB.onsuccess = () => {
      indexedDB.deleteDatabase('test');
    };
  } catch (e) {
    showError("Modo incógnito no soportado. Usa modo normal.");
    return false;
  }
  
  return true;
}
```

---

## 📊 RESUMEN DE PRIORIDADES

### 🔥 IMPLEMENTAR ANTES DE PRODUCCIÓN (8)

1. Clock Skew Handling
2. Order Number Generation
3. Idempotencia en Proyecciones
4. Validación de Business Rules
5. Partial Failures en Batch
6. Límite de JSONB
7. Timezone en Reportes
8. Cleanup de IndexedDB

**Esfuerzo:** 10 días  
**Impacto:** Evita pérdida de dinero y datos corruptos

---

### ⚠️ IMPLEMENTAR ANTES DE ESCALAR (7)

9. Concurrent Edits
10. Rate Limiting por Tenant
11. Validación de Roles
12. Duplicate Terminal IDs
13. Backup Automático
14. Network Partitions
15. Validación de Catálogo

**Esfuerzo:** 8 días  
**Impacto:** Evita problemas de escalabilidad

---

### 💡 MEJORAS RECOMENDADAS (8)

16-23: Large Transactions, Storage Quota, Stale Reads, etc.

**Esfuerzo:** 6 días  
**Impacto:** Mejora UX y robustez

---

## 🎯 PLAN DE ACCIÓN SUGERIDO

### Semana 1 (Crítico)
- Días 1-2: Clock Skew + Order Number
- Días 3-4: Idempotencia + Business Rules
- Día 5: Partial Failures

### Semana 2 (Crítico)
- Días 1-2: JSONB Limits + Timezone
- Días 3-4: Cleanup + Testing
- Día 5: Buffer

### Semana 3 (Alto Riesgo)
- Concurrent Edits
- Rate Limiting
- Validación de Roles

---

## 📋 CHECKLIST DE VALIDACIÓN

Antes de ir a producción, verificar:

- [ ] Clock skew < 5 minutos
- [ ] Order numbers únicos (test con 2 terminales offline)
- [ ] Proyecciones idempotentes (enviar evento 2 veces)
- [ ] Business rules validadas en server
- [ ] Batch sync maneja fallos parciales
- [ ] JSONB < 1MB por orden
- [ ] Timezone correcto en reportes
- [ ] Cleanup automático funciona
- [ ] Rate limiting configurado
- [ ] Roles validados en eventos críticos

---

## 🆘 RIESGOS NO MITIGABLES

Algunos riesgos son inherentes al diseño offline-first:

1. **Split Brain:** Siempre posible con offline
   - Mitigación: UI clara + resolución manual

2. **Data Loss:** Si terminal se rompe antes de sync
   - Mitigación: Backup frecuente + educación usuario

3. **Clock Drift:** Relojes nunca perfectos
   - Mitigación: Validación de drift + server timestamp

---

**Generado por:** Kiro AI Assistant  
**Fecha:** 2026-01-05  
**Próxima Revisión:** Después de implementar fixes críticos

