# Design Document: Delivery Module

## Overview

El módulo de Delivery extiende PARK POS para soportar pedidos a domicilio con flota propia de motorizados. Aprovecha las tablas existentes (`delivery_orders`, `drivers`, `delivery_zones`, `delivery_addresses`) y agrega servicios, APIs y UIs para gestión completa del flujo de delivery.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  /admin/delivery │  /delivery      │  POS (order_type=DELIVERY)  │
│  (Dispatch Panel)│  (Driver App)   │  (Crear pedido delivery)    │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer                                   │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ /api/delivery/* │ /api/drivers/*  │ /api/admin/delivery/*       │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Service Layer                                 │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ DeliveryService │ DriverService   │ DeliveryMetricsService      │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database (Prisma)                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ delivery_orders │ drivers         │ delivery_zones              │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Components and Interfaces

### DeliveryService

```typescript
// src/core/delivery/delivery.service.ts

interface CreateDeliveryInput {
  orderId: string;
  addressText: string;
  addressReference?: string;
  customerPhone: string;
  deliveryFee: number; // centavos
  estimatedDeliveryAt?: Date;
}

interface DeliveryService {
  // Crear delivery order cuando se crea pedido tipo DELIVERY
  createDeliveryOrder(input: CreateDeliveryInput): Promise<DeliveryOrder>;
  
  // Asignar motorizado
  assignDriver(deliveryId: string, driverId: string): Promise<DeliveryOrder>;
  
  // Marcar como despachado (motorizado salió)
  markDispatched(deliveryId: string): Promise<DeliveryOrder>;
  
  // Marcar como entregado
  markDelivered(deliveryId: string, signatureUrl?: string): Promise<DeliveryOrder>;
  
  // Marcar como fallido
  markFailed(deliveryId: string, reason: string): Promise<DeliveryOrder>;
  
  // Obtener deliveries por estado
  getByStatus(tenantId: string, status: DeliveryStatus[]): Promise<DeliveryOrder[]>;
  
  // Obtener deliveries de un driver
  getDriverDeliveries(driverId: string): Promise<DeliveryOrder[]>;
  
  // Calcular fee basado en zona
  calculateDeliveryFee(tenantId: string, lat: number, lng: number): Promise<{
    zoneId: string | null;
    fee: number;
    estimatedMins: number;
  }>;
}
```

### DriverService

```typescript
// src/core/delivery/driver.service.ts

interface DriverService {
  // CRUD de drivers
  create(tenantId: string, name: string, phone: string): Promise<Driver>;
  update(driverId: string, data: Partial<Driver>): Promise<Driver>;
  deactivate(driverId: string): Promise<Driver>;
  
  // Obtener drivers disponibles
  getAvailable(tenantId: string): Promise<Driver[]>;
  
  // Obtener estado actual del driver
  getDriverStatus(driverId: string): Promise<{
    driver: Driver;
    currentDelivery: DeliveryOrder | null;
    status: 'available' | 'on_delivery' | 'inactive';
  }>;
  
  // Listar todos los drivers con su estado
  listWithStatus(tenantId: string): Promise<DriverWithStatus[]>;
}
```

### DeliveryMetricsService

```typescript
// src/core/delivery/metrics.service.ts

interface DeliveryMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTimeMins: number;
  successRate: number; // 0-100
}

interface DriverMetrics {
  driverId: string;
  driverName: string;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  avgTimeMins: number;
  successRate: number;
}

interface DeliveryMetricsService {
  getTodayMetrics(tenantId: string): Promise<DeliveryMetrics>;
  getDriverMetrics(tenantId: string, dateFrom: string, dateTo: string): Promise<DriverMetrics[]>;
}
```

## Data Models

### Existing Tables (No Changes Needed)

```prisma
// Ya existe en schema.prisma
model delivery_orders {
  id                    String    @id @db.Uuid
  tenant_id             String    @db.Uuid
  order_id              String    @db.Uuid
  driver_id             String?   @db.Uuid
  address_id            String?   @db.Uuid
  address_text          String
  address_reference     String?
  customer_phone        String
  delivery_fee          Int       @default(0)
  estimated_delivery_at DateTime? @db.Timestamptz(6)
  assigned_at           DateTime? @db.Timestamptz(6)
  dispatched_at         DateTime? @db.Timestamptz(6)
  delivered_at          DateTime? @db.Timestamptz(6)
  failed_at             DateTime? @db.Timestamptz(6)
  failure_reason        String?
  delivery_time_mins    Int?
  signature_url         String?
  status                String    @default("PENDING")
  created_at            DateTime  @default(now()) @db.Timestamptz(6)
}

model drivers {
  id        String  @id @db.Uuid
  tenant_id String  @db.Uuid
  name      String
  phone     String?
  is_active Boolean @default(true)
}

model delivery_zones {
  id             String   @id @db.Uuid
  tenant_id      String   @db.Uuid
  location_id    String   @db.Uuid
  name           String
  type           String   @default("RADIUS")
  center_lat     Decimal? @db.Decimal(10, 7)
  center_lng     Decimal? @db.Decimal(10, 7)
  radius_km      Decimal? @db.Decimal(5, 2)
  polygon        Json?
  delivery_fee   Int      @default(0)
  min_order      Int      @default(0)
  estimated_mins Int      @default(30)
  is_active      Boolean  @default(true)
}
```

### Delivery Status Flow

```
PENDING → ASSIGNED → DISPATCHED → DELIVERED
                  ↘            ↘
                   FAILED ←────┘
```

## API Endpoints

### Delivery APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/delivery` | Crear delivery order |
| GET | `/api/delivery/[id]` | Obtener delivery por ID |
| PATCH | `/api/delivery/[id]/assign` | Asignar driver |
| PATCH | `/api/delivery/[id]/dispatch` | Marcar como despachado |
| PATCH | `/api/delivery/[id]/deliver` | Marcar como entregado |
| PATCH | `/api/delivery/[id]/fail` | Marcar como fallido |
| GET | `/api/delivery/pending` | Listar deliveries pendientes |
| GET | `/api/delivery/driver/[driverId]` | Deliveries de un driver |

### Driver APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drivers` | Listar drivers |
| POST | `/api/drivers` | Crear driver |
| PATCH | `/api/drivers/[id]` | Actualizar driver |
| GET | `/api/drivers/available` | Drivers disponibles |
| GET | `/api/drivers/[id]/status` | Estado actual del driver |

### Admin APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/delivery/metrics` | Métricas de hoy |
| GET | `/api/admin/delivery/history` | Historial con filtros |
| GET | `/api/admin/delivery/driver-metrics` | Métricas por driver |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Delivery Status Transitions

*For any* delivery order, status transitions SHALL only follow the valid state machine: PENDING → ASSIGNED → DISPATCHED → DELIVERED/FAILED. No other transitions are allowed.

**Validates: Requirements 1.3, 4.3, 4.4, 4.6**

### Property 2: Driver Assignment Exclusivity

*For any* driver marked as "on_delivery", they SHALL have exactly one active delivery (status IN [ASSIGNED, DISPATCHED]). A driver cannot be assigned multiple concurrent deliveries.

**Validates: Requirements 3.2, 3.3**

### Property 3: Timestamp Consistency

*For any* completed delivery, the timestamps SHALL be in chronological order: created_at < assigned_at < dispatched_at < delivered_at. Each timestamp is set only when transitioning to that state.

**Validates: Requirements 2.3, 4.3, 4.4**

### Property 4: Delivery Fee Calculation

*For any* delivery address within a configured zone, the calculated delivery_fee SHALL match the zone's configured fee. Addresses outside all zones SHALL return the default fee.

**Validates: Requirements 1.2, 1.4**

### Property 5: Delivery Time Calculation

*For any* delivered order, delivery_time_mins SHALL equal the difference in minutes between dispatched_at and delivered_at. This is calculated automatically on delivery completion.

**Validates: Requirements 6.2**

### Property 6: Driver Availability

*For any* driver query for "available" drivers, the result SHALL exclude drivers who are inactive OR have an active delivery (status IN [ASSIGNED, DISPATCHED]).

**Validates: Requirements 3.1, 3.5**

### Property 7: Metrics Accuracy

*For any* metrics calculation, success_rate SHALL equal (completed_deliveries / total_deliveries) * 100, and avg_delivery_time SHALL be the mean of all delivery_time_mins for completed deliveries.

**Validates: Requirements 6.1, 6.3**

### Property 8: Notification Delivery

*For any* driver assignment event, a push notification SHALL be sent to the assigned driver's subscribed devices within 5 seconds of assignment.

**Validates: Requirements 5.1**

## Error Handling

### Delivery Errors

| Error | Code | Handling |
|-------|------|----------|
| Driver not available | DRIVER_UNAVAILABLE | Return 400, show available drivers |
| Invalid status transition | INVALID_TRANSITION | Return 400, show current status |
| Delivery not found | NOT_FOUND | Return 404 |
| Driver not found | DRIVER_NOT_FOUND | Return 404 |
| Address outside zones | OUTSIDE_ZONES | Return 200 with warning, allow manual fee |

### Validation Rules

- `address_text` required, min 10 characters
- `customer_phone` required, valid phone format
- `delivery_fee` must be >= 0 (centavos)
- `failure_reason` required when marking as FAILED

## Testing Strategy

### Unit Tests

- DeliveryService: status transitions, fee calculation
- DriverService: availability logic, status tracking
- MetricsService: calculation accuracy

### Property-Based Tests

1. **Status Transition Property**: Generate random sequences of status changes, verify only valid transitions succeed
2. **Driver Exclusivity Property**: Generate concurrent assignment attempts, verify only one succeeds
3. **Timestamp Order Property**: Generate deliveries with various completion paths, verify timestamp ordering
4. **Fee Calculation Property**: Generate random coordinates, verify fee matches zone or default
5. **Metrics Calculation Property**: Generate random delivery data, verify metrics formulas

### Integration Tests

- Full delivery flow: create → assign → dispatch → deliver
- Driver availability updates on assignment/completion
- Push notification delivery on assignment

## UI Components

### Dispatch Panel (`/admin/delivery`)

```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Panel de Despacho                    [Métricas del Día]  │
├─────────────────────────────────────────────────────────────┤
│ PENDIENTES (3)        │ EN CAMINO (2)      │ COMPLETADOS    │
├───────────────────────┼────────────────────┼────────────────┤
│ #1234 - Juan Pérez    │ #1230 - María L.   │ Ver historial  │
│ Av. Lima 123          │ 🛵 Carlos (15 min) │                │
│ ⏱️ 8 min esperando    │                    │                │
│ [Asignar Driver ▼]    │                    │                │
├───────────────────────┼────────────────────┤                │
│ #1235 - Ana García    │ #1231 - Pedro R.   │                │
│ Jr. Cusco 456         │ 🛵 Luis (22 min)   │                │
│ ⏱️ 3 min esperando    │ ⚠️ DEMORADO        │                │
│ [Asignar Driver ▼]    │                    │                │
└───────────────────────┴────────────────────┴────────────────┘
```

### Driver App (`/delivery`)

```
┌─────────────────────────────────────────┐
│ 🛵 Mis Entregas              [Carlos]   │
├─────────────────────────────────────────┤
│ ENTREGA ACTIVA                          │
│ ┌─────────────────────────────────────┐ │
│ │ Pedido #1230                        │ │
│ │ María López - 987654321             │ │
│ │ 📍 Av. Arequipa 1234, Miraflores   │ │
│ │ Ref: Frente al parque               │ │
│ │ [📱 Llamar] [🗺️ Navegar]           │ │
│ │                                     │ │
│ │ 1x Pollo a la Brasa                 │ │
│ │ 2x Inca Kola 1L                     │ │
│ │ Total: S/ 65.00                     │ │
│ │                                     │ │
│ │ [✅ ENTREGADO] [❌ NO ENTREGADO]    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ PRÓXIMAS ENTREGAS                       │
│ (vacío)                                 │
└─────────────────────────────────────────┘
```
