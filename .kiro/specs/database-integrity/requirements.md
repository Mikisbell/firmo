# Requirements Document

## Introduction

Este documento define los requisitos para corregir huecos e inconsistencias en la base de datos de PARK POS. Se identificaron desalineaciones entre eventos, enums de TypeScript y el schema de Prisma que pueden causar errores en runtime.

## Glossary

- **Enum**: Conjunto de valores válidos para un campo de status
- **FK (Foreign Key)**: Restricción de integridad referencial entre tablas
- **db-enums.ts**: Archivo TypeScript que define los valores válidos de status
- **events.ts**: Archivo que define los schemas Zod de eventos
- **schema.prisma**: Definición del schema de base de datos

## Requirements

### Requirement 1: Alinear OrderStatus

**User Story:** Como desarrollador, quiero que OrderStatus sea consistente entre eventos y base de datos, para evitar errores de validación.

#### Acceptance Criteria

1. WHEN events.ts define OrderStatusSchema, THE System SHALL use ["OPEN", "IN_PROGRESS", "CONFIRMED", "CANCELLED"]
2. WHEN db-enums.ts define OrderStatus, THE System SHALL match exactly with events.ts values
3. IF an event uses "DONE" status, THEN THE System SHALL migrate it to "CONFIRMED"

### Requirement 2: Alinear FulfillmentStatus

**User Story:** Como desarrollador, quiero que FulfillmentStatus sea consistente, para que el KDS funcione correctamente.

#### Acceptance Criteria

1. WHEN events.ts defines FulfillmentStatusSchema, THE System SHALL use ["COOKING", "READY", "DELIVERED"]
2. WHEN db-enums.ts defines FulfillmentStatus, THE System SHALL match exactly with events.ts values
3. IF code uses "PARTIAL_READY" or "ALL_READY", THEN THE System SHALL map to "READY"

### Requirement 3: Alinear PaymentStatus

**User Story:** Como desarrollador, quiero que PaymentStatus sea consistente, para que los pagos se procesen correctamente.

#### Acceptance Criteria

1. WHEN events.ts defines PaymentStatusSchema, THE System SHALL use ["UNPAID", "PARTIAL", "PAID"]
2. WHEN db-enums.ts defines PaymentStatus, THE System SHALL use ["UNPAID", "PARTIAL", "PAID"] (cambiar PENDING → UNPAID)

### Requirement 4: Agregar Enums Faltantes

**User Story:** Como desarrollador, quiero que todos los campos de status tengan enums definidos, para validación consistente.

#### Acceptance Criteria

1. THE db-enums.ts SHALL define CouponStatus with values ["ACTIVE", "RESERVED", "REDEEMED", "EXPIRED", "VOIDED"]
2. THE db-enums.ts SHALL define GoodsReceiptStatus with values ["DRAFT", "RECEIVED", "CANCELLED"]
3. THE db-enums.ts SHALL define InventoryCountStatus with values ["IN_PROGRESS", "PENDING_APPROVAL", "APPROVED", "REJECTED"]
4. THE db-enums.ts SHALL define PrintJobStatus with values ["QUEUED", "SENT", "PRINTED", "FAILED"]
5. THE db-enums.ts SHALL define PurchaseOrderStatus with values ["DRAFT", "SENT", "PARTIAL", "RECEIVED", "CANCELLED"]
6. THE db-enums.ts SHALL define ReservationStatus with values ["PENDING", "CONFIRMED", "SEATED", "COMPLETED", "NO_SHOW", "CANCELLED"]
7. THE db-enums.ts SHALL define TableStatus with values ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"]
8. THE db-enums.ts SHALL define AttendanceStatus with values ["PRESENT", "ABSENT", "LATE", "EARLY_LEAVE"]

### Requirement 5: Documentar Campos sin FK

**User Story:** Como desarrollador, quiero documentar los campos UUID sin FK, para entender las decisiones de diseño.

#### Acceptance Criteria

1. THE schema.prisma SHALL include comments explaining why certain UUID fields don't have FK relations
2. WHEN a UUID field intentionally lacks FK, THE comment SHALL explain the reason (e.g., "soft reference", "cross-tenant", "audit trail")

### Requirement 6: Crear Tabla Tenants

**User Story:** Como desarrollador, quiero una tabla tenants para integridad referencial multi-tenant.

#### Acceptance Criteria

1. THE schema.prisma SHALL define a tenants model with id, name, created_at
2. THE tenant_settings model SHALL have a relation to tenants
3. WHEN tenant_id is used in other tables, THE System SHALL reference the tenants table (optional FK for performance)

### Requirement 7: Remover Campo Deprecado

**User Story:** Como desarrollador, quiero eliminar campos deprecados, para mantener el schema limpio.

#### Acceptance Criteria

1. THE orders.delivery field SHALL be removed from schema.prisma
2. WHEN code references orders.delivery, THE System SHALL use delivery_orders table instead
3. THE migration SHALL preserve existing data by copying to delivery_orders if not already migrated
