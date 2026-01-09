# Design Document: Event Schema Versioning

## Overview

Este diseño implementa un sistema de versionado de schemas para eventos que permite evolucionar la estructura de eventos sin romper la compatibilidad con eventos históricos. El sistema usa migraciones secuenciales y lazy evaluation para transformar eventos antiguos al schema actual.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Event Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Event   │───▶│   Migrator   │───▶│   Reducer    │          │
│  │  (v1/v2) │    │  (v1→v2→v3)  │    │  (expects v3)│          │
│  └──────────┘    └──────────────┘    └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Event Registry                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ORDER_CREATED│  │ORDER_ITEM   │  │CHECK_PAYMENT│       │  │
│  │  │ v1, v2, v3  │  │ v1, v2      │  │ v1          │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Event Migrator Service

```typescript
// src/core/domain/event-migrator.ts

export interface MigrationFunction {
  (payload: unknown): unknown;
}

export interface EventMigration {
  fromVersion: number;
  toVersion: number;
  migrate: MigrationFunction;
}

export interface EventMigratorConfig {
  eventType: string;
  currentVersion: number;
  migrations: EventMigration[];
}

export class EventMigrator {
  private registry: Map<string, EventMigratorConfig>;
  
  constructor();
  
  // Register migrations for an event type
  register(config: EventMigratorConfig): void;
  
  // Migrate event to current version
  migrate(event: ParkEvent): ParkEvent;
  
  // Get current version for event type
  getCurrentVersion(eventType: string): number;
  
  // Check if migration is needed
  needsMigration(event: ParkEvent): boolean;
}
```

### 2. Version Registry

```typescript
// src/core/domain/event-versions.ts

export const EVENT_VERSIONS: Record<string, number> = {
  // Order events
  ORDER_CREATED: 2,
  ORDER_ITEM_ADDED: 2,
  ORDER_ITEM_QTY_CHANGED: 1,
  ORDER_ITEM_STATUS_CHANGED: 1,
  ORDER_ITEM_VOIDED: 1,
  ORDER_CANCELLED: 1,
  
  // Check events
  CHECK_CREATED: 1,
  CHECK_PAYMENT_ADDED: 1,
  CHECK_MARKED_PAID: 1,
  CHECK_TIP_SET: 1,
  CHECK_ITEMS_UPDATED: 1,
  CHECK_ITEMS_MOVED: 1,
  
  // Shift events
  SHIFT_OPENED: 1,
  SHIFT_CLOSED: 1,
  CASH_ADJUSTED: 1,
  
  // Invoice events
  INVOICE_ISSUED: 1,
  INVOICE_VOIDED: 1,
  
  // Catalog events
  CATALOG_VERSION_BUMPED: 1,
};

export function getCurrentVersion(eventType: string): number {
  return EVENT_VERSIONS[eventType] ?? 1;
}
```

### 3. Migration Definitions

```typescript
// src/core/domain/migrations/order-migrations.ts

export const ORDER_CREATED_MIGRATIONS: EventMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (payload: any) => ({
      ...payload,
      // V2 adds delivery fields
      delivery_address: payload.delivery_address ?? null,
      delivery_fee_cents: payload.delivery_fee_cents ?? 0,
      delivery_instructions: payload.delivery_instructions ?? null,
    }),
  },
];

export const ORDER_ITEM_ADDED_MIGRATIONS: EventMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (payload: any) => ({
      ...payload,
      line: {
        ...payload.line,
        // V2 adds timestamps
        created_at: payload.line.created_at ?? null,
        started_cooking_at: payload.line.started_cooking_at ?? null,
        ready_at: payload.line.ready_at ?? null,
        served_at: payload.line.served_at ?? null,
      },
    }),
  },
];
```

## Data Models

### Event with Version

```typescript
interface ParkEvent {
  // ... existing fields
  schema_version: number;  // Already exists, default 1
  payload_version: number; // NEW: Version of the payload schema
}
```

### Migration Registry Entry

```typescript
interface MigrationRegistryEntry {
  eventType: string;
  currentVersion: number;
  migrations: Map<number, MigrationFunction>; // fromVersion -> migrate fn
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Migration Idempotence

*For any* event that has already been migrated to the current version, migrating it again SHALL produce an identical result (same payload, same version).

**Validates: Requirements 2.1, 2.4**

### Property 2: Migration Correctness (Combined)

*For any* event at version N < current, migrating it SHALL:
- Transform the payload to current version format
- Apply migrations sequentially (v1→v2→v3)
- Add default values for all new fields
- NOT modify the original event object

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 3: Version Preservation

*For any* event created or stored, the system SHALL:
- Set `payload_version` to the current schema version on creation
- Preserve the original `payload_version` when storing

**Validates: Requirements 1.2, 1.3**

### Property 4: Backward Compatibility

*For any* valid event from any known schema version (1 to current), the system SHALL successfully migrate and process it.

**Validates: Requirements 3.1**

### Property 5: Schema Validation After Migration

*For any* event migrated from an older version, the resulting payload SHALL pass validation against the current schema.

**Validates: Requirements 5.3**

### Property 6: Migration Performance

*For any* event, the migration overhead SHALL be less than 1ms.

**Validates: Requirements 6.3**

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `UNKNOWN_EVENT_TYPE` | Event type not in registry | Log warning, pass through unchanged |
| `UNKNOWN_VERSION` | Version higher than current | Log warning, attempt best-effort processing |
| `MIGRATION_FAILED` | Migration function threw | Log error, return original event |
| `INVALID_PAYLOAD` | Payload doesn't match expected schema | Log error, skip migration |

## Testing Strategy

### Unit Tests
- Test each migration function individually
- Test migration chain for each event type
- Test edge cases (null values, missing fields)
- Test error handling

### Property-Based Tests
- Property 1: Migration idempotence
- Property 2: Sequential migration consistency
- Property 3: Default value preservation
- Property 6: Backward compatibility

### Integration Tests
- Test full event flow with mixed versions
- Test reducer processing of migrated events
- Test performance with large batches
