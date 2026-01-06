# 🔧 PARK POS — Soluciones Alternativas y Trade-offs

**Fecha:** 2026-01-05  
**Objetivo:** Comparar diferentes approaches para los problemas críticos identificados

---

## 1. Clock Skew (Desincronización de Relojes)

### Problema
Terminales offline con relojes desincronizados generan eventos con timestamps incorrectos.

### Solución A: Server-Assigned Timestamp ⭐⭐⭐⭐⭐

**Approach:**
```typescript
// Cliente envía
{
  occurred_at_client: "2026-01-05T10:30:00Z",
  terminal_sequence: 123
}

// Server agrega
{
  occurred_at_server: "2026-01-05T10:31:00Z", // Timestamp confiable
  clock_drift_seconds: 60 // Diferencia detectada
}
```

**Pros:**
- ✅ Simple de implementar
- ✅ Timestamp confiable
- ✅ Detecta drift automáticamente

**Cons:**
- ⚠️ Requiere online para timestamp correcto
- ⚠️ Eventos offline tienen timestamp aproximado

**Cuándo usar:** **MVP y producción** (Recomendado)

---

### Solución B: Hybrid Logical Clock (HLC)

**Approach:**
```typescript
interface HybridTimestamp {
  physical: number;  // Unix timestamp
  logical: number;   // Counter monótono
  terminal_id: string;
}

// Comparación
function compare(a: HybridTimestamp, b: HybridTimestamp) {
  if (a.physical !== b.physical) return a.physical - b.physical;
  if (a.logical !== b.logical) return a.logical - b.logical;
  return a.terminal_id.localeCompare(b.terminal_id);
}
```

**Pros:**
- ✅ Funciona offline
- ✅ Orden total garantizado
- ✅ Usado en sistemas distribuidos (CockroachDB)

**Cons:**
- ⚠️ Más complejo
- ⚠️ Requiere sincronización de logical clock

**Cuándo usar:** Si necesitas orden estricto offline

---

### Solución C: NTP Sync en Terminales

**Approach:**
```typescript
// Sincronizar reloj cada hora
setInterval(async () => {
  const serverTime = await fetch('/api/time').then(r => r.json());
  const drift = serverTime.now - Date.now();
  
  if (Math.abs(drift) > 5000) { // > 5 segundos
    localStorage.setItem('clock_drift', drift.toString());
    toast.warning("Reloj del terminal desincronizado");
  }
}, 3600000);

// Ajustar timestamps
function getAdjustedTime() {
  const drift = parseInt(localStorage.getItem('clock_drift') || '0');
  return new Date(Date.now() + drift);
}
```

**Pros:**
- ✅ Timestamps más precisos
- ✅ Funciona offline después de sync

**Cons:**
- ⚠️ Requiere endpoint `/api/time`
- ⚠️ Drift puede cambiar

**Cuándo usar:** Complemento a Solución A

---

## 2. Order Number Generation

### Solución A: Range Allocation ⭐⭐⭐⭐⭐

**Approach:**
```typescript
// Al registrar terminal
const range = await fetch('/api/terminals/allocate-range', {
  method: 'POST',
  body: JSON.stringify({ terminal_id })
});

// Response: { start: 1000, end: 2000 }
localStorage.setItem('order_number_range', JSON.stringify(range));

// Generar número
let currentNumber = range.start;
function getNextOrderNumber() {
  if (currentNumber >= range.end) {
    throw new Error("RANGE_EXHAUSTED");
  }
  return currentNumber++;
}
```

**Pros:**
- ✅ Funciona offline
- ✅ Números únicos garantizados
- ✅ Secuencial (fácil de leer)

**Cons:**
- ⚠️ Requiere pre-allocación
- ⚠️ Puede desperdiciar números

**Cuándo usar:** **Producción** (Recomendado)

---

### Solución B: Composite ID

**Approach:**
```typescript
// Formato: {terminal_id}-{timestamp}-{counter}
const order_number = `T01-${Date.now()}-${counter++}`;

// Ejemplo: "T01-1704470400000-1"
```

**Pros:**
- ✅ Siempre único
- ✅ No requiere coordinación
- ✅ Incluye metadata

**Cons:**
- ⚠️ No secuencial
- ⚠️ Largo (difícil de comunicar)

**Cuándo usar:** MVP rápido

---

### Solución C: Server-Side Sequence

**Approach:**
```typescript
// Requiere online
const orderNumber = await fetch('/api/orders/next-number', {
  method: 'POST',
  body: JSON.stringify({ tenant_id })
}).then(r => r.json());

// Fallback offline
if (!navigator.onLine) {
  orderNumber = `OFFLINE-${Date.now()}`;
}
```

**Pros:**
- ✅ Secuencial perfecto
- ✅ Simple

**Cons:**
- ❌ No funciona offline
- ⚠️ Requiere red

**Cuándo usar:** Solo si siempre online

---

## 3. Idempotencia en Proyecciones

### Solución A: Processed Events Table ⭐⭐⭐⭐⭐

**Approach:**
```sql
CREATE TABLE processed_events (
  event_id UUID PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_processed_events_cleanup 
ON processed_events(processed_at) 
WHERE processed_at < NOW() - INTERVAL '30 days';
```

```typescript
async function projectEvent(tx, event) {
  // Check si ya procesado
  const exists = await tx.processedEvents.findUnique({
    where: { event_id: event.event_id }
  });
  
  if (exists) {
    console.log(`[Projection] Event ${event.event_id} already processed`);
    return;
  }
  
  // Proyectar
  await doProjection(tx, event);
  
  // Marcar como procesado
  await tx.processedEvents.create({
    event_id: event.event_id
  });
}
```

**Pros:**
- ✅ Idempotencia garantizada
- ✅ Simple de implementar
- ✅ Auditable

**Cons:**
- ⚠️ Tabla adicional
- ⚠️ Requiere cleanup

**Cuándo usar:** **Producción** (Recomendado)

---

### Solución B: Rebuild Completo

**Approach:**
```typescript
// Nunca proyección incremental
// Siempre rebuild desde events

async function rebuildOrder(orderId) {
  const events = await prisma.event.findMany({
    where: { entity_id: orderId },
    orderBy: { occurred_at: 'asc' }
  });
  
  let state = null;
  for (const event of events) {
    state = applyEvent(state, event);
  }
  
  // Guardar estado final
  await prisma.order.upsert({
    where: { id: orderId },
    create: state,
    update: state
  });
}
```

**Pros:**
- ✅ Siempre correcto
- ✅ No necesita deduplicación

**Cons:**
- ❌ Lento con muchos eventos
- ❌ No escalable

**Cuándo usar:** Solo para debugging

---

### Solución C: Event Sequence Number

**Approach:**
```typescript
// Agregar sequence a proyección
model Order {
  // ...
  last_event_sequence Int @default(0)
}

// Solo aplicar si sequence > last
if (event.terminal_sequence > order.last_event_sequence) {
  await projectEvent(event);
  order.last_event_sequence = event.terminal_sequence;
}
```

**Pros:**
- ✅ Simple
- ✅ No tabla adicional

**Cons:**
- ⚠️ Asume orden estricto
- ⚠️ Falla con eventos fuera de orden

**Cuándo usar:** Si eventos siempre en orden

---

## 4. Concurrent Edits (Split Brain)

### Solución A: Optimistic Locking ⭐⭐⭐⭐⭐

**Approach:**
```typescript
model Order {
  // ...
  revision Int @default(0)
}

// Cliente envía
{
  event_type: "ORDER_ITEM_ADDED",
  payload: {
    order_id: "...",
    expected_revision: 5, // Lo que cliente cree
    // ...
  }
}

// Server valida
const order = await prisma.order.findUnique({ where: { id } });
if (order.revision !== expected_revision) {
  return {
    accepted: false,
    error: {
      code: "CONFLICT",
      message: "Orden modificada por otro terminal",
      current_revision: order.revision,
      user_action: "Refresca y reintenta"
    }
  };
}

// Incrementar revision
await prisma.order.update({
  where: { id },
  data: { revision: { increment: 1 } }
});
```

**Pros:**
- ✅ Detecta conflictos
- ✅ Simple de implementar
- ✅ Usado en sistemas reales (Firestore)

**Cons:**
- ⚠️ Requiere retry en cliente
- ⚠️ UX: usuario debe resolver

**Cuándo usar:** **Producción** (Recomendado)

---

### Solución B: Last-Write-Wins (LWW)

**Approach:**
```typescript
// El evento con timestamp más reciente gana
const events = await prisma.event.findMany({
  where: { entity_id: orderId },
  orderBy: { occurred_at: 'desc' }
});

// Aplicar en orden inverso (más reciente primero)
```

**Pros:**
- ✅ Simple
- ✅ No requiere intervención

**Cons:**
- ❌ Puede perder cambios
- ❌ No determinístico con clock skew

**Cuándo usar:** Solo si conflictos son raros

---

### Solución C: Operational Transformation (OT)

**Approach:**
```typescript
// Merge automático de cambios
function transform(op1, op2) {
  // Si ambos agregan items, merge
  if (op1.type === "ADD_ITEM" && op2.type === "ADD_ITEM") {
    return [op1, op2]; // Ambos se aplican
  }
  
  // Si uno agrega y otro borra el mismo item
  if (op1.type === "ADD_ITEM" && op2.type === "REMOVE_ITEM" && op1.line_id === op2.line_id) {
    return [op2]; // Borrar gana
  }
  
  // ...
}
```

**Pros:**
- ✅ Merge automático
- ✅ No pierde cambios

**Cons:**
- ❌ Muy complejo
- ❌ Difícil de debuggear

**Cuándo usar:** Solo si necesitas colaboración real-time

---

## 5. Timezone Handling

### Solución A: Store in UTC, Display in Local ⭐⭐⭐⭐⭐

**Approach:**
```typescript
// Siempre guardar en UTC
const event = {
  occurred_at: new Date().toISOString(), // UTC
};

// Convertir a timezone del tenant para display
import { utcToZonedTime, format } from 'date-fns-tz';

const tenantTz = "America/Lima";
const localTime = utcToZonedTime(event.occurred_at, tenantTz);
const formatted = format(localTime, 'yyyy-MM-dd HH:mm:ss', { timeZone: tenantTz });
```

**Pros:**
- ✅ Standard practice
- ✅ No ambigüedad
- ✅ Fácil de convertir

**Cons:**
- ⚠️ Requiere conversión en UI

**Cuándo usar:** **Siempre** (Best practice)

---

### Solución B: Store in Tenant Timezone

**Approach:**
```typescript
// Guardar en timezone del tenant
const tenantTz = "America/Lima";
const localTime = zonedTimeToUtc(new Date(), tenantTz);
```

**Pros:**
- ✅ No conversión en reportes

**Cons:**
- ❌ Ambiguo (DST)
- ❌ Difícil de migrar

**Cuándo usar:** Nunca (Anti-pattern)

---

## 📊 MATRIZ DE DECISIÓN

| Problema | Solución Recomendada | Alternativa | Cuándo Alternativa |
|----------|---------------------|-------------|-------------------|
| Clock Skew | Server-Assigned | HLC | Orden estricto offline |
| Order Number | Range Allocation | Composite ID | MVP rápido |
| Idempotencia | Processed Events | Rebuild | Solo debugging |
| Concurrent Edits | Optimistic Lock | LWW | Conflictos raros |
| Timezone | UTC + Convert | - | Siempre UTC |

---

## 🎯 RECOMENDACIONES FINALES

### Para MVP (Semana 1-2)
- Server-Assigned Timestamp
- Composite Order Number
- Processed Events Table
- Last-Write-Wins (con alerta)
- UTC everywhere

### Para Producción (Semana 3-4)
- + NTP Sync
- + Range Allocation
- + Optimistic Locking
- + Conflict Resolution UI

### Para Escala (Mes 2+)
- + Hybrid Logical Clock
- + Operational Transformation
- + Advanced Monitoring

---

**Generado por:** Kiro AI Assistant  
**Fecha:** 2026-01-05

