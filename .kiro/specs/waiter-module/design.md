# Design Document: Waiter Module

## Overview

Este documento describe el diseño técnico para mejorar el módulo de Mesero (Mozo) del sistema PARK POS. El diseño se basa en la arquitectura existente de Event Sourcing y se integra con los componentes actuales (IndexedDB/Dexie, SyncClient, KDS).

El objetivo principal es eliminar valores hardcodeados, escalar a 15 terminales y 50+ mesas, y agregar funcionalidades profesionales que mejoren la velocidad y fluidez del servicio.

## Architecture

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WAITER MODULE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │  TableMap    │    │  OrderPage   │    │  ShiftSummary│               │
│  │  (page.tsx)  │    │  ([tableId]) │    │  (mi-turno)  │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                      HOOKS LAYER                             │        │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │        │
│  │  │useTableStatus  │  │useOrder        │  │useWaiterShift │  │        │
│  │  │useTableConfig  │  │useModifiers    │  │useNotifications│ │        │
│  │  └────────────────┘  └────────────────┘  └───────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                │                                         │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    SERVICES LAYER                            │        │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │        │
│  │  │TableService    │  │OrderService    │  │NotificationSvc│  │        │
│  │  │(config, status)│  │(CRUD, submit)  │  │(ready items)  │  │        │
│  │  └────────────────┘  └────────────────┘  └───────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                │                                         │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    CORE LAYER                                │        │
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐  │        │
│  │  │POSActions      │  │SyncClient      │  │Terminal_Config│  │        │
│  │  │(events)        │  │(offline/online)│  │(localStorage) │  │        │
│  │  └────────────────┘  └────────────────┘  └───────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                │                                         │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    DATA LAYER                                │        │
│  │  ┌────────────────┐  ┌────────────────┐                     │        │
│  │  │IndexedDB/Dexie │  │PostgreSQL      │                     │        │
│  │  │(local events)  │  │(server sync)   │                     │        │
│  │  └────────────────┘  └────────────────┘                     │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Waiter  │────>│ UI      │────>│ Hook    │────>│ Action  │
│ Tap     │     │ Event   │     │ Handler │     │ Emit    │
└─────────┘     └─────────┘     └─────────┘     └────┬────┘
                                                      │
                                                      ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ UI      │<────│ Hook    │<────│ Dexie   │<────│ IndexedDB│
│ Update  │     │ Query   │     │ Live    │     │ Store   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

## Components and Interfaces

### 1. Terminal Configuration

```typescript
// src/core/config/waiter-config.ts

export interface WaiterTerminalConfig {
  terminal_id: string;      // "waiter_01" - "waiter_15"
  terminal_type: "MOZO";
  tenant_id: string;
  actor_id: string;
  actor_name: string;       // "Pedro García"
  zone?: string;            // "A", "B", "BARRA"
  assigned_tables?: string[]; // ["M1", "M2", "M3"]
}

export function getWaiterConfig(): WaiterTerminalConfig | null {
  const config = getStoredTerminalConfig();
  if (!config || config.terminal_type !== "MOZO") return null;
  return config as WaiterTerminalConfig;
}
```

### 2. Table Configuration

```typescript
// src/core/config/table-config.ts

export interface TableConfig {
  id: string;           // "M1", "B1"
  name: string;         // "Mesa 1", "Barra 1"
  floor: FloorType;     // "SALON" | "TERRAZA" | "VIP" | "BARRA"
  capacity: number;     // 4
  zone?: string;        // "A"
  position?: { x: number; y: number }; // For visual layout
}

export type FloorType = "SALON" | "TERRAZA" | "VIP" | "BARRA";

export const FLOORS: { id: FloorType; name: string }[] = [
  { id: "SALON", name: "Salón" },
  { id: "TERRAZA", name: "Terraza" },
  { id: "VIP", name: "VIP" },
  { id: "BARRA", name: "Barra" },
];

// Default configuration - can be overridden by tenant config
export const DEFAULT_TABLES: TableConfig[] = [
  // Salón (Mesas 1-20)
  ...Array.from({ length: 20 }, (_, i) => ({
    id: `M${i + 1}`,
    name: `Mesa ${i + 1}`,
    floor: "SALON" as FloorType,
    capacity: 4,
    zone: i < 10 ? "A" : "B",
  })),
  // Terraza (Mesas 21-35)
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `M${i + 21}`,
    name: `Mesa ${i + 21}`,
    floor: "TERRAZA" as FloorType,
    capacity: 4,
    zone: "C",
  })),
  // VIP (Mesas 36-45)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `M${i + 36}`,
    name: `Mesa ${i + 36}`,
    floor: "VIP" as FloorType,
    capacity: 6,
    zone: "D",
  })),
  // Barra (B1-B10)
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `B${i + 1}`,
    name: `Barra ${i + 1}`,
    floor: "BARRA" as FloorType,
    capacity: 1,
    zone: "BARRA",
  })),
];
```

### 3. Table Status Hook (Enhanced)

```typescript
// src/app/mozo/hooks/useTableStatus.ts

export type TableStatus = "FREE" | "OCCUPIED" | "BILL_REQUESTED" | "PAID";

export interface TableInfo {
  id: string;
  name: string;
  floor: FloorType;
  status: TableStatus;
  orderId?: string;
  waiterName?: string;
  totalCents?: number;
  elapsedMinutes?: number;
  readyItemsCount?: number;
  createdAt?: string;
}

export function useTableStatus(floor?: FloorType) {
  // Returns reactive table status from IndexedDB events
  // Filters by floor if provided
  // Calculates elapsed time from ORDER_CREATED timestamp
  // Counts ready items from ORDER_ITEM_STATUS_CHANGED events
}
```

### 4. New Events

```typescript
// src/core/domain/events.ts (additions)

// Request check/bill
export interface RequestCheckPayload {
  order_id: string;
  table_number: string;
  total_cents: number;
  waiter_id: string;
  waiter_name: string;
  requested_at: string;
}

// Order submitted to kitchen
export interface OrderSubmittedPayload {
  order_id: string;
  table_number: string;
  items: Array<{
    line_id: string;
    product_id: string;
    name: string;
    qty: number;
    station: StationType;
    modifiers?: string[];
    notes?: string;
  }>;
  submitted_by: string;
  submitted_at: string;
}

// Item status changed (from KDS)
export interface OrderItemStatusChangedPayload {
  order_id: string;
  line_id: string;
  previous_status: ItemStatus;
  new_status: ItemStatus;
  changed_by: string;
  changed_at: string;
  station?: StationType;
}

export type StationType = "GRILL" | "BAR" | "OVEN" | "COLD" | "DESSERT";
export type ItemStatus = "PENDING" | "SENT" | "COOKING" | "READY" | "SERVED" | "VOIDED";
```

### 5. Order Actions (Enhanced)

```typescript
// src/core/actions/pos.actions.ts (additions)

export class POSActions {
  // Existing methods use Terminal_Config instead of hardcoded values
  
  static async createOrder(
    fulfillment: { order_type: string; table_number?: string }
  ): Promise<{ order_id: string }> {
    const config = getWaiterConfig();
    if (!config) throw new Error("Terminal not configured");
    
    return this._createOrder(
      config.tenant_id,
      config.terminal_id,
      config.actor_id,
      fulfillment
    );
  }

  static async requestCheck(orderId: string): Promise<void> {
    const config = getWaiterConfig();
    if (!config) throw new Error("Terminal not configured");
    
    // Emit REQUEST_CHECK event
  }

  static async submitToKitchen(orderId: string): Promise<void> {
    const config = getWaiterConfig();
    if (!config) throw new Error("Terminal not configured");
    
    // Emit ORDER_SUBMITTED event
    // Route items to stations
  }

  static async updateItemQuantity(
    orderId: string,
    lineId: string,
    newQty: number
  ): Promise<void> {
    // If newQty > current: emit ORDER_ITEM_ADDED
    // If newQty < current: emit ORDER_ITEM_VOIDED (partial)
    // If newQty = 0: emit ORDER_ITEM_VOIDED (full)
  }
}
```

### 6. Notification Service

```typescript
// src/core/notifications/waiter-notifications.ts

export interface WaiterNotification {
  id: string;
  type: "ITEM_READY" | "TABLE_WAITING" | "CHECK_REQUESTED";
  tableNumber: string;
  message: string;
  timestamp: string;
  read: boolean;
  data?: {
    orderId?: string;
    itemName?: string;
    station?: string;
  };
}

export function useWaiterNotifications() {
  // Subscribe to ORDER_ITEM_STATUS_CHANGED events
  // Filter by waiter's tables
  // Return unread notifications
  // Provide markAsRead function
}
```

## Data Models

### Table State Projection

```typescript
interface TableProjection {
  tableId: string;
  status: TableStatus;
  currentOrderId?: string;
  totalCents: number;
  itemCount: number;
  readyItemCount: number;
  createdAt?: Date;
  lastActivityAt?: Date;
}

// Rebuilt from events:
// ORDER_CREATED -> status = OCCUPIED, set createdAt
// ORDER_ITEM_ADDED -> increment itemCount, totalCents
// ORDER_ITEM_VOIDED -> decrement itemCount, totalCents
// ORDER_ITEM_STATUS_CHANGED (READY) -> increment readyItemCount
// REQUEST_CHECK -> status = BILL_REQUESTED
// CHECK_MARKED_PAID -> status = PAID
// ORDER_CANCELLED -> status = FREE
```

### Shift Summary Projection

```typescript
interface WaiterShiftSummary {
  waiterId: string;
  waiterName: string;
  shiftStart: Date;
  tablesServed: number;
  totalSalesCents: number;
  totalTipsCents: number;
  averageTicketCents: number;
  orders: Array<{
    orderId: string;
    tableNumber: string;
    totalCents: number;
    tipCents: number;
    closedAt?: Date;
  }>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Terminal Configuration Consistency

*For any* order event created by the Waiter_Module, the terminal_id and actor_id in the event payload SHALL match the values stored in Terminal_Config at the time of creation.

**Validates: Requirements 1.3, 1.4**

### Property 2: Unique Terminal Identifiers

*For any* set of 15 waiter terminals configured simultaneously, each terminal_id SHALL be unique and follow the pattern "waiter_XX" where XX is 01-15.

**Validates: Requirements 1.5**

### Property 3: Table Organization by Floor

*For any* table configuration, tables SHALL be correctly grouped by their floor attribute, and the floor filter SHALL return only tables belonging to that floor.

**Validates: Requirements 2.2**

### Property 4: Table Status Color Mapping

*For any* table with a given status and elapsed time, the visual indicator color SHALL be:
- GREEN when status = FREE
- BLUE when status = OCCUPIED and elapsed < 20min
- YELLOW when status = OCCUPIED and elapsed >= 20min, or status = BILL_REQUESTED
- RED when status = OCCUPIED and elapsed >= 40min

**Validates: Requirements 2.4, 9.3, 9.4**

### Property 5: Ready Items Badge Count

*For any* table with items in READY status, the badge count displayed SHALL equal the exact count of items with status = READY for that table's order.

**Validates: Requirements 2.5**

### Property 6: Single-Tap Item Addition

*For any* product tap action, the order SHALL contain that product with quantity = 1 after the action completes, or quantity incremented by 1 if the product already exists.

**Validates: Requirements 3.1**

### Property 7: Search Results Relevance

*For any* search query string, the returned product results SHALL contain only products whose name includes the query string (case-insensitive).

**Validates: Requirements 3.4**

### Property 8: Quantity Increment/Decrement

*For any* item with quantity N:
- After increment action: quantity SHALL be N + 1
- After decrement action with N > 1: quantity SHALL be N - 1
- After decrement action with N = 1: item SHALL be removed (with confirmation)

**Validates: Requirements 4.1, 4.2**

### Property 9: Supervisor Authorization for Sent Items

*For any* item with status >= SENT (SENT, COOKING, READY, SERVED), modification or removal SHALL require supervisor PIN validation before proceeding.

**Validates: Requirements 4.5**

### Property 10: Void Event Emission

*For any* item removal action, an ORDER_ITEM_VOIDED event SHALL be emitted containing: order_id, line_id, reason, voided_by, and voided_at.

**Validates: Requirements 4.6**

### Property 11: Modifier Price Calculation

*For any* item with modifiers, the item total SHALL equal: base_price_cents + sum(modifier.price_cents for all selected modifiers).

**Validates: Requirements 5.3**

### Property 12: KDS Event Includes Modifiers

*For any* ORDER_SUBMITTED event, each item in the payload SHALL include all selected modifiers and notes from the original order.

**Validates: Requirements 5.6**

### Property 13: Request Check Event Payload

*For any* REQUEST_CHECK event, the payload SHALL contain: order_id, table_number, total_cents (matching order total), waiter_id, and requested_at timestamp.

**Validates: Requirements 6.1, 6.2**

### Property 14: Table Status After Check Request

*For any* table after a REQUEST_CHECK event is emitted, the table status SHALL be BILL_REQUESTED.

**Validates: Requirements 6.4**

### Property 15: Pre-Check Total Accuracy

*For any* pre-check display, the total SHALL equal: sum(item.qty * item.unit_price_cents) + taxes, matching the order's calculated total.

**Validates: Requirements 6.7**

### Property 16: Station Routing

*For any* ORDER_SUBMITTED event, each item SHALL be routed to the station specified in product.station, and items with the same station SHALL be grouped together.

**Validates: Requirements 7.2**

### Property 17: Item Status Transition on Submit

*For any* item in an order after ORDER_SUBMITTED is processed, the item status SHALL change from PENDING to SENT.

**Validates: Requirements 7.4**

### Property 18: Empty Order Rejection

*For any* order with zero items, the submitToKitchen action SHALL be rejected and no ORDER_SUBMITTED event SHALL be emitted.

**Validates: Requirements 7.6**

### Property 19: Notification Payload Completeness

*For any* item ready notification, the payload SHALL contain: table_number, item_name, quantity, and pickup_station.

**Validates: Requirements 8.3**

### Property 20: Notification Grouping

*For any* table with multiple items changing to READY status within 5 seconds, the notifications SHALL be grouped into a single notification per table.

**Validates: Requirements 8.7**

### Property 21: Elapsed Time Calculation

*For any* occupied table, the elapsed time SHALL be calculated as: current_time - ORDER_CREATED.timestamp, displayed in minutes.

**Validates: Requirements 9.1, 9.2**

### Property 22: Online/Offline Indicator

*For any* network state change, the UI indicator SHALL reflect the current connection status within 1 second.

**Validates: Requirements 10.4**

### Property 23: Logout Clears Config

*For any* logout action, Terminal_Config SHALL be removed from localStorage and the user SHALL be redirected to the home page.

**Validates: Requirements 10.5**

### Property 24: Home Navigation Preserves Config

*For any* home navigation action, Terminal_Config SHALL remain in localStorage unchanged.

**Validates: Requirements 10.6**

### Property 25: Offline Queue and Sync

*For any* action performed while offline, the event SHALL be stored in IndexedDB and synced to the server when connection is restored.

**Validates: Requirements 12.2, 12.3**

### Property 26: Order Number Collision Prevention

*For any* set of orders created by different terminals, order numbers SHALL not collide due to terminal-specific range allocation.

**Validates: Requirements 12.4**

### Property 27: Shift Summary Accuracy

*For any* waiter shift summary, the totals SHALL equal:
- tablesServed = count of unique tables with orders by this waiter
- totalSalesCents = sum of all order totals
- averageTicketCents = totalSalesCents / tablesServed

**Validates: Requirements 11.2**

## Error Handling

### Network Errors

```typescript
// All actions should handle offline gracefully
try {
  await POSActions.submitToKitchen(orderId);
} catch (error) {
  if (error instanceof OfflineError) {
    // Event queued for sync
    toast.info("Pedido guardado. Se enviará cuando haya conexión.");
  } else {
    toast.error("Error al enviar pedido");
    logger.error("Submit to kitchen failed", { orderId, error });
  }
}
```

### Validation Errors

```typescript
// Validate before emitting events
function validateRequestCheck(order: Order): ValidationResult {
  if (order.items.length === 0) {
    return { valid: false, error: "No se puede pedir cuenta sin items" };
  }
  if (order.status === "PAID") {
    return { valid: false, error: "La cuenta ya fue pagada" };
  }
  return { valid: true };
}
```

### Authorization Errors

```typescript
// Supervisor PIN validation for sensitive operations
async function requireSupervisorAuth(action: string): Promise<boolean> {
  const pin = await showPinModal("Ingrese PIN de supervisor");
  const isValid = await validateSupervisorPin(pin);
  if (!isValid) {
    toast.error("PIN inválido");
    logger.warn("Supervisor auth failed", { action });
  }
  return isValid;
}
```

## Testing Strategy

### Unit Tests

Unit tests verify specific examples and edge cases:

1. **Terminal Config Tests**
   - Config retrieval from localStorage
   - Redirect when config missing
   - Config validation

2. **Table Status Tests**
   - Status calculation from events
   - Floor filtering
   - Elapsed time calculation

3. **Order Action Tests**
   - Item addition/removal
   - Quantity changes
   - Event emission

4. **Notification Tests**
   - Notification creation
   - Grouping logic
   - Mark as read

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs. Each test should run minimum 100 iterations.

**Testing Framework:** fast-check (already used in project)

**Test File Location:** `src/app/mozo/__tests__/*.property.test.ts`

**Tag Format:** `Feature: waiter-module, Property N: [property_text]`

Example:
```typescript
// Feature: waiter-module, Property 8: Quantity Increment/Decrement
// Validates: Requirements 4.1, 4.2
test.prop([fc.integer({ min: 1, max: 99 })])("quantity increment adds 1", (qty) => {
  const item = createItem({ qty });
  const result = incrementQuantity(item);
  expect(result.qty).toBe(qty + 1);
});
```

### Integration Tests

1. **End-to-end order flow**
   - Create order → Add items → Submit to kitchen → Mark ready → Request check

2. **Offline sync flow**
   - Go offline → Create order → Add items → Go online → Verify sync

3. **Multi-terminal flow**
   - Two waiters → Same table → Verify no conflicts

