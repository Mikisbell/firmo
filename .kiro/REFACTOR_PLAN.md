# 🔧 REFACTOR PLAN - Services Fix

## PROBLEMA IDENTIFICADO

Los 3 servicios tienen errores sistemáticos:
1. **inventory.service.ts** - 30 errores
2. **invoice.service.ts** - 20 errores  
3. **order.service.ts** - 3 errores

**Causa raíz:** Código escrito sin validar contra schema real de Prisma.

---

## TABLAS DISPONIBLES EN PRISMA

### Inventory-Related
- ✅ `inventory` - Stock management
- ✅ `inventory_log` - Audit trail
- ✅ `inventory_counts` - Physical counts
- ✅ `inventory_count_items` - Count details
- ✅ `goods_receipts` - Purchase receipts
- ✅ `goods_receipt_items` - Receipt line items
- ✅ `purchase_orders` - PO headers
- ✅ `purchase_order_items` - PO line items
- ✅ `waste_logs` - Waste tracking (NO EXISTE - usar inventory_log con type='WASTE')
- ✅ `recipes` - Product recipes
- ✅ `stock_alerts` - Low stock alerts

### Invoice-Related
- ✅ `invoices` - Comprobantes
- ✅ `invoice_queue` - Processing queue
- ✅ `invoice_cdr` - CDR responses
- ✅ `refunds` - Refund tracking

### Order-Related
- ✅ `orders` - Order headers
- ✅ `events` - Event log
- ✅ `event_outbox` - Outbox pattern
- ✅ `processed_events` - Deduplication

---

## CAMPOS REALES EN TABLAS

### inventory table
```
id, tenant_id, code, name, unit, stock, theoretical_stock, 
min_stock, max_stock, location_id, category, is_active, 
cost_cents, selling_price_cents, lot_number, expiry_date, 
created_at, updated_at, created_by, updated_by
```

### inventory_log table
```
id, tenant_id, inventory_id, movement_type, quantity, 
reference_id, reason, actor_id, created_at
```

### waste_logs table
```
id, tenant_id, location_id, shift_id, inventory_code, quantity, 
unit, reason_code, reason_detail, cost_cents, reported_by, 
approved_by, approved_at, photo_url, reference_type, reference_id, 
created_at
```

### stock_alerts table
```
id, tenant_id, location_id, sku, alert_type, severity, 
current_qty, threshold_qty, is_acknowledged, acknowledged_by, 
acknowledged_at, created_at
```

### invoices table
```
id, tenant_id, order_id, check_id, invoice_type, series, 
invoice_number, total_cents, status, created_at, voided_at, 
voided_by, voided_reason
```

### orders table
```
id, tenant_id, order_number, order_type, order_status, 
fulfillment_status, handoff_status, stations_active, 
unpaid_checks_count, subtotal_cents, discount_cents, 
total_cents, items (JSONB), checks (JSONB), terminal_id, 
location_id, created_at, updated_at, revision
```

---

## ERRORES A CORREGIR

### inventory.service.ts

| Error | Línea | Problema | Solución |
|-------|-------|----------|----------|
| Import path | 20 | `@/core/result` | Cambiar a `@/src/core/result` |
| Import path | 21 | `@/core/db/enhanced-prisma` | Cambiar a `@/src/core/db/transaction` |
| Import path | 22 | `@/core/cache/redis.service` | Cambiar a `@/src/core/cache/redis.service` |
| Import path | 23 | `@/core/infra/event-bus` | Remover (no se usa) |
| Import path | 24 | `@/core/observability/logger-pino` | Cambiar a `@/src/core/observability/logger-pino` |
| Import path | 25 | `@/core/domain/inventory-events` | Cambiar a `@/src/core/domain/inventory-events` |
| Field | 213 | `locations` en include | Remover (no existe relación) |
| Field | 1067 | `is_active` en where | Cambiar a `is_active` (existe) |
| Field | 1087 | `max_stock` | Cambiar a `max_stock` (existe) |
| Field | 1090 | `is_active` | Cambiar a `is_active` (existe) |
| Field | 1113 | `is_resolved` | Cambiar a `is_acknowledged` |
| Export | 1418-1429 | Exportaciones duplicadas | Remover (ya exportadas como interfaces) |

### invoice.service.ts

| Error | Línea | Problema | Solución |
|-------|-------|----------|----------|
| Import path | 18 | `@/src/core/result` | ✅ Correcto |
| Import path | 19 | `@/src/core/cache/redis.service` | ✅ Correcto |
| Import path | 20 | `@/src/core/observability/logger-pino` | ✅ Correcto |
| Import path | 21 | `@/src/core/db/transaction` | ✅ Correcto |
| Method | 506 | `QueryMonitor.measure()` | Remover (no existe) |
| Export | 1208-1217 | Re-exports duplicadas | Remover |

### order.service.ts

| Error | Línea | Problema | Solución |
|-------|-------|----------|----------|
| Method | 196 | `QueryMonitor.measure()` | Remover (no existe) |
| Method | 305 | `cache.delete()` | Cambiar a `cache.invalidate()` o remover |
| Method | 446 | `cache.deletePattern()` | Cambiar a `cache.invalidate()` o remover |

---

## ESTRATEGIA DE REFACTOR

### FASE 1: Limpiar importaciones (5 min)
- [ ] Corregir todas las rutas de import
- [ ] Remover imports no usados
- [ ] Validar que no hay métodos fantasma

### FASE 2: Validar contra schema (10 min)
- [ ] Verificar que todos los campos existen en Prisma
- [ ] Cambiar nombres de campos incorrectos
- [ ] Remover relaciones que no existen

### FASE 3: Remover exportaciones duplicadas (2 min)
- [ ] Remover `export type { ... }` al final
- [ ] Mantener solo las interfaces exportadas

### FASE 4: Validar con TypeScript (5 min)
- [ ] Ejecutar `npm run build`
- [ ] Corregir errores restantes
- [ ] Validar que no hay warnings

### FASE 5: Testing (10 min)
- [ ] Ejecutar tests unitarios
- [ ] Verificar que servicios funcionan

---

## ARCHIVOS A MODIFICAR

1. `src/core/services/inventory.service.ts` - 30 errores
2. `src/core/services/invoice.service.ts` - 20 errores
3. `src/core/services/order.service.ts` - 3 errores

---

## TIEMPO ESTIMADO

- **Total:** 30-40 minutos
- **Por archivo:** 10-15 minutos

---

## PRÓXIMOS PASOS

1. ✅ Crear este documento (HECHO)
2. ⏳ Ejecutar FASE 1-5 en orden
3. ⏳ Validar build sin errores
4. ⏳ Ejecutar tests
5. ⏳ Hacer git commit

