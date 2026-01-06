# 🔴 AUDITORÍA CRÍTICA — PARK POS

> **Fecha:** Enero 2026  
> **Tipo:** Revisión de código real vs documentación  
> **Veredicto:** Sistema con bases sólidas pero **GAPS CRÍTICOS que bloquean producción**

---

## 🚨 RESUMEN EJECUTIVO

Después de revisar el código real (`sync/client.ts`, `ingest/route.ts`, `pos.actions.ts`, `sale.reducer.ts`, `schema.prisma`), encontré:

| Categoría | Estado | Riesgo |
|-----------|--------|--------|
| Event Sourcing básico | ✅ Funcional | Bajo |
| Sync Client | ⚠️ Incompleto | Alto |
| Server Projections | 🔴 Peligroso | Crítico |
| Validaciones | 🔴 Ausentes | Crítico |
| Idempotencia | 🔴 Parcial | Crítico |
| Performance | ⚠️ Problemas | Medio |

**Conclusión:** El sistema puede perder dinero en producción.

---

## 🔴 PROBLEMA 1: Proyecciones Server-Side NO son Idempotentes

### Código actual (ingest/route.ts línea 45-60):
```typescript
case "ORDER_ITEM_ADDED": {
  const order = await tx.order.findUnique({ where: { id: p.order_id } });
  if (order) {
    const lineCents = (p.line.qty || 1) * (p.line.unit_price_cents || 0);
    await tx.order.update({
      data: {
        items: [...items, p.line],
        subtotal_cents: order.subtotal_cents + lineCents, // ❌ SUMA INCREMENTAL
        total_cents: order.total_cents + lineCents,       // ❌ SUMA INCREMENTAL
      },
    });
  }
}
```

### Problema:
- Si el evento llega 2 veces (retry), el subtotal se suma 2 veces
- **NO hay verificación de `event_id` duplicado**
- El `try-catch` con `P2002` solo detecta duplicados en `events` table, no previene doble proyección

### Escenario de pérdida:
```
1. Cliente agrega "Pollo" S/25
2. Evento enviado, servidor procesa, subtotal = 25
3. Conexión se corta antes de ACK
4. Cliente reintenta mismo evento
5. Servidor procesa DE NUEVO, subtotal = 50 ❌
6. Cliente paga S/50 por S/25 de producto
```

### Solución:
```typescript
// ANTES de proyectar, verificar si ya se procesó
const alreadyProjected = await tx.processedEvent.findUnique({
  where: { event_id: ev.event_id }
});
if (alreadyProjected) {
  deduped_event_ids.push(ev.event_id);
  continue; // Skip projection
}

// Marcar como procesado
await tx.processedEvent.create({ data: { event_id: ev.event_id, tenant_id } });

// Ahora sí proyectar
await projectEvent(tx, ev);
```

---

## 🔴 PROBLEMA 2: CERO Validación de Reglas de Negocio

### Código actual (ingest/route.ts):
```typescript
// NO HAY validateBusinessRules()
// El servidor acepta CUALQUIER evento que pase Zod schema
```

### Lo que falta:
```typescript
// CHECK_MARKED_PAID sin validar que pago >= total
// INVOICE_ISSUED sin validar que check esté PAID
// ORDER_ITEM_VOIDED sin validar permisos de rol
// Cualquier actor_id puede hacer cualquier cosa
```

### Escenario de fraude:
```
1. Cajero corrupto envía CHECK_MARKED_PAID con payment = S/50
2. Total real era S/100
3. Servidor acepta (no valida)
4. Orden se marca PAID
5. Restaurante pierde S/50
```

### Solución:
Ver `MONEY_SAFETY.md` Solución 4 — Server Validation completa.

---

## 🔴 PROBLEMA 3: Order Number Collision Garantizada

### Código actual (pos.actions.ts):
```typescript
async createOrder(..., params: { order_number: number }) {
  // order_number viene del CLIENTE
  // NO hay generación server-side
  // NO hay validación de unicidad
}
```

### Problema:
- El `order_number` lo genera el cliente
- Si dos terminales offline generan el mismo número → COLISIÓN
- No hay constraint único en DB para `order_number` por tenant

### Escenario:
```
Terminal CAJA (offline): createOrder(order_number: 100)
Terminal MESA (offline): createOrder(order_number: 100)
Ambos sincronizan → DOS órdenes #100
Cocina: "¿Cuál es la orden 100?"
```

### Solución:
Ver `MONEY_SAFETY.md` Solución 3 — Range Allocation.

---

## 🔴 PROBLEMA 4: Outbox Pattern NO Implementado

### Código actual (ingest/route.ts línea 130-140):
```typescript
// Publish events to bus AFTER transaction commits
for (const ev of events as ParkEvent[]) {
  const { eventBus } = await import("@/src/core/infra/event-bus");
  eventBus.publish(tenant_id, ev); // ❌ FUERA de transacción
}
```

### Problema:
- Si `eventBus.publish()` falla, el evento está en DB pero nunca se notifica
- Otros terminales nunca reciben el evento via SSE
- **Inconsistencia silenciosa**

### Escenario:
```
1. Caja cobra orden #100
2. Evento guardado en PostgreSQL ✅
3. eventBus.publish() falla (memoria, crash, etc.)
4. KDS nunca recibe notificación
5. Cocina no sabe que orden está pagada
```

### Solución:
Ver `MONEY_SAFETY.md` Solución 2 — Outbox Pattern.

---

## 🟡 PROBLEMA 5: Sale Reducer Muta Estado Directamente

### Código actual (sale.reducer.ts línea 70):
```typescript
case "ORDER_ITEM_ADDED": {
  // ...
  sale.lines[line_id] = { ... };        // ❌ Mutación directa
  sale.subtotal_cents = computeSubtotal(sale.lines);  // ❌ Mutación directa
  sale.last_event_sequence = e.terminal_sequence;
  return { state: sale, warnings };     // Retorna mismo objeto mutado
}
```

### Problema:
- Viola principio de inmutabilidad de Event Sourcing
- Puede causar bugs sutiles con React (no detecta cambios)
- Dificulta debugging y time-travel

### Solución:
```typescript
case "ORDER_ITEM_ADDED": {
  const newLines = {
    ...sale.lines,
    [line_id]: { ... }
  };
  return {
    state: {
      ...sale,
      lines: newLines,
      subtotal_cents: computeSubtotal(newLines),
      last_event_sequence: e.terminal_sequence,
    },
    warnings
  };
}
```

---

## 🟡 PROBLEMA 6: Sync Client Hardcodea tenant_id

### Código actual (client.ts línea 90):
```typescript
private connectSSE() {
  // TODO: Get tenant_id dynamically from context/auth
  const tenantId = "00000000-0000-0000-0000-000000000001"; // ❌ HARDCODED
  this.eventSource = new EventSource(`/api/events/stream?tenant_id=${tenantId}`);
}
```

### Problema:
- Solo funciona para UN tenant
- Multi-tenant roto
- Cualquier terminal recibe eventos de todos

---

## 🟡 PROBLEMA 7: API Secret Hardcodeado en Cliente

### Código actual (client.ts línea 170):
```typescript
const r = await fetch(this.endpoint, {
  headers: {
    "x-api-secret": "park_secret_mvp_2025" // ❌ EXPUESTO EN BROWSER
  },
});
```

### Problema:
- Secret visible en DevTools
- Cualquiera puede enviar eventos falsos
- Zero seguridad real

### Solución:
- Usar autenticación por terminal (device token)
- JWT con refresh
- Validar terminal_id registrado

---

## 🟡 PROBLEMA 8: Sin Índices Críticos en PostgreSQL

### Schema actual:
```prisma
model Event {
  // ❌ Falta índice para sync queries
  // @@index([tenant_id, terminal_id, terminal_sequence])
}

model Order {
  // ❌ Falta índice parcial para órdenes activas
  // @@index([tenant_id, order_status]) WHERE order_status IN ('OPEN', 'IN_PROGRESS')
}
```

### Impacto:
- Queries lentos con volumen
- Full table scans
- Degradación progresiva

---

## 🟠 PROBLEMA 9: Timezone NO Manejado

### Código actual:
```typescript
// En projectEvent()
created_at: new Date(occurred_at), // ❌ Sin conversión de timezone
```

### Problema:
- `occurred_at` del cliente puede estar en cualquier timezone
- Server guarda en UTC
- `business_date` para reportes será incorrecto

---

## 🟠 PROBLEMA 10: Sin Límites de Tamaño

### Código actual:
```typescript
// Zod schema
events: z.array(EventSchema).min(1).max(500), // Max 500 eventos por batch

// Pero NO hay límite de:
// - items por orden
// - checks por orden
// - tamaño de JSONB
```

### Problema:
- Orden con 1000 items → JSONB de 5MB
- Query lento
- Memoria agotada en cliente

---

## 📊 MATRIZ DE IMPACTO Y PRIORIDAD

| # | Problema | Pérdida Potencial | Esfuerzo Fix | Prioridad |
|---|----------|-------------------|--------------|-----------|
| 1 | Proyecciones no idempotentes | S/500-2000/mes | 4 horas | 🔴 P0 |
| 2 | Sin validación de negocio | S/1000-5000/mes | 2 días | 🔴 P0 |
| 3 | Order number collision | Confusión operativa | 1 día | 🔴 P0 |
| 4 | Sin Outbox Pattern | Eventos perdidos | 1 día | 🔴 P0 |
| 5 | Reducer muta estado | Bugs sutiles | 4 horas | 🟡 P1 |
| 6 | tenant_id hardcoded | Multi-tenant roto | 2 horas | 🟡 P1 |
| 7 | API secret expuesto | Seguridad zero | 1 día | 🟡 P1 |
| 8 | Sin índices críticos | Performance | 2 horas | 🟡 P1 |
| 9 | Timezone no manejado | Reportes incorrectos | 4 horas | 🟡 P1 |
| 10 | Sin límites de tamaño | Crashes | 2 horas | 🟠 P2 |

---

## 🎯 PLAN DE ACCIÓN INMEDIATO

### Día 1 (CRÍTICO - Bloquea producción)

**Mañana:**
1. Crear tabla `processed_events` en Prisma
2. Modificar `projectEvent()` para verificar duplicados
3. Test: enviar mismo evento 2 veces, verificar que no duplique

**Tarde:**
4. Crear tabla `event_outbox` en Prisma
5. Mover `eventBus.publish()` dentro de transacción via outbox
6. Crear worker que publique desde outbox

### Día 2 (CRÍTICO)

**Mañana:**
7. Implementar `validateBusinessRules()` para:
   - CHECK_MARKED_PAID (pago >= total)
   - INVOICE_ISSUED (check debe estar PAID)
   - ORDER_ITEM_VOIDED (requiere MANAGER)

**Tarde:**
8. Implementar Range Allocation para order_number
9. Crear tabla `terminal_number_ranges`
10. Modificar `createOrder()` para usar rango

### Día 3 (IMPORTANTE)

11. Agregar índices críticos a Prisma schema
12. Implementar timezone handling con `date-fns-tz`
13. Agregar límites de tamaño (MAX_ITEMS = 50)
14. Refactorizar reducer para inmutabilidad

### Día 4 (SEGURIDAD)

15. Implementar autenticación por terminal
16. Remover API secret hardcodeado
17. Validar terminal_id en cada request

---

## 🧪 TESTS REQUERIDOS ANTES DE PRODUCCIÓN

```typescript
describe('Money Safety', () => {
  
  test('duplicate event does not double-count', async () => {
    const event = createOrderItemAddedEvent({ amount: 1000 });
    
    await ingest([event]);
    await ingest([event]); // Mismo event_id
    
    const order = await getOrder(event.payload.order_id);
    expect(order.subtotal_cents).toBe(1000); // NO 2000
  });
  
  test('rejects insufficient payment', async () => {
    // Crear orden con total = 5000
    // Intentar marcar paid con payment = 3000
    // Debe rechazar
  });
  
  test('rejects invoice without payment', async () => {
    // Crear orden, NO pagar
    // Intentar emitir factura
    // Debe rechazar
  });
  
  test('order numbers are unique across terminals', async () => {
    const num1 = await createOrder('terminal_1');
    const num2 = await createOrder('terminal_2');
    
    expect(num1).not.toBe(num2);
  });
  
  test('outbox guarantees delivery', async () => {
    // Crear evento
    // Verificar que está en outbox
    // Simular publish
    // Verificar que se marca published
  });
  
});
```

---

## 📋 CHECKLIST PRE-PRODUCCIÓN

### Seguridad Financiera
- [ ] Tabla `processed_events` existe
- [ ] `projectEvent()` verifica duplicados ANTES de proyectar
- [ ] Tabla `event_outbox` existe
- [ ] Worker de outbox corriendo
- [ ] `validateBusinessRules()` implementado para eventos de pago
- [ ] Range allocation para order_number
- [ ] Límites de tamaño validados

### Performance
- [ ] Índice `[tenant_id, terminal_id, terminal_sequence]` en events
- [ ] Índice parcial en orders activas
- [ ] Reducer no muta estado directamente

### Seguridad
- [ ] API secret removido del cliente
- [ ] Autenticación por terminal implementada
- [ ] tenant_id dinámico (no hardcoded)

### Datos
- [ ] Timezone handling con `date-fns-tz`
- [ ] `business_date` calculado correctamente
- [ ] Cleanup de IndexedDB implementado

---

## 🆘 RIESGOS ACEPTADOS (Documentados)

1. **Split Brain:** Dos terminales offline editando misma orden
   - Mitigación actual: Last-Write-Wins
   - Mitigación futura: Conflict Resolution UI (P1)

2. **Clock Skew:** Relojes de terminales desincronizados
   - Mitigación actual: Ninguna
   - Mitigación futura: Server-assigned timestamp (P1)

3. **Data Loss Local:** Usuario borra cache antes de sync
   - Mitigación actual: Ninguna
   - Mitigación futura: Backup automático (P1)

---

**Veredicto Final:** El sistema tiene arquitectura sólida pero implementación incompleta. **NO está listo para producción** hasta resolver los 4 problemas críticos (P0).

**Tiempo estimado para producción:** 4-5 días de desarrollo enfocado.
