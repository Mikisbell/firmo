# Implementation Plan: Schema Completeness

## Overview

Este plan implementa las 5 fases de completitud del schema en orden incremental, asegurando que cada fase sea funcional antes de pasar a la siguiente. Se priorizan los cambios de schema sobre la lógica de negocio.

## Tasks

- [x] 1. Fase 1: Campos críticos en Order y Event
  - [x] 1.1 Agregar campos a Order en Prisma schema
    - Agregar: shift_id, waiter_id, table_id, customer_id, location_id, business_date
    - Agregar relaciones con Shift, Employee, Table, Customer
    - Agregar índices para los nuevos campos
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Agregar campos a BaseEnvelopeSchema en events.ts
    - Agregar shift_id como campo opcional (nullish)
    - Agregar business_date como campo requerido (string YYYY-MM-DD)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.3 Crear utilidad getBusinessDate
    - Crear src/core/utils/business-date.ts
    - Implementar lógica de hora de corte 6 AM
    - _Requirements: 1.6, 2.2_

  - [x] 1.4 Write property test for Business Date Calculation
    - **Property 2: Business Date Calculation**
    - **Validates: Requirements 1.6, 2.2**

  - [x] 1.5 Agregar timestamps a OrderLineSchema
    - Agregar: created_at, started_cooking_at, ready_at, served_at
    - Todos opcionales excepto created_at
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.6 Actualizar sale.reducer para manejar timestamps
    - En ORDER_ITEM_ADDED: set created_at
    - En ORDER_ITEM_STATUS_CHANGED: set timestamp según nuevo estado
    - _Requirements: 3.5_

  - [x] 1.7 Write property test for Item Timestamps by Status
    - **Property 3: Item Timestamps by Status**
    - **Validates: Requirements 3.2, 3.3, 3.4**

  - [x] 1.8 Ejecutar migración de Prisma
    - npx prisma db push (o migrate dev)
    - Verificar que no hay errores
    - _Requirements: 1.1-1.7_

- [x] 2. Checkpoint - Fase 1 completa
  - All tests pass ✓

- [x] 3. Fase 2: Módulo de Compras
  - [x] 3.1 Crear modelo PurchaseOrder en Prisma
    - Campos: id, tenant_id, location_id, supplier_id, order_number, status, totales, fechas
    - Índices: (tenant_id, location_id, status), (tenant_id, supplier_id)
    - Relación con Supplier
    - _Requirements: 4.1, 10.1, 10.2_

  - [x] 3.2 Crear modelo PurchaseOrderItem en Prisma
    - Campos: id, purchase_order_id, inventory_code, quantity_ordered, unit, costs
    - Relación con PurchaseOrder
    - _Requirements: 4.2_

  - [x] 3.3 Crear modelo SupplierProduct en Prisma
    - Campos: id, tenant_id, supplier_id, inventory_code, supplier_sku, costs, lead_time
    - Índice: (tenant_id, supplier_id, is_active)
    - Relación con Supplier
    - _Requirements: 4.3, 10.7_

  - [x] 3.4 Actualizar modelo Supplier con relaciones
    - Agregar relación a PurchaseOrder[]
    - Agregar relación a SupplierProduct[]
    - _Requirements: 4.1, 4.3_

  - [x] 3.5 Crear eventos de PurchaseOrder en inventory-events.ts
    - PURCHASE_ORDER_CREATED
    - PURCHASE_ORDER_STATUS_CHANGED
    - _Requirements: 9.1, 9.2_

  - [x] 3.6 Write property test for PurchaseOrder Status Transitions
    - **Property 4: PurchaseOrder Status Transitions**
    - **Validates: Requirements 4.5**

  - [x] 3.7 Ejecutar migración de Prisma
    - npx prisma db push
    - _Requirements: 4.1-4.6_

- [x] 4. Checkpoint - Fase 2 completa
  - All tests pass ✓

- [x] 5. Fase 3: Módulo de Recepción
  - [x] 5.1 Crear modelo GoodsReceipt en Prisma
    - Campos: id, tenant_id, location_id, purchase_order_id, receipt_number, status, received_by, dates
    - Índice: (tenant_id, location_id, received_at DESC)
    - Relación con PurchaseOrder
    - _Requirements: 5.1, 10.3_

  - [x] 5.2 Crear modelo GoodsReceiptItem en Prisma
    - Campos: id, goods_receipt_id, inventory_code, quantities (ordered, received, rejected), costs, lot, expiry
    - Relación con GoodsReceipt
    - _Requirements: 5.2_

  - [x] 5.3 Crear evento GOODS_RECEIVED en inventory-events.ts
    - Payload con items array incluyendo quantities y lot info
    - _Requirements: 9.3_

  - [x] 5.4 Crear servicio de confirmación de recepción
    - src/core/inventory/goods-receipt.service.ts
    - Crear InventoryLog entries con movement_type='IN'
    - Actualizar Inventory.stock
    - Crear WasteLog si quantity_rejected > 0
    - _Requirements: 5.5, 5.6, 5.7_

  - [x] 5.5 Write property test for GoodsReceipt Creates Inventory Movement
    - **Property 5: GoodsReceipt Creates Inventory Movement**
    - **Validates: Requirements 5.5, 5.6**

  - [x] 5.6 Write property test for GoodsReceipt Rejection Creates WasteLog
    - **Property 6: GoodsReceipt Rejection Creates WasteLog**
    - **Validates: Requirements 5.7**

  - [x] 5.7 Ejecutar migración de Prisma
    - npx prisma db push
    - _Requirements: 5.1-5.7_

- [x] 6. Checkpoint - Fase 3 completa
  - Schema models created ✓, services created ✓, tests passing ✓

- [x] 7. Fase 4: Módulo de Control de Inventario
  - [x] 7.1 Crear modelo InventoryCount en Prisma
    - Campos: id, tenant_id, location_id, count_date, count_type, status, actors, dates
    - Índice: (tenant_id, location_id, count_date DESC)
    - _Requirements: 6.1, 10.4_

  - [x] 7.2 Crear modelo InventoryCountItem en Prisma
    - Campos: id, inventory_count_id, inventory_code, quantities (expected, counted, difference), costs
    - Relación con InventoryCount
    - _Requirements: 6.2_

  - [x] 7.3 Crear modelo WasteLog en Prisma
    - Campos: id, tenant_id, location_id, shift_id, inventory_code, quantity, reason_code, costs, actors, photo
    - Índices: (tenant_id, location_id, created_at DESC), (tenant_id, reason_code)
    - _Requirements: 6.3, 10.5_

  - [x] 7.4 Agregar campos a Inventory en Prisma
    - Agregar: location_id, expiry_date, lot_number, last_count_at, theoretical_stock
    - Actualizar unique constraint a (tenant_id, location_id, code)
    - Agregar índice: (tenant_id, expiry_date)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 10.6_

  - [x] 7.5 Crear eventos de control en inventory-events.ts
    - INVENTORY_ADJUSTED
    - WASTE_RECORDED
    - INVENTORY_COUNT_COMPLETED
    - _Requirements: 9.4, 9.6, 9.7_

  - [x] 7.6 Crear servicio de conteo de inventario
    - src/core/inventory/inventory-count.service.ts
    - Iniciar conteo con expected_qty desde Inventory.stock
    - Aprobar conteo: crear InventoryLog ADJUST, actualizar stock
    - _Requirements: 6.4, 6.6, 6.7_

  - [x] 7.7 Crear servicio de registro de merma
    - src/core/inventory/waste.service.ts
    - Crear WasteLog y InventoryLog WASTE correspondiente
    - _Requirements: 6.9_

  - [x] 7.8 Write property test for InventoryCount Updates Stock
    - **Property 7: InventoryCount Updates Stock**
    - **Validates: Requirements 6.6, 6.7**

  - [x] 7.9 Write property test for InventoryCount Difference Requires Notes
    - **Property 8: InventoryCount Difference Requires Notes**
    - **Validates: Requirements 6.5**

  - [x] 7.10 Write property test for WasteLog Creates InventoryLog
    - **Property 9: WasteLog Creates InventoryLog**
    - **Validates: Requirements 6.9**

  - [x] 7.11 Ejecutar migración de Prisma
    - npx prisma db push
    - _Requirements: 6.1-6.9, 7.1-7.6_

- [x] 8. Checkpoint - Fase 4 completa
  - Schema models created ✓, services created ✓, tests passing ✓

- [x] 9. Fase 5: Deducción Automática de Inventario
  - [x] 9.1 Crear evento INVENTORY_DEDUCTED en inventory-events.ts
    - Payload: order_id, line_id, product_id, ingredients[]
    - _Requirements: 9.5_

  - [x] 9.2 Crear servicio de deducción de inventario
    - src/core/inventory/deduction.service.ts
    - Buscar receta del producto
    - Calcular cantidades a deducir
    - Crear InventoryLog OUT para cada ingrediente
    - Actualizar stock y theoretical_stock
    - Retornar alertas si stock < 0 o stock < min_stock
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 9.3 Crear servicio de alertas de stock
    - src/core/inventory/stock-alert.service.ts (integrated in deduction.service.ts)
    - Crear StockAlert cuando stock < min_stock
    - _Requirements: 8.7_

  - [x] 9.4 Integrar deducción en projector de órdenes
    - En projectEvent para ORDER_ITEM_STATUS_CHANGED a DONE
    - Llamar deductInventoryForOrder
    - Emitir evento INVENTORY_DEDUCTED
    - _Requirements: 8.1, 8.8_

  - [x] 9.5 Write property test for Deduction Calculates Correctly
    - **Property 10: Deduction Calculates Correctly**
    - **Validates: Requirements 8.2**

  - [x] 9.6 Write property test for Deduction Creates InventoryLog
    - **Property 11: Deduction Creates InventoryLog**
    - **Validates: Requirements 8.3, 8.4**

  - [x] 9.7 Write property test for Low Stock Alert Generation
    - **Property 12: Low Stock Alert Generation**
    - **Validates: Requirements 8.7**

  - [x] 9.8 Write property test for Event Round-Trip
    - **Property 13: Event Round-Trip**
    - **Validates: Requirements 9.1-9.7**

- [x] 10. Checkpoint - Fase 5 completa
  - All services created ✓, all property tests passing (101 tests) ✓

- [x] 11. Migración de datos existentes
  - [x] 11.1 Script para calcular business_date en órdenes existentes
    - Usar getBusinessDate(created_at) para cada orden
    - _Requirements: 1.6_

  - [x] 11.2 Script para asignar location_id default a inventario
    - Crear location default si no existe
    - Asignar a todos los registros de Inventory
    - _Requirements: 7.1_

  - [x] 11.3 Actualizar seed.ts con datos de ejemplo
    - Agregar PurchaseOrder de ejemplo
    - Agregar GoodsReceipt de ejemplo
    - Agregar recetas para productos existentes
    - _Requirements: 4.1-4.6, 5.1-5.7_

- [x] 12. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que todas las migraciones se aplicaron correctamente
  - Verificar que los índices existen en la base de datos

## Notes

- All property-based tests are required for comprehensive coverage
- Each phase should be completed and tested before moving to the next
- Prisma migrations should be run after each phase's schema changes
- Property tests use fast-check library with minimum 100 iterations
