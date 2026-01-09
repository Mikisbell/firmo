# Requirements Document

## Introduction

Este documento define los requisitos para mejorar el módulo de Mesero (Mozo) del sistema PARK POS. El diseño está inspirado en las mejores prácticas de sistemas líderes como Toast, Square for Restaurants, TouchBistro y Lightspeed, enfocándose en velocidad, fluidez y profesionalismo para maximizar la eficiencia del servicio y minimizar errores que cuestan dinero.

El módulo actual tiene limitaciones críticas: solo soporta 1 terminal hardcodeado, 9 mesas fijas, y carece de funcionalidades esenciales. El objetivo es escalar a 15 terminales de mesero, 50+ mesas configurables, y agregar funcionalidades de clase mundial.

## Glossary

- **Waiter_Module**: El módulo de la aplicación que permite a los meseros tomar pedidos, ver estado de mesas, y gestionar órdenes
- **Terminal_Config**: Configuración almacenada en localStorage que identifica el dispositivo y su rol
- **Table_Status**: Estado de una mesa (FREE, OCCUPIED, BILL_REQUESTED, PAID)
- **Zone**: Área del restaurante asignada a un mesero (A-H, Barra, Terraza)
- **Floor**: Piso o sección del restaurante (Salón, Terraza, VIP, Barra)
- **KDS**: Kitchen Display System - pantalla de cocina que muestra pedidos pendientes
- **Order_Item**: Línea de pedido con producto, cantidad, precio y estado
- **Item_Status**: Estado de un item (PENDING, SENT, COOKING, READY, SERVED, VOIDED)
- **Quick_Actions**: Acciones rápidas de un toque para operaciones frecuentes
- **Modifier**: Modificación a un producto (sin sal, extra queso, término de cocción)
- **Course**: Tiempo de servicio (entrada, plato fuerte, postre)
- **Fire_Time**: Momento en que cocina debe empezar a preparar un item

## Requirements

### Requirement 1: Configuración Dinámica de Terminal

**User Story:** Como mesero, quiero que mi tablet use su propia configuración de terminal, para que mis pedidos se identifiquen correctamente y no colisionen con otros meseros.

#### Acceptance Criteria

1. WHEN a waiter opens the Waiter_Module, THE System SHALL read the terminal_id from Terminal_Config stored in localStorage
2. WHEN Terminal_Config is not found, THE System SHALL redirect to the terminal setup page
3. WHEN creating an order, THE System SHALL use the terminal_id from Terminal_Config instead of hardcoded values
4. WHEN creating an order, THE System SHALL use the actor_id from Terminal_Config for audit purposes
5. THE System SHALL support up to 15 concurrent waiter terminals with unique identifiers (waiter_01 through waiter_15)
6. WHEN a waiter logs in, THE System SHALL display their name in the header for accountability

### Requirement 2: Mesas Configurables y Mapa Visual

**User Story:** Como mesero, quiero ver un mapa visual de las mesas con estados claros, para identificar rápidamente qué mesas necesitan atención.

#### Acceptance Criteria

1. THE System SHALL support a minimum of 50 tables distributed across multiple floors
2. WHEN displaying the table map, THE System SHALL show tables organized by Floor (Salón, Terraza, VIP, Barra)
3. THE System SHALL include a "Barra" floor with bar seats (B1-B10)
4. WHEN a table is occupied, THE System SHALL display with color coding: verde=libre, azul=ocupada, amarillo=cuenta solicitada, rojo=esperando >30min
5. WHEN a table has items ready, THE System SHALL display a badge with the count of ready items
6. THE System SHALL load table configuration from a configurable source instead of hardcoded arrays
7. WHEN switching floors, THE System SHALL animate the transition smoothly within 200ms

### Requirement 3: Toma de Pedido Rápida (Speed Entry)

**User Story:** Como mesero, quiero agregar items al pedido con el mínimo de toques posible, para atender más mesas en menos tiempo.

#### Acceptance Criteria

1. WHEN a waiter taps a product, THE System SHALL add it to the order with quantity 1 in a single tap
2. WHEN a waiter long-presses a product, THE System SHALL open a quick quantity selector (1-9)
3. THE System SHALL display recently ordered items as "Favoritos" at the top of the catalog
4. THE System SHALL support search by product name with results appearing as the waiter types
5. WHEN adding items, THE System SHALL provide haptic feedback (vibration) for confirmation
6. THE System SHALL allow voice notes per item for special instructions (optional)
7. WHEN the catalog loads, THE System SHALL display products within 300ms

### Requirement 4: Gestión de Items en Pedido

**User Story:** Como mesero, quiero poder modificar cantidades y eliminar items del pedido, para corregir errores antes de enviar a cocina.

#### Acceptance Criteria

1. WHEN a waiter taps the "+" button on an item, THE System SHALL increment the quantity by 1
2. WHEN a waiter taps the "-" button on an item with quantity > 1, THE System SHALL decrement the quantity by 1
3. WHEN a waiter taps the "-" button on an item with quantity = 1, THE System SHALL show confirmation before removing
4. WHEN a waiter swipes left on an item, THE System SHALL reveal a delete button (gesture-based deletion)
5. IF an item has status SENT or higher, THEN THE System SHALL require supervisor PIN before modification
6. WHEN an item is removed, THE System SHALL emit an ORDER_ITEM_VOIDED event with the reason
7. THE System SHALL allow editing item notes/modifiers after adding

### Requirement 5: Modificadores y Notas Especiales

**User Story:** Como mesero, quiero agregar modificadores a los items (sin sal, término medio, extra queso), para capturar las preferencias exactas del cliente.

#### Acceptance Criteria

1. WHEN a product has modifiers configured, THE System SHALL display modifier options after adding the item
2. THE System SHALL support modifier groups: required (must select one) and optional (can select multiple)
3. WHEN a modifier has extra cost, THE System SHALL display the price and add it to the item total
4. THE System SHALL allow free-text notes per item for special requests
5. WHEN displaying the order, THE System SHALL show modifiers indented below the parent item
6. WHEN sending to KDS, THE System SHALL include all modifiers and notes clearly visible

### Requirement 6: Solicitar Cuenta y Pre-Cuenta

**User Story:** Como mesero, quiero poder solicitar la cuenta y mostrar una pre-cuenta al cliente, para agilizar el proceso de pago.

#### Acceptance Criteria

1. WHEN a waiter taps "Pedir Cuenta" button, THE System SHALL emit a REQUEST_CHECK event
2. WHEN REQUEST_CHECK is emitted, THE System SHALL include order_id, table_number, total_cents, and waiter_id
3. WHEN REQUEST_CHECK is received by POS, THE System SHALL display a notification to the cashier with sound alert
4. WHEN the check is requested, THE System SHALL update the table status to BILL_REQUESTED (yellow color)
5. THE System SHALL allow the waiter to display a pre-check summary on their tablet to show the customer
6. THE System SHALL support generating a QR code for customer self-payment (future integration)
7. WHEN displaying pre-check, THE System SHALL show itemized list with subtotal, taxes, and total

### Requirement 7: Envío a Cocina por Estación

**User Story:** Como mesero, quiero que al enviar el pedido, los items se distribuyan automáticamente a la estación correcta, para que cada área reciba solo lo que debe preparar.

#### Acceptance Criteria

1. WHEN a waiter sends an order to kitchen, THE System SHALL emit ORDER_SUBMITTED event
2. WHEN ORDER_SUBMITTED is processed, THE System SHALL route items to their designated station based on product.station field
3. THE System SHALL support stations: GRILL (parrilla), BAR, OVEN (horno), COLD (frío), DESSERT (postres)
4. WHEN items are routed, THE System SHALL update item status from PENDING to SENT
5. WHEN all items are sent, THE System SHALL display confirmation toast with estimated preparation time
6. THE System SHALL prevent sending empty orders to kitchen
7. WHEN sending, THE System SHALL group items by course if configured (entrada, plato fuerte, postre)

### Requirement 8: Notificaciones de Items Listos

**User Story:** Como mesero, quiero recibir notificaciones cuando mis items están listos, para recogerlos de cocina sin demora.

#### Acceptance Criteria

1. WHEN an item status changes to READY in KDS, THE System SHALL emit ORDER_ITEM_STATUS_CHANGED event
2. WHEN ORDER_ITEM_STATUS_CHANGED is received, THE System SHALL display a push notification on the waiter's tablet
3. THE notification SHALL include table_number, item_name, quantity, and pickup_station
4. WHEN the waiter has items ready, THE System SHALL display a pulsing badge on the table card
5. WHEN the waiter taps the notification, THE System SHALL navigate to the order detail
6. THE System SHALL play a distinct sound for ready items (configurable)
7. WHEN multiple items are ready, THE System SHALL group them in a single notification per table

### Requirement 9: Timer de Mesa y Alertas de Servicio

**User Story:** Como mesero, quiero ver cuánto tiempo lleva ocupada cada mesa y recibir alertas, para priorizar la atención y evitar quejas.

#### Acceptance Criteria

1. WHEN a table becomes OCCUPIED, THE System SHALL start tracking elapsed time from ORDER_CREATED timestamp
2. WHEN displaying an occupied table, THE System SHALL show elapsed time in format "Xm" (minutes)
3. WHEN elapsed time exceeds 20 minutes without food served, THE System SHALL highlight the table with yellow border
4. WHEN elapsed time exceeds 40 minutes without food served, THE System SHALL highlight the table with red border and pulse animation
5. THE System SHALL update elapsed time display every 30 seconds
6. WHEN a table has been waiting too long, THE System SHALL send a notification to the waiter
7. THE System SHALL track time per course (time since last item served)

### Requirement 10: Navegación Fluida y Gestos

**User Story:** Como mesero, quiero una interfaz rápida con gestos intuitivos, para tomar pedidos eficientemente durante horas pico.

#### Acceptance Criteria

1. WHEN the waiter is on the table map, THE System SHALL allow quick floor switching with single tap or swipe
2. WHEN the waiter taps a table, THE System SHALL navigate to the order page within 300ms
3. THE System SHALL support swipe-back gesture to return to table map
4. THE System SHALL display online/offline status indicator in the header with sync progress
5. THE System SHALL provide a logout button that clears Terminal_Config and redirects to home
6. THE System SHALL provide a home button that navigates to the main menu without logging out
7. WHEN offline, THE System SHALL queue all actions and sync automatically when connection returns
8. THE System SHALL support pull-to-refresh on the table map to force sync

### Requirement 11: Resumen de Turno del Mesero

**User Story:** Como mesero, quiero ver un resumen de mi turno (mesas atendidas, ventas, propinas), para conocer mi rendimiento.

#### Acceptance Criteria

1. WHEN a waiter accesses "Mi Turno" section, THE System SHALL display summary statistics
2. THE summary SHALL include: tables served count, total sales amount, tips received, average ticket
3. THE System SHALL show a list of tables attended during the current shift
4. WHEN the shift ends, THE System SHALL allow the waiter to close their session and see final summary
5. THE System SHALL track tips per table when payment includes gratuity

### Requirement 12: Modo Offline Robusto

**User Story:** Como mesero, quiero seguir tomando pedidos aunque se caiga el WiFi, para no perder ventas ni hacer esperar a los clientes.

#### Acceptance Criteria

1. WHEN the device loses connection, THE System SHALL display "OFFLINE" indicator prominently
2. WHILE offline, THE System SHALL allow creating orders, adding items, and sending to kitchen (queued)
3. WHEN connection is restored, THE System SHALL sync all pending events automatically
4. THE System SHALL prevent order number collisions using terminal-specific ranges
5. WHEN syncing, THE System SHALL show progress indicator and success/failure status
6. IF sync fails, THEN THE System SHALL retry with exponential backoff and notify the waiter

