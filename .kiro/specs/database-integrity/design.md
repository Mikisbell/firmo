# Design Document

## Overview

Este documento describe el diseño para corregir las inconsistencias de la base de datos de PARK POS. El enfoque es alinear los enums entre `events.ts`, `db-enums.ts` y `schema.prisma`, agregar enums faltantes, y documentar decisiones de diseño sobre FKs.

## Architecture

La corrección sigue un enfoque de "single source of truth":

```
events.ts (Zod schemas)
    ↓ define valores válidos
db-enums.ts (TypeScript enums)
    ↓ exporta para validación
business-rules.ts / services
    ↓ usa para validar
schema.prisma (defaults)
```

## Components and Interfaces

### 1. Enum Alignment Strategy

```typescript
// events.ts - Source of truth para eventos
export const OrderStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CONFIRMED", "CANCELLED"]);

// db-enums.ts - Mirror para uso en servicios
export const OrderStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS', 
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;
```

### 2. New Enums to Add

```typescript
// db-enums.ts additions

export const CouponStatus = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  REDEEMED: 'REDEEMED',
  EXPIRED: 'EXPIRED',
  VOIDED: 'VOIDED',
} as const;

export const GoodsReceiptStatus = {
  DRAFT: 'DRAFT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export const InventoryCountStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const PrintJobStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  PRINTED: 'PRINTED',
  FAILED: 'FAILED',
} as const;

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIAL: 'PARTIAL',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export const ReservationStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SEATED: 'SEATED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;

export const TableStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  CLEANING: 'CLEANING',
} as const;

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EARLY_LEAVE: 'EARLY_LEAVE',
} as const;
```

### 3. Tenants Table

```prisma
model tenants {
  id         String   @id @db.Uuid @default(dbgenerated("gen_random_uuid()"))
  name       String
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamptz(6)
  
  // Relations
  settings   tenant_settings?
}

model tenant_settings {
  tenant_id  String  @id @db.Uuid
  // ... existing fields ...
  
  // Relation
  tenant     tenants @relation(fields: [tenant_id], references: [id])
}
```

### 4. FK Documentation Pattern

```prisma
model admin_access_logs {
  id          String   @id @db.Uuid
  tenant_id   String   @db.Uuid
  employee_id String   @db.Uuid  // Soft reference: No FK for audit trail integrity
  // ...
}
```

## Data Models

### Enum Value Mappings

| Field | Old Values | New Values | Migration |
|-------|-----------|------------|-----------|
| OrderStatus | DONE | CONFIRMED | Rename in events.ts |
| FulfillmentStatus | PARTIAL_READY, ALL_READY | READY | Map both to READY |
| PaymentStatus | PENDING | UNPAID | Rename in db-enums.ts |

### Fields Without FK (Intentional)

| Table | Field | Reason |
|-------|-------|--------|
| admin_access_logs | employee_id | Audit trail - must persist even if employee deleted |
| events | actor_id | Event sourcing - immutable history |
| conflict_logs | event_id | Conflict resolution - reference may be to rejected event |
| inventory_log | actor_id | Audit trail |
| login_attempts | employee_id | Security audit - must persist |
| waste_logs | reported_by, approved_by | Audit trail |

### Fields That Should Have FK (Future)

| Table | Field | Target | Priority |
|-------|-------|--------|----------|
| attendance | employee_id | employees | Low |
| attendance | location_id | locations | Low |
| inventory | location_id | locations | Medium |
| schedules | employee_id | employees | Low |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Enum Consistency
*For any* status field in the database, the value SHALL be one of the defined enum values in db-enums.ts
**Validates: Requirements 1.1, 2.1, 3.1, 4.1-4.8**

### Property 2: Event-DB Alignment
*For any* event type that sets a status field, the status value SHALL be valid according to both events.ts and db-enums.ts
**Validates: Requirements 1.2, 2.2, 3.2**

### Property 3: Tenant Integrity
*For any* record with tenant_id, the tenant_id SHALL reference an existing tenant (when tenants table exists)
**Validates: Requirements 6.1, 6.2, 6.3**

## Error Handling

- Invalid enum values: Log warning, use default value
- Missing tenant: Reject operation with clear error message
- FK violation: Allow soft references for audit tables, enforce for operational tables

## Testing Strategy

### Unit Tests
- Verify each enum in db-enums.ts matches events.ts
- Verify isValidStatus() works for all enum types
- Verify enum values match schema.prisma defaults

### Property Tests
- Generate random status values and verify validation
- Generate events and verify status fields are valid

### Integration Tests
- Create records with each status value
- Verify queries filter correctly by status
