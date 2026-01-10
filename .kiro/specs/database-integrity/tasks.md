# Implementation Plan: Database Integrity

## Overview

Corrección de inconsistencias entre eventos, enums TypeScript y schema Prisma en PARK POS.

## Tasks

### Fase 1: Alinear Enums Críticos

- [x] 1. Corregir OrderStatus en events.ts
  - [x] 1.1 Cambiar OrderStatusSchema de ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] a ["OPEN", "IN_PROGRESS", "CONFIRMED", "CANCELLED"]
    - Cambiado en events.ts
    - Corregido en api/admin/reports/route.ts y api/admin/dashboard/stats/route.ts
    - _Requirements: 1.1, 1.3_

- [x] 2. Corregir FulfillmentStatus en events.ts
  - [x] 2.1 Cambiar FulfillmentStatusSchema de ["COOKING", "PARTIAL_READY", "ALL_READY"] a ["COOKING", "READY", "DELIVERED"]
    - Cambiado en events.ts
    - db-enums.ts ya tenía los valores correctos
    - _Requirements: 2.1, 2.2_

- [x] 3. Corregir PaymentStatus en db-enums.ts
  - [x] 3.1 Cambiar PaymentStatus.PENDING a PaymentStatus.UNPAID
    - Alineado con events.ts que usa "UNPAID"
    - _Requirements: 3.1, 3.2_

- [x] 4. Verificar alineación
  - [x] 4.1 Ejecutar tests existentes
    - 55 tests de projections pasan ✅
    - 27 tests de domain pasan ✅
    - _Requirements: 1.1, 2.1, 3.1_

### Fase 2: Agregar Enums Faltantes

- [x] 5. Agregar CouponStatus
  - [x] 5.1 Definir enum en db-enums.ts
    - Valores: ACTIVE, RESERVED, REDEEMED, EXPIRED, VOIDED
    - _Requirements: 4.1_

- [x] 6. Agregar GoodsReceiptStatus
  - [x] 6.1 Definir enum en db-enums.ts
    - Valores: DRAFT, CONFIRMED, CANCELLED
    - _Requirements: 4.2_

- [x] 7. Agregar InventoryCountStatus
  - [x] 7.1 Definir enum en db-enums.ts
    - Valores: IN_PROGRESS, PENDING_APPROVAL, APPROVED, REJECTED
    - _Requirements: 4.3_

- [x] 8. Agregar PrintJobStatus
  - [x] 8.1 Definir enum en db-enums.ts
    - Valores: QUEUED, SENT, PRINTED, FAILED
    - _Requirements: 4.4_

- [x] 9. Agregar PurchaseOrderStatus
  - [x] 9.1 Definir enum en db-enums.ts
    - Valores: DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED
    - _Requirements: 4.5_

- [x] 10. Agregar ReservationStatus
  - [x] 10.1 Definir enum en db-enums.ts
    - Valores: PENDING, CONFIRMED, SEATED, COMPLETED, NO_SHOW, CANCELLED
    - _Requirements: 4.6_

- [x] 11. Agregar TableStatus
  - [x] 11.1 Definir enum en db-enums.ts
    - Valores: AVAILABLE, OCCUPIED, RESERVED, CLEANING
    - _Requirements: 4.7_

- [x] 12. Agregar AttendanceStatus
  - [x] 12.1 Definir enum en db-enums.ts
    - Valores: PRESENT, ABSENT, LATE, EARLY_LEAVE
    - _Requirements: 4.8_

- [x] 13. Agregar más enums operacionales
  - [x] 13.1 Agregar MessageOutboxStatus (QUEUED, SENT, FAILED)
  - [x] 13.2 Agregar InvoiceQueueStatus (PENDING, PROCESSING, COMPLETED, FAILED)
  - [x] 13.3 Agregar MarketingCampaignStatus (DRAFT, SCHEDULED, ACTIVE, PAUSED, COMPLETED)
  - [x] 13.4 Agregar StockTransferStatus (PENDING, SHIPPED, RECEIVED, CANCELLED)
  - [x] 13.5 Agregar TimeOffRequestStatus (PENDING, APPROVED, REJECTED)
  - [x] 13.6 Agregar WaitlistStatus (WAITING, NOTIFIED, SEATED, EXPIRED, CANCELLED)
  - [x] 13.7 Agregar AiSuggestionStatus (DRAFT, PENDING, APPROVED, REJECTED)
  - [x] 13.8 Agregar ScheduleStatus (SCHEDULED, CONFIRMED, SWAPPED, CANCELLED)
    - _Requirements: 4.1-4.8_

### Fase 3: Documentar Campos sin FK

- [x] 14. Agregar comentarios en schema.prisma
  - [x] 14.1 Documentar admin_access_logs.employee_id
    - Comentario: "Soft reference: No FK for audit trail integrity - must persist even if employee deleted"
    - _Requirements: 5.1, 5.2_

  - [x] 14.2 Documentar events.actor_id, entity_id, shift_id
    - Comentario: "Soft reference: event sourcing - immutable history"
    - _Requirements: 5.1, 5.2_

  - [x] 14.3 Documentar conflict_logs campos
    - Comentarios para event_id, aggregate_id, resolved_by
    - _Requirements: 5.1, 5.2_

  - [x] 14.4 Documentar inventory_log.actor_id, reference_id
    - Comentario: "Soft reference: audit trail - must persist even if actor deleted"
    - _Requirements: 5.1, 5.2_

  - [x] 14.5 Documentar login_attempts.employee_id
    - Comentario: "Soft reference: security audit - must persist for compliance even if employee deleted"
    - _Requirements: 5.1, 5.2_

  - [x] 14.6 Documentar waste_logs campos
    - Comentarios para shift_id, reported_by, approved_by, reference_id
    - _Requirements: 5.1, 5.2_

### Fase 4: Crear Tabla Tenants

- [x] 15. Crear modelo tenants
  - [x] 15.1 Agregar modelo en schema.prisma
    - Campos: id, name, is_active, created_at, updated_at
    - _Requirements: 6.1_

  - [x] 15.2 Agregar relación en tenant_settings
    - FK a tenants agregada
    - _Requirements: 6.2_

  - [x] 15.3 Crear migración (pendiente - requiere DB)
    - `npx prisma migrate dev --name add_tenants_table`
    - ✅ COMPLETADO: Migración 20260110033311_add_missing_product_columns aplicada
    - _Requirements: 6.3_

  - [x] 15.4 Seed tenant inicial (pendiente - requiere DB)
    - ✅ COMPLETADO: Tenant default insertado en migración
    - _Requirements: 6.3_

### Fase 5: Limpiar Campo Deprecado

- [x] 16. Remover orders.delivery
  - [x] 16.1 Buscar usos de orders.delivery en código
    - Encontrado en useLiveOrders.ts (accedía a campo inexistente)
    - _Requirements: 7.2_

  - [x] 16.2 Migrar código a usar delivery_orders
    - Actualizado useLiveOrders.ts para no usar o.delivery
    - Creado script migrate-orders-delivery.ts para migrar datos
    - _Requirements: 7.2_

  - [x] 16.3 Crear script de migración de datos
    - scripts/migrate-orders-delivery.ts creado
    - _Requirements: 7.3_

  - [x] 16.4 Remover campo de schema.prisma
    - Campo `delivery Json?` removido de orders
    - _Requirements: 7.1_

  - [x] 16.5 Ejecutar migración (pendiente - requiere DB)
    - `npx prisma migrate dev --name remove_orders_delivery`
    - ✅ COMPLETADO: Campo delivery removido en migración 20260110033311
    - _Requirements: 7.1_

### Fase 6: Tests y Verificación

- [x] 17. Verificar tests existentes
  - [x] 17.1 Tests de domain pasan (27/27) ✅
  - [x] 17.2 Tests de projections pasan (55/55) ✅
    - _Requirements: 1.2, 2.2, 3.2_

- [x] 18. Checkpoint final
  - [x] 18.1 Ejecutar suite de tests relevantes
    - domain: 27 passed ✅
    - projections: 55 passed ✅
    - _Requirements: 1.1-7.3_

  - [x] 18.2 Verificar diagnósticos
    - events.ts: 0 errores ✅
    - db-enums.ts: 0 errores ✅
    - schema.prisma: 0 errores ✅
    - _Requirements: 1.1-7.3_

## Notes

### Orden de Ejecución
1. **Fase 1 primero** - Corregir enums críticos que pueden causar errores
2. **Fase 2 segundo** - Agregar enums faltantes para completitud
3. **Fase 3 tercero** - Documentar decisiones de diseño
4. **Fase 4 opcional** - Crear tabla tenants si se necesita integridad referencial
5. **Fase 5 último** - Limpiar campo deprecado (requiere migración de datos)

### Riesgos
- Cambiar OrderStatus de DONE a CONFIRMED puede romper datos existentes
- Remover orders.delivery requiere verificar que no hay datos sin migrar

### Rollback
- Cada fase es independiente y puede revertirse
- Mantener backup antes de migraciones de datos

## Resumen Final

**Correcciones completadas:**

1. **Enums Críticos Alineados:**
   - `OrderStatusSchema`: DONE → CONFIRMED
   - `FulfillmentStatusSchema`: PARTIAL_READY/ALL_READY → READY/DELIVERED
   - `PaymentStatus`: PENDING → UNPAID

2. **16 Nuevos Enums Agregados en db-enums.ts:**
   - CouponStatus, GoodsReceiptStatus, InventoryCountStatus
   - PrintJobStatus, PurchaseOrderStatus, ReservationStatus
   - TableStatus, AttendanceStatus, MessageOutboxStatus
   - InvoiceQueueStatus, MarketingCampaignStatus, StockTransferStatus
   - TimeOffRequestStatus, WaitlistStatus, AiSuggestionStatus, ScheduleStatus

3. **Documentación de Campos sin FK en schema.prisma:**
   - admin_access_logs.employee_id
   - events.actor_id, entity_id, shift_id
   - conflict_logs.event_id, aggregate_id, resolved_by
   - inventory_log.actor_id, reference_id
   - login_attempts.employee_id
   - waste_logs.shift_id, reported_by, approved_by, reference_id

4. **Tabla Tenants Creada:**
   - Modelo `tenants` agregado con id, name, is_active, created_at, updated_at
   - Relación FK agregada en `tenant_settings`
   - Migración pendiente de ejecutar en DB

5. **Campo Deprecado Removido:**
   - `orders.delivery` removido de schema.prisma
   - `useLiveOrders.ts` actualizado para no usar campo inexistente
   - Script de migración creado: `scripts/migrate-orders-delivery.ts`
   - Migración pendiente de ejecutar en DB

**Tests:** 82 tests relevantes pasan (27 domain + 55 projections)

**Pendiente (requiere acceso a DB):**
- ✅ COMPLETADO: Migraciones aplicadas exitosamente
- ✅ COMPLETADO: Seed ejecutado con datos de prueba
- ✅ COMPLETADO: 82 tests pasan

**Migraciones aplicadas:**
1. `20251231054140_init` - Tablas base
2. `20260106041236_add_all_modules` - Módulos adicionales
3. `20260106053038_add_event_outbox` - Event outbox
4. `20260106053608_add_processed_events` - Processed events
5. `20260106053911_add_terminal_number_ranges` - Terminal ranges
6. `20260106060000_performance_indices` - Índices de performance
7. `20260110033311_add_missing_product_columns` - Database integrity fixes (tenants, locations, columnas faltantes)
