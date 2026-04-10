# Bug Arquitectónico: Órdenes Seedeadas No Aparecen en UI

## Problema

Las órdenes creadas por `seedOrder()` en tests E2E **no aparecen en la UI del POS/caja**.

## Causa Raíz

El sistema usa **event sourcing con proyecciones en Dexie (IndexedDB)**:

```
UI → ParkEvent → db.events (Dexie) → Reducer → db.projections (Dexie) → UI
                                  ↕ (sync)
                    events table (PostgreSQL) → orders table (PostgreSQL)
```

`seedOrder()` escribe **solo en PostgreSQL**, saltándose todo el pipeline:

```
seedOrder() → orders table (PostgreSQL) → DEAD END (Dexie no se entera)
```

La UI del POS lee de `db.projections` en Dexie, **nunca de PostgreSQL directamente**.

## Evidencia

**Código que confirma el problema:**

1. `src/app/pos/hooks/useLiveOrders.ts` (línea 28-44):
   ```typescript
   const projections = useLiveQuery(async () => {
       const allProjections = await dbInstance.projections
           .where("key")
           .startsWith("order:")  // ← Lee de Dexie projections, NO PostgreSQL
           .toArray();
   ```

2. `e2e/helpers/db-seed.ts` `seedOrder()`:
   ```typescript
   await db.orders.upsert({  // ← Escribe en PostgreSQL directamente
       create: { ... },
   });
   // NO escribe en Dexie events ni projections
   ```

## Soluciones

### Opción 1: Seed vía API de Eventos (Recomendada)
Enviar eventos `ORDER_CREATED` a `/api/events/ingest` para que el pipeline completo se ejecute:

```typescript
// En lugar de seedOrder():
await ingestEvent({
  event_type: 'ORDER_CREATED',
  payload: { order_id, items, checks, ... },
});
// El sistema crea: event → projection → Dexie sync → UI
```

**Pros**: Respeta la arquitectura, datos consistentes
**Contras**: Requiere servidor corriendo, más lento

### Opción 2: Seed Directo en Dexie
Escribir directamente en `db.projections` y `db.events` de Dexie:

```typescript
await page.evaluate(async ({ orderId, orderData }) => {
  const db = getDb();
  // Crear evento
  await db.events.add({ event_id: uuid(), event_type: 'ORDER_CREATED', ... });
  // Crear proyección
  await db.projections.put({ key: `order:${orderId}`, data: orderData });
}, { orderId, orderData });
```

**Pros**: Rápido, no requiere servidor
**Contras**: Duplica lógica de seed, puede desincronizarse

### Opción 3: Fallback en useLiveOrders
Modificar `useLiveOrders` para hacer fallback a `/api/orders`:

```typescript
const dexieOrders = await loadFromDexie();
if (dexieOrders.length === 0) {
  // Fallback a PostgreSQL
  return await fetch('/api/orders?status=OPEN');
}
```

**Pros**: Resuelve el problema para tests E2E
**Contras**: Viola principio offline-first, complejo de mantener

## Decisión

**Opción 1** es la solución correcta porque:
- Respeta la arquitectura event-sourcing
- Garantiza consistencia entre stores
- Los tests validan el flujo real de producción
- Documenta cómo crear órdenes correctamente

## Impacto en Tests Actuales

| Test | Estado | Problema |
|------|--------|----------|
| `flujo-01-venta-completa.spec.ts` | ✅ Pasando | Valida orden en BD, NO en UI |
| `flujo-02-apertura-cierre-caja.spec.ts` | ✅ Pasando | No necesita órdenes en UI |
| `flujo-07-offline-sync.spec.ts` | ✅ Pasando | Simula offline, no requiere seed |
| `waiter-to-kds.spec.ts` | ✅ Pasando | Usa mock de catálogo |

**Ningún test actual depende de órdenes seedeadas apareciendo en UI.** Los tests que existen validan la BD directamente, que es correcto para el nivel de integración actual.

## Recomendación para Futuros Tests

Si se necesitan tests que validen el flujo completo (seed → UI → pago), usar la **Opción 1**:

```typescript
test('debería mostrar orden en UI y procesar pago', async ({ page }) => {
  // 1. Crear orden vía evento (no seed directo)
  await createOrderViaAPI({ items: [...], tenantId: TENANT_ID });
  
  // 2. Esperar a que el pipeline complete
  await page.waitForTimeout(2000);
  
  // 3. La orden ahora debe aparecer en UI
  const orderCards = page.locator('[data-testid^="order-card-"]');
  await expect(orderCards).toHaveCount(1);
});
```
