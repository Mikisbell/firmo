# Implementation Plan: Delivery Module

## Overview

Este plan implementa el módulo de Delivery para PARK POS con flota propia de motorizados. Las tablas de base de datos ya existen (`delivery_orders`, `drivers`, `delivery_zones`), por lo que nos enfocamos en servicios, APIs y UIs.

**Estimación total:** 5-7 días de desarrollo

---

## Tasks

- [-] 1. Core Services
  - [x] 1.1 Create DeliveryService with status transitions
    - Create `src/core/delivery/delivery.service.ts`
    - Implement createDeliveryOrder, assignDriver, markDispatched, markDelivered, markFailed
    - Validate status transitions (PENDING → ASSIGNED → DISPATCHED → DELIVERED/FAILED)
    - Calculate delivery_time_mins on completion
    - _Requirements: 1.3, 2.3, 4.3, 4.4, 4.6_
  
  - [ ]* 1.2 Write property test for status transitions
    - **Property 1: Status Transition Validity**
    - **Validates: Requirements 2.3, 4.3, 4.4, 4.6**
  
  - [x] 1.3 Create DriverService with availability logic
    - Create `src/core/delivery/driver.service.ts`
    - Implement create, update, deactivate, getAvailable, getDriverStatus, listWithStatus
    - Calculate driver status based on active deliveries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 1.4 Write property test for driver availability
    - **Property 2: Driver Availability Logic**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
  
  - [x] 1.5 Create zone fee calculation in DeliveryService
    - Implement calculateDeliveryFee(tenantId, lat, lng)
    - Check point-in-radius for RADIUS zones
    - Return default fee if outside all zones
    - _Requirements: 1.2, 1.4, 1.5_
  
  - [ ]* 1.6 Write property test for zone fee calculation
    - **Property 3: Zone Fee Calculation**
    - **Validates: Requirements 1.2, 1.5**

- [-] 2. Metrics Service
  - [x] 2.1 Create DeliveryMetricsService
    - Create `src/core/delivery/metrics.service.ts`
    - Implement getTodayMetrics: count, avgTime, successRate
    - Implement getDriverMetrics: per-driver stats
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 2.2 Write property test for metrics calculation
    - **Property 4: Metrics Accuracy**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  
  - [x] 2.3 Implement delay detection logic
    - Add isDelayed flag when elapsed > estimated_mins + 15
    - _Requirements: 2.5_
  
  - [ ]* 2.4 Write property test for delay detection
    - **Property 5: Delay Detection**
    - **Validates: Requirements 2.5**

- [ ] 3. Checkpoint - Services Complete
  - Ensure all service tests pass
  - Verify business logic is correct
  - Ask user if questions arise

- [x] 4. Delivery API Endpoints
  - [x] 4.1 Create POST /api/delivery
    - Create `src/app/api/delivery/route.ts`
    - Validate input (addressText, customerPhone, deliveryFee)
    - Call DeliveryService.createDeliveryOrder
    - _Requirements: 1.1, 1.3_
  
  - [x] 4.2 Create GET /api/delivery/pending
    - Return deliveries with status IN [PENDING, ASSIGNED, DISPATCHED]
    - Include order details and elapsed time
    - _Requirements: 2.1, 2.4_
  
  - [x] 4.3 Create PATCH /api/delivery/[id]/assign
    - Create `src/app/api/delivery/[id]/assign/route.ts`
    - Validate driver is available
    - Call DeliveryService.assignDriver
    - _Requirements: 2.2, 2.3_
  
  - [x] 4.4 Create PATCH /api/delivery/[id]/dispatch
    - Create `src/app/api/delivery/[id]/dispatch/route.ts`
    - Validate current status is ASSIGNED
    - Call DeliveryService.markDispatched
    - _Requirements: 4.3_
  
  - [x] 4.5 Create PATCH /api/delivery/[id]/deliver
    - Create `src/app/api/delivery/[id]/deliver/route.ts`
    - Accept optional signatureUrl (photo)
    - Call DeliveryService.markDelivered
    - _Requirements: 4.4, 4.5_
  
  - [x] 4.6 Create PATCH /api/delivery/[id]/fail
    - Create `src/app/api/delivery/[id]/fail/route.ts`
    - Require failure_reason
    - Call DeliveryService.markFailed
    - _Requirements: 4.6_
  
  - [x] 4.7 Create GET /api/delivery/driver/[driverId]
    - Return deliveries assigned to driver
    - Order by assigned_at
    - _Requirements: 4.1_

- [x] 5. Driver API Endpoints
  - [x] 5.1 Create GET /api/drivers
    - Create `src/app/api/drivers/route.ts`
    - Return all drivers with status
    - _Requirements: 3.1_
  
  - [x] 5.2 Create POST /api/drivers
    - Validate name and phone required
    - Call DriverService.create
    - _Requirements: 3.4_
  
  - [x] 5.3 Create PATCH /api/drivers/[id]
    - Create `src/app/api/drivers/[id]/route.ts`
    - Allow update name, phone, is_active
    - _Requirements: 3.5_
  
  - [x] 5.4 Create GET /api/drivers/available
    - Create `src/app/api/drivers/available/route.ts`
    - Return only available drivers
    - _Requirements: 2.2_

- [-] 6. Admin API Endpoints
  - [x] 6.1 Create GET /api/admin/delivery/metrics
    - Create `src/app/api/admin/delivery/metrics/route.ts`
    - Return today's metrics
    - _Requirements: 6.1_
  
  - [x] 6.2 Create GET /api/admin/delivery/history
    - Create `src/app/api/admin/delivery/history/route.ts`
    - Accept filters: dateFrom, dateTo, status, driverId
    - _Requirements: 8.1_
  
  - [ ]* 6.3 Write property test for history filtering
    - **Property 6: History Filtering**
    - **Validates: Requirements 8.1**
  
  - [x] 6.4 Create GET /api/admin/delivery/driver-metrics
    - Create `src/app/api/admin/delivery/driver-metrics/route.ts`
    - Return per-driver metrics
    - _Requirements: 6.3_

- [ ] 7. Checkpoint - APIs Complete
  - Ensure all API tests pass
  - Test with Postman/curl
  - Ask user if questions arise

- [x] 8. Notification Integration
  - [x] 8.1 Create delivery notification handlers
    - Create `src/core/delivery/notification-handlers.ts`
    - notifyDeliveryAssigned: log + future push to driver
    - notifyDeliveryReady: send push to cashiers
    - logDeliveryDelayed: log for monitoring
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 8.2 Write property test for notification triggering
    - **Property 7: Notification Triggering**
    - **Validates: Requirements 5.1**
  
  - [x] 8.3 Wire handlers to delivery service
    - Call notifyDeliveryAssigned from assignDriver
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Dispatch Panel UI
  - [x] 9.1 Create dispatch panel page
    - Create `src/app/admin/delivery/page.tsx`
    - Three columns: PENDING, EN CAMINO, COMPLETADOS
    - Show elapsed time, delay warnings
    - _Requirements: 2.1, 2.4, 2.5_
  
  - [x] 9.2 Create delivery card component
    - Create `src/app/admin/delivery/components/DeliveryCard.tsx`
    - Show order number, customer, address, elapsed time
    - Assign driver dropdown for PENDING
    - _Requirements: 2.2_
  
  - [x] 9.3 Create driver selector component
    - Create `src/app/admin/delivery/components/DriverSelector.tsx`
    - Fetch available drivers
    - Handle assignment
    - _Requirements: 2.2, 2.3_
  
  - [x] 9.4 Add real-time updates with polling
    - Refresh every 10 seconds
    - Update on assignment/status change
    - _Requirements: 5.2, 5.3_
  
  - [x] 9.5 Create metrics summary header
    - Show today's count, avg time, success rate
    - _Requirements: 6.1_

- [x] 10. Driver App UI
  - [x] 10.1 Create driver app page
    - Create `src/app/delivery/page.tsx`
    - Show active delivery prominently
    - List upcoming deliveries
    - _Requirements: 4.1_
  
  - [x] 10.2 Create delivery detail component
    - Create `src/app/delivery/components/DeliveryDetail.tsx`
    - Show customer info, address, order items
    - Navigation link (Google Maps)
    - Call button
    - _Requirements: 4.2_
  
  - [x] 10.3 Create action buttons
    - "En Camino" button → dispatch
    - "Entregado" button → deliver with optional photo
    - "No Entregado" button → fail with reason
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  
  - [x] 10.4 Create photo capture component
    - Create `src/app/delivery/components/PhotoCapture.tsx`
    - Use device camera
    - Integrated in delivery page
    - _Requirements: 4.5_
  
  - [x] 10.5 Create failure reason modal
    - Create `src/app/delivery/components/FailureModal.tsx`
    - Predefined reasons + custom text
    - _Requirements: 4.6_

- [x] 11. Driver Management UI
  - [x] 11.1 Create drivers admin page
    - Create `src/app/admin/drivers/page.tsx`
    - List all drivers with status
    - Add/edit/deactivate buttons
    - _Requirements: 3.1, 3.4, 3.5_
  
  - [x] 11.2 Create driver form modal
    - Create `src/app/admin/drivers/components/DriverForm.tsx`
    - Name and phone fields
    - _Requirements: 3.4_

- [x] 12. Delivery History UI
  - [x] 12.1 Create history page
    - Create `src/app/admin/delivery/historial/page.tsx`
    - Date range filter, status filter, driver filter
    - _Requirements: 8.1_
  
  - [x] 12.2 Create delivery timeline component
    - Create `src/app/admin/delivery/components/DeliveryTimeline.tsx`
    - Show all timestamps in order
    - Show photo if present
    - _Requirements: 8.2, 8.3_

- [x] 13. POS Integration
  - [x] 13.1 Create delivery integration helper
    - Create `src/core/delivery/pos-integration.ts`
    - createDeliveryFromOrder, isDeliveryOrder, getDeliveryForOrder
    - notifyDeliveryOrderReady, checkAllItemsReady
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 13.2 Add delivery badge to KDS
    - Already implemented in `src/app/cocina/page.tsx`
    - Shows 🛵 DELIVERY badge on kitchen tickets
    - _Requirements: 7.1_
  
  - [x] 13.3 Notify dispatch when order ready
    - notifyDeliveryOrderReady function created
    - Can be called from KDS when all items READY
    - _Requirements: 7.2, 7.3_

- [x] 14. Final Checkpoint
  - All core services implemented
  - All APIs implemented
  - All UIs implemented (Dispatch Panel, Driver App, Driver Management, History)
  - Notification handlers created
  - POS integration helpers created
  - KDS already shows delivery badge
  - Property tests marked as optional (*)

---

## Notes

- Database tables already exist: `delivery_orders`, `drivers`, `delivery_zones`, `delivery_addresses`
- No schema changes needed
- Property tests use fast-check with minimum 100 iterations
- All money values in centavos (int)
- Use existing push notification infrastructure from Premium Dashboard
- Driver app is mobile-optimized PWA
