# Requirements Document: Schema Completeness

## Introduction

Este documento define los requisitos para completar el schema de base de datos de PARK POS, agregando campos críticos faltantes en entidades existentes y nuevas tablas para el módulo de inventario/insumos enterprise. El objetivo es tener un sistema que soporte:
- Trazabilidad completa de órdenes (mesa, mesero, cliente, turno)
- Ciclo completo de inventario (compra → recepción → stock → venta → control)
- Detección y registro de merma

## Glossary

- **Order**: Entidad que representa una orden de venta en el POS
- **Event**: Registro inmutable de un cambio en el sistema (Event Sourcing)
- **Inventory**: Stock actual de un insumo
- **PurchaseOrder**: Orden de compra a un proveedor
- **GoodsReceipt**: Documento de recepción de mercadería
- **InventoryCount**: Conteo físico de inventario
- **WasteLog**: Registro de merma o pérdida de insumos
- **Recipe**: Receta que define qué insumos se usan para producir un producto
- **Deducción_Automática**: Proceso de descontar inventario automáticamente al vender

---

## Requirements

### Requirement 1: Campos Críticos en Order

**User Story:** Como administrador, quiero que cada orden tenga referencias directas a mesa, mesero, cliente, turno y fecha de negocio, para poder generar reportes precisos y cuadrar caja.

#### Acceptance Criteria

1. WHEN una orden es creada, THE Order SHALL tener un campo `shift_id` que referencia al turno activo
2. WHEN una orden es creada, THE Order SHALL tener un campo `waiter_id` que referencia al empleado que tomó la orden
3. WHEN una orden es de tipo DINE_IN, THE Order SHALL tener un campo `table_id` que referencia a la mesa
4. WHEN una orden tiene cliente identificado, THE Order SHALL tener un campo `customer_id` que referencia al cliente
5. WHEN una orden es creada, THE Order SHALL tener un campo `location_id` que referencia a la ubicación/local
6. WHEN una orden es creada, THE Order SHALL calcular y almacenar `business_date` basado en la hora de corte (6AM)
7. THE Order SHALL mantener consistencia entre los campos directos y el JSON `fulfillment`

---

### Requirement 2: Campos Críticos en Event

**User Story:** Como desarrollador, quiero que cada evento tenga referencia al turno y fecha de negocio, para poder reconstruir el estado por turno y generar reportes.

#### Acceptance Criteria

1. WHEN un evento es emitido, THE Event SHALL incluir `shift_id` en el envelope si hay turno activo
2. WHEN un evento es emitido, THE Event SHALL incluir `business_date` calculado con hora de corte 6AM
3. THE BaseEnvelopeSchema en events.ts SHALL incluir `shift_id` como campo opcional
4. THE BaseEnvelopeSchema en events.ts SHALL incluir `business_date` como campo requerido

---

### Requirement 3: Timestamps en Items de Orden

**User Story:** Como gerente de cocina, quiero saber cuándo se agregó cada item y cuándo cambió de estado, para medir tiempos de preparación (KPIs).

#### Acceptance Criteria

1. WHEN un item es agregado a una orden, THE OrderLine SHALL registrar `created_at` timestamp
2. WHEN un item cambia a estado COOKING, THE OrderLine SHALL registrar `started_cooking_at` timestamp
3. WHEN un item cambia a estado READY, THE OrderLine SHALL registrar `ready_at` timestamp
4. WHEN un item cambia a estado DONE, THE OrderLine SHALL registrar `served_at` timestamp
5. THE sale.reducer SHALL actualizar estos timestamps al procesar eventos de cambio de estado

---

### Requirement 4: Módulo de Compras

**User Story:** Como encargado de compras, quiero registrar órdenes de compra a proveedores y tener un catálogo de qué vende cada proveedor, para planificar y controlar las compras.

#### Acceptance Criteria

1. THE System SHALL tener una tabla `PurchaseOrder` con campos: id, tenant_id, location_id, supplier_id, order_number, status, subtotal_cents, tax_cents, total_cents, expected_delivery_date, notes, created_by, created_at
2. THE System SHALL tener una tabla `PurchaseOrderItem` con campos: id, purchase_order_id, inventory_code, quantity_ordered, unit, unit_cost_cents, total_cents
3. THE System SHALL tener una tabla `SupplierProduct` con campos: id, tenant_id, supplier_id, inventory_code, supplier_sku, unit_cost_cents, min_order_qty, lead_time_days, is_active
4. WHEN una PurchaseOrder es creada, THE System SHALL asignar un número secuencial por location
5. WHEN una PurchaseOrder cambia de estado, THE System SHALL validar transiciones válidas: DRAFT → SENT → PARTIAL_RECEIVED → RECEIVED → CANCELLED
6. THE PurchaseOrder.status SHALL ser uno de: DRAFT, SENT, PARTIAL_RECEIVED, RECEIVED, CANCELLED

---

### Requirement 5: Módulo de Recepción de Mercadería

**User Story:** Como encargado de almacén, quiero registrar la recepción de mercadería validando cantidad recibida vs pedida, para detectar faltantes o merma en recepción.

#### Acceptance Criteria

1. THE System SHALL tener una tabla `GoodsReceipt` con campos: id, tenant_id, location_id, purchase_order_id, receipt_number, received_by, received_at, notes, status
2. THE System SHALL tener una tabla `GoodsReceiptItem` con campos: id, goods_receipt_id, inventory_code, quantity_ordered, quantity_received, quantity_rejected, rejection_reason, unit_cost_cents, lot_number, expiry_date
3. WHEN un GoodsReceiptItem es registrado, THE System SHALL calcular la diferencia entre quantity_ordered y quantity_received
4. WHEN quantity_received < quantity_ordered, THE System SHALL registrar la diferencia como merma potencial
5. WHEN un GoodsReceipt es confirmado, THE System SHALL crear registros en InventoryLog con movement_type = 'IN'
6. WHEN un GoodsReceipt es confirmado, THE System SHALL actualizar el stock en Inventory
7. IF quantity_rejected > 0, THEN THE System SHALL registrar en WasteLog con reason = 'REJECTED_ON_RECEIPT'

---

### Requirement 6: Módulo de Control de Inventario

**User Story:** Como administrador, quiero realizar conteos físicos de inventario y registrar merma con detalle, para detectar diferencias entre stock teórico y real.

#### Acceptance Criteria

1. THE System SHALL tener una tabla `InventoryCount` con campos: id, tenant_id, location_id, count_date, count_type, status, counted_by, approved_by, notes, created_at
2. THE System SHALL tener una tabla `InventoryCountItem` con campos: id, inventory_count_id, inventory_code, expected_qty, counted_qty, difference_qty, unit_cost_cents, difference_value_cents, notes
3. THE System SHALL tener una tabla `WasteLog` con campos: id, tenant_id, location_id, inventory_code, quantity, unit, reason_code, reason_detail, cost_cents, reported_by, approved_by, photo_url, created_at
4. WHEN un InventoryCount es iniciado, THE System SHALL pre-cargar expected_qty desde Inventory.stock
5. WHEN un InventoryCountItem tiene difference_qty != 0, THE System SHALL requerir una nota explicativa
6. WHEN un InventoryCount es aprobado, THE System SHALL crear ajustes en InventoryLog con movement_type = 'ADJUST'
7. WHEN un InventoryCount es aprobado, THE System SHALL actualizar Inventory.stock con los valores contados
8. THE WasteLog.reason_code SHALL ser uno de: EXPIRED, DAMAGED, THEFT, PRODUCTION_LOSS, REJECTED_ON_RECEIPT, COUNT_ADJUSTMENT, OTHER
9. WHEN un WasteLog es registrado, THE System SHALL crear un InventoryLog con movement_type = 'WASTE'

---

### Requirement 7: Campos Adicionales en Inventory

**User Story:** Como administrador de múltiples locales, quiero que el inventario soporte ubicaciones, fechas de vencimiento y lotes, para tener control granular.

#### Acceptance Criteria

1. THE Inventory SHALL tener un campo `location_id` para soportar multi-local
2. THE Inventory SHALL tener un campo `expiry_date` opcional para control de caducidad
3. THE Inventory SHALL tener un campo `lot_number` opcional para trazabilidad
4. THE Inventory SHALL tener un campo `last_count_at` para saber cuándo fue el último conteo
5. THE Inventory SHALL tener un campo `theoretical_stock` para comparar con stock real
6. WHEN theoretical_stock difiere significativamente de stock, THE System SHALL generar una alerta

---

### Requirement 8: Deducción Automática de Inventario

**User Story:** Como sistema, quiero descontar automáticamente los insumos del inventario cuando se vende un producto, basándome en la receta, para mantener el stock teórico actualizado.

#### Acceptance Criteria

1. WHEN un item de orden cambia a estado DONE, THE System SHALL buscar la receta del producto
2. WHEN existe una receta, THE System SHALL calcular los insumos a descontar basado en quantity * recipe.ingredients
3. WHEN se calcula la deducción, THE System SHALL crear registros en InventoryLog con movement_type = 'OUT' y reference_id = order_id
4. WHEN se crea el InventoryLog, THE System SHALL actualizar Inventory.stock restando la cantidad
5. WHEN se crea el InventoryLog, THE System SHALL actualizar Inventory.theoretical_stock
6. IF el stock resultante < 0, THEN THE System SHALL permitir la operación pero generar una alerta de stock negativo
7. IF el stock resultante < min_stock, THEN THE System SHALL generar una StockAlert de tipo LOW_STOCK
8. THE System SHALL emitir un evento INVENTORY_DEDUCTED con el detalle de la deducción

---

### Requirement 9: Eventos de Inventario

**User Story:** Como sistema Event Sourcing, quiero tener eventos específicos para inventario, para mantener la trazabilidad y permitir replay.

#### Acceptance Criteria

1. THE System SHALL definir evento PURCHASE_ORDER_CREATED con payload: purchase_order_id, supplier_id, items[], total_cents
2. THE System SHALL definir evento PURCHASE_ORDER_STATUS_CHANGED con payload: purchase_order_id, from_status, to_status
3. THE System SHALL definir evento GOODS_RECEIVED con payload: goods_receipt_id, purchase_order_id, items[]
4. THE System SHALL definir evento INVENTORY_ADJUSTED con payload: inventory_code, from_qty, to_qty, reason
5. THE System SHALL definir evento INVENTORY_DEDUCTED con payload: order_id, line_id, product_id, ingredients[]
6. THE System SHALL definir evento WASTE_RECORDED con payload: inventory_code, quantity, reason_code, cost_cents
7. THE System SHALL definir evento INVENTORY_COUNT_COMPLETED con payload: inventory_count_id, items[], total_difference_cents

---

### Requirement 10: Índices y Performance

**User Story:** Como sistema, quiero tener índices optimizados en las nuevas tablas, para mantener el rendimiento con alto volumen de datos.

#### Acceptance Criteria

1. THE PurchaseOrder SHALL tener índice en (tenant_id, location_id, status)
2. THE PurchaseOrder SHALL tener índice en (tenant_id, supplier_id)
3. THE GoodsReceipt SHALL tener índice en (tenant_id, location_id, received_at DESC)
4. THE InventoryCount SHALL tener índice en (tenant_id, location_id, count_date DESC)
5. THE WasteLog SHALL tener índice en (tenant_id, location_id, created_at DESC)
6. THE Inventory SHALL tener índice compuesto en (tenant_id, location_id, code)
7. THE SupplierProduct SHALL tener índice en (tenant_id, supplier_id, is_active)
