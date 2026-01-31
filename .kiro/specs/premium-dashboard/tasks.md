# Implementation Plan: Premium Dashboard & Push Notifications

## Overview

Este plan implementa el dashboard de analytics en tiempo real y las notificaciones push para mozos. Se divide en dos tracks paralelos que convergen en la integración final.

**Estimación total:** 5-7 días de desarrollo

---

## Tasks

- [x] 1. Database Schema & Infrastructure
  - [x] 1.1 Add Prisma models for push_subscriptions, notification_preferences, analytics_cache
    - Update `prisma/schema.prisma` with new models
    - Add relations to employees table
    - _Requirements: 4.2, 4.3, 7.1_
  
  - [x] 1.2 Create and run database migration
    - Run `npx prisma db push` to sync schema
    - Verify tables created correctly
    - _Requirements: 4.2, 4.3_
  
  - [x] 1.3 Add VAPID environment variables
    - Generate VAPID keys with `npx web-push generate-vapid-keys`
    - Add to `.env` and `.env.example`
    - _Requirements: 4.1, 5.1_

- [x] 2. Analytics Service Core
  - [x] 2.1 Create Analytics Service types and interfaces
    - Create `src/core/analytics/types.ts`
    - Define RealtimeMetrics, StationMetrics, ComparisonMetrics, TopProduct
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 3.1_
  
  - [x] 2.2 Implement AnalyticsService.getRealtimeMetrics()
    - Create `src/core/analytics/analytics.service.ts`
    - Query orders, calculate totals, averages, payment breakdown
    - Include table occupancy from orders with table_id
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  
  - [x] 2.3 Write property test for metrics calculation
    - **Property 1: Metrics Calculation Correctness**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.7**
  
  - [x] 2.4 Implement AnalyticsService.getStationMetrics()
    - Query order items by station
    - Calculate pending counts, avg prep time, oldest item
    - Set has_alert flag when pending > 10
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 2.5 Write property test for station metrics
    - **Property 5: Station Metrics Correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 2.6 Implement AnalyticsService.getTopProducts()
    - Aggregate order items by product
    - Sort by qty_sold desc, revenue_cents desc
    - Return top N products
    - _Requirements: 2.4_
  
  - [x] 2.7 Write property test for top products ranking
    - **Property 4: Top Products Ranking**
    - **Validates: Requirements 2.4**
  
  - [x] 2.8 Implement AnalyticsService.getComparison()
    - Get metrics for current date and date-7
    - Calculate delta percentages
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.9 Write property test for comparison calculation
    - **Property 3: Comparison Calculation Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3. Analytics API Endpoints
  - [x] 3.1 Create GET /api/admin/analytics/realtime
    - Create `src/app/api/admin/analytics/realtime/route.ts`
    - Require ADMIN or OWNER role
    - Return RealtimeMetrics JSON
    - Target response time < 200ms
    - _Requirements: 10.1, 10.3, 10.4, 10.5_
  
  - [x] 3.2 Create GET /api/admin/analytics/history
    - Create `src/app/api/admin/analytics/history/route.ts`
    - Accept from/to query params
    - Validate date range
    - _Requirements: 10.2_
  
  - [x] 3.3 Write property test for date filtering
    - **Property 2: Date Filtering Correctness**
    - **Validates: Requirements 1.6, 10.2**
  
  - [x] 3.4 Create GET /api/admin/analytics/comparison
    - Create `src/app/api/admin/analytics/comparison/route.ts`
    - Return ComparisonMetrics
    - _Requirements: 2.1_
  
  - [x] 3.5 Create GET /api/admin/analytics/top-products
    - Create `src/app/api/admin/analytics/top-products/route.ts`
    - Accept limit query param (default 5)
    - _Requirements: 2.4_
  
  - [x] 3.6 Write property test for API authorization
    - **Property 12: API Authorization**
    - **Validates: Requirements 10.3**

- [x] 4. Checkpoint - Analytics Backend Complete
  - Ensure all analytics tests pass
  - Verify API responses match schema
  - Ask user if questions arise

- [x] 5. Notification Service Core
  - [x] 5.1 Create Notification Service types
    - Create `src/core/notifications/types.ts`
    - Define PushSubscription, NotificationPreferences, NotificationPayload
    - _Requirements: 4.2, 5.2, 9.1_
  
  - [x] 5.2 Implement NotificationService.subscribe()
    - Create `src/core/notifications/notification.service.ts`
    - Store subscription with employee_id
    - Allow multiple subscriptions per employee
    - _Requirements: 4.2, 4.3, 4.5_
  
  - [x] 5.3 Implement NotificationService.unsubscribe()
    - Remove subscription by endpoint
    - _Requirements: 4.2_
  
  - [x] 5.4 Write property test for subscription storage
    - **Property 6: Subscription Storage Integrity**
    - **Validates: Requirements 4.2, 4.3, 4.5**
  
  - [x] 5.5 Implement NotificationService.getPreferences() and updatePreferences()
    - CRUD for notification preferences
    - Default all preferences to true
    - _Requirements: 9.1, 9.2_
  
  - [x] 5.6 Implement NotificationService.sendToEmployee()
    - Get subscriptions for employee
    - Check preferences before sending
    - Use web-push library to send
    - Handle expired subscriptions gracefully
    - _Requirements: 5.1, 5.5, 9.1_
  
  - [x] 5.7 Write property test for preference respect
    - **Property 11: Preference Respect**
    - **Validates: Requirements 9.1, 9.2**
  
  - [x] 5.8 Write property test for graceful failure
    - **Property 10: Graceful Failure on Missing Subscription**
    - **Validates: Requirements 5.5**
  
  - [x] 5.9 Implement NotificationService.sendToRole()
    - Get all employees with role
    - Send to each with subscription
    - _Requirements: 6.1_

- [x] 6. Notification Event Handlers
  - [x] 6.1 Create handleItemReady event handler
    - Create `src/core/notifications/event-handlers.ts`
    - Listen for ORDER_ITEM_STATUS_CHANGED with to='READY'
    - Get waiter_id from order
    - Build notification payload with table, item, station
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.2 Write property test for notification routing
    - **Property 7: Notification Routing Correctness**
    - **Validates: Requirements 5.1, 6.1**
  
  - [x] 6.3 Write property test for notification payload
    - **Property 8: Notification Payload Completeness**
    - **Validates: Requirements 5.2, 5.4, 6.2, 6.3**
  
  - [x] 6.4 Create handleRequestCheck event handler
    - Listen for REQUEST_CHECK events
    - Get all CASHIER employees
    - Build notification with table, total, waiter name
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 6.5 Implement notification grouping
    - Buffer ITEM_READY notifications for 5 seconds
    - Group by order_id
    - Send single notification with all items
    - _Requirements: 5.3_
  
  - [x] 6.6 Write property test for notification grouping
    - **Property 9: Notification Grouping**
    - **Validates: Requirements 5.3**

- [x] 7. Notification API Endpoints
  - [x] 7.1 Create POST /api/notifications/subscribe
    - Create `src/app/api/notifications/subscribe/route.ts`
    - Validate subscription JSON
    - Store with current employee_id from session
    - _Requirements: 4.2_
  
  - [x] 7.2 Create DELETE /api/notifications/subscribe
    - Remove subscription by endpoint
    - _Requirements: 4.2_
  
  - [x] 7.3 Create GET/PATCH /api/notifications/preferences
    - Create `src/app/api/notifications/preferences/route.ts`
    - Get and update preferences
    - _Requirements: 9.1, 9.2_
  
  - [x] 7.4 Create POST /api/notifications/test
    - Send test notification to current user or specified employee
    - Require ADMIN for sending to others
    - _Requirements: 7.3_
  
  - [x] 7.5 Create GET /api/admin/notifications/status
    - Create `src/app/api/admin/notifications/status/route.ts`
    - Return subscription status for all employees
    - Include days_inactive calculation
    - _Requirements: 7.1, 7.2_

- [x] 8. Checkpoint - Notification Backend Complete
  - Ensure all notification tests pass
  - Verify push sending works with test endpoint
  - Ask user if questions arise

- [x] 9. Service Worker Push Integration
  - [x] 9.1 Add push event handler to Service Worker
    - Update `public/sw.js` with push event listener
    - Parse notification payload
    - Show notification with correct options
    - _Requirements: 8.1_
  
  - [x] 9.2 Add notificationclick handler
    - Handle click to open correct URL
    - Focus existing window or open new
    - _Requirements: 8.2, 5.4, 6.3_
  
  - [x] 9.3 Add notification actions
    - Add 'view' and 'dismiss' actions
    - Handle action clicks
    - _Requirements: 5.4, 6.3_

- [x] 10. Dashboard UI
  - [x] 10.1 Create Dashboard page layout
    - Create `src/app/admin/dashboard/page.tsx`
    - Grid layout for KPI cards, charts, tables
    - _Requirements: 1.1_
  
  - [x] 10.2 Create KPI cards component
    - Create `src/app/admin/dashboard/components/KPICard.tsx`
    - Show value, comparison delta, trend indicator
    - Color coding (green positive, red negative)
    - _Requirements: 1.3, 2.2_
  
  - [x] 10.3 Create sales metrics section
    - Total sales, orders count, avg ticket
    - Sales by payment method breakdown
    - _Requirements: 1.3_
  
  - [x] 10.4 Create table metrics section
    - Occupied/free tables
    - Table turnover
    - _Requirements: 1.4_
  
  - [x] 10.5 Create station metrics section
    - Cards per station (COCINA, HORNO, BAR)
    - Pending items, avg prep time
    - Alert styling when > 10 pending
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 10.6 Create top products table
    - Top 5 products with qty and revenue
    - _Requirements: 2.4_
  
  - [x] 10.7 Create hourly sales chart
    - Bar chart of sales by hour
    - Use recharts or similar
    - _Requirements: 1.7_
  
  - [x] 10.8 Add date range filter
    - Date picker for historical view
    - _Requirements: 1.6_
  
  - [x] 10.9 Add auto-refresh with SSE
    - Connect to SSE stream for real-time updates
    - Update metrics without full page reload
    - _Requirements: 1.2_

- [x] 11. Mozo Push Subscription UI
  - [x] 11.1 Create push subscription hook
    - Create `src/app/mozo/hooks/usePushSubscription.ts`
    - Check notification permission
    - Subscribe/unsubscribe functions
    - _Requirements: 4.1, 4.2_
  
  - [x] 11.2 Add subscription prompt to Mozo layout
    - Show prompt on first visit if not subscribed
    - Request notification permission
    - _Requirements: 4.1_
  
  - [x] 11.3 Create notification preferences UI
    - Create `src/app/mozo/configuracion/page.tsx`
    - Toggle switches for items_ready, request_check, sound
    - _Requirements: 9.1, 9.2_
  
  - [x] 11.4 Add rejection banner
    - Show banner if permission denied
    - Link to browser settings
    - _Requirements: 4.4_

- [x] 12. Admin Notification Management UI
  - [x] 12.1 Create notification status page
    - Create `src/app/admin/notificaciones/page.tsx`
    - Table of employees with subscription status
    - Warning for inactive > 7 days
    - _Requirements: 7.1, 7.2_
  
  - [x] 12.2 Add test notification button
    - Send test to selected employee
    - _Requirements: 7.3_

- [x] 13. Integration & Event Wiring
  - [x] 13.1 Register event handlers in Event Bus
    - Wire handleItemReady to ORDER_ITEM_STATUS_CHANGED
    - Wire handleRequestCheck to REQUEST_CHECK
    - _Requirements: 5.1, 6.1_
  
  - [x] 13.2 Add analytics cache invalidation
    - Invalidate on CHECK_MARKED_PAID
    - Invalidate on ORDER_ITEM_STATUS_CHANGED
    - _Requirements: 1.2_

- [x] 14. Final Checkpoint
  - Run all tests (unit + property)
  - Manual E2E test of notification flow
  - Manual E2E test of dashboard
  - Ensure all tests pass, ask user if questions arise

---

## Notes

- All property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The `web-push` npm package is required for sending push notifications
- Minimum 100 iterations per property test
