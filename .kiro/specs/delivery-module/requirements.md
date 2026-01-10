# Requirements Document

## Introduction

Módulo de Delivery para PARK POS que permite gestionar pedidos de delivery con flota propia de motorizados. El sistema permite crear pedidos para delivery, asignar motorizados, trackear el estado de las entregas y registrar la finalización con foto opcional.

## Glossary

- **Delivery_Order**: Pedido marcado para entrega a domicilio
- **Driver**: Motorizado/repartidor de la flota propia
- **Dispatch_Panel**: Panel de administración para asignar y monitorear entregas
- **Driver_App**: Interfaz móvil para el motorizado
- **Delivery_Status**: Estado del pedido (PENDING, ASSIGNED, DISPATCHED, DELIVERED, FAILED)

## Requirements

### Requirement 1: Crear Pedido para Delivery

**User Story:** As a cajero, I want to create delivery orders with customer address, so that I can process orders for home delivery.

#### Acceptance Criteria

1. WHEN a cashier selects order type DELIVERY, THE System SHALL require customer phone and delivery address
2. WHEN a delivery address is entered, THE System SHALL calculate delivery fee based on zone configuration
3. WHEN a delivery order is created, THE System SHALL create a corresponding delivery_order record with status PENDING
4. IF the delivery address is outside configured zones, THEN THE System SHALL show a warning and allow manual fee override
5. WHEN a delivery order is saved, THE System SHALL display estimated delivery time based on zone configuration

### Requirement 2: Panel de Despacho

**User Story:** As a admin/cajero, I want to see all pending deliveries and assign drivers, so that I can manage the delivery queue efficiently.

#### Acceptance Criteria

1. WHEN the dispatch panel loads, THE System SHALL display all delivery orders grouped by status (PENDING, ASSIGNED, DISPATCHED)
2. WHEN a delivery order is PENDING, THE System SHALL show an "Assign Driver" button with available drivers list
3. WHEN a driver is assigned, THE System SHALL update delivery_order status to ASSIGNED and record assigned_at timestamp
4. WHEN viewing the dispatch panel, THE System SHALL show elapsed time since order creation for each pending delivery
5. WHEN a delivery is taking longer than estimated_mins + 15, THE System SHALL highlight it as delayed

### Requirement 3: Gestión de Motorizados

**User Story:** As a admin, I want to manage my driver fleet, so that I can assign deliveries to available drivers.

#### Acceptance Criteria

1. WHEN viewing drivers list, THE System SHALL show all drivers with their current status (available, on_delivery, inactive)
2. WHEN a driver has an active delivery, THE System SHALL mark them as "on_delivery" and show the order number
3. WHEN a driver completes a delivery, THE System SHALL automatically mark them as "available"
4. WHEN creating a new driver, THE System SHALL require name and phone number
5. WHEN deactivating a driver, THE System SHALL prevent assignment of new deliveries to that driver

### Requirement 4: App del Motorizado

**User Story:** As a driver, I want to see my assigned deliveries and update their status, so that I can complete deliveries efficiently.

#### Acceptance Criteria

1. WHEN a driver logs in, THE System SHALL show their assigned deliveries ordered by assignment time
2. WHEN viewing a delivery, THE System SHALL show customer name, phone, address, order details, and navigation link
3. WHEN a driver marks "En Camino", THE System SHALL update status to DISPATCHED and record dispatched_at timestamp
4. WHEN a driver marks "Entregado", THE System SHALL update status to DELIVERED and record delivered_at timestamp
5. WHEN marking as delivered, THE System SHALL optionally allow photo upload as proof of delivery
6. IF a delivery cannot be completed, THEN THE System SHALL allow marking as FAILED with a reason

### Requirement 5: Notificaciones de Delivery

**User Story:** As a driver, I want to receive notifications when assigned a new delivery, so that I can respond quickly.

#### Acceptance Criteria

1. WHEN a delivery is assigned to a driver, THE System SHALL send a push notification to the driver
2. WHEN a delivery is marked DISPATCHED, THE System SHALL notify the dispatch panel in real-time
3. WHEN a delivery is marked DELIVERED or FAILED, THE System SHALL notify the dispatch panel and update metrics

### Requirement 6: Métricas de Delivery

**User Story:** As a admin, I want to see delivery performance metrics, so that I can optimize operations.

#### Acceptance Criteria

1. WHEN viewing the dashboard, THE System SHALL show today's delivery count, average delivery time, and success rate
2. WHEN a delivery is completed, THE System SHALL calculate and store delivery_time_mins
3. WHEN viewing driver performance, THE System SHALL show deliveries completed, average time, and failure rate per driver

### Requirement 7: Integración con Cocina

**User Story:** As a KDS operator, I want to see delivery orders clearly marked, so that I can prioritize preparation.

#### Acceptance Criteria

1. WHEN a delivery order is sent to kitchen, THE System SHALL display "🛵 DELIVERY" badge on the ticket
2. WHEN a delivery order is ready, THE System SHALL notify the dispatch panel that order is ready for pickup
3. WHEN all items are READY, THE System SHALL allow the driver to mark as DISPATCHED

### Requirement 8: Historial de Entregas

**User Story:** As a admin, I want to view delivery history, so that I can review past deliveries and handle disputes.

#### Acceptance Criteria

1. WHEN viewing delivery history, THE System SHALL show all deliveries with filters by date, status, and driver
2. WHEN viewing a delivery detail, THE System SHALL show complete timeline (created, assigned, dispatched, delivered/failed)
3. WHEN a delivery has a photo, THE System SHALL display the proof of delivery image
