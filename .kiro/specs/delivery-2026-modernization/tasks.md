# Implementation Plan: Delivery Module 2026 Modernization

## Overview

This implementation plan modernizes the existing Delivery Module to 2026 best practices by adding real-time capabilities (SSE), intelligent automation (smart assignment), enhanced UX (Shadcn/UI), and comprehensive analytics. The implementation is structured in phases to enable incremental delivery and testing.

## Tasks

- [x] 1. Setup Infrastructure and Core Types
  - Create Redis connection utility for location storage and SSE
  - Create Prisma schema extensions for new tables (location_history, push_subscriptions, whatsapp_messages, assignment_weights, assignment_logs, eta_predictions, delivery_metrics)
  - Run Prisma migration to create new tables
  - Create TypeScript types for all new domain models (Location, DeliveryEvent, AssignmentScore, ETAEstimate, PushNotification, MessageTemplate)
  - Create branded types for type safety (LocationId, DriverId, OrderId)
  - Setup Fast-check arbitraries for property-based testing
  - _Requirements: 1.1-1.8, 2.1-2.8, 3.1-3.8, 4.1-4.8, 5.1-5.8, 6.1-6.8, 7.1-7.8, 8.1-8.8_

- [ ] 2. Implement SSE Service
  - [~] 2.1 Create SSE connection manager
    - Implement `addClient()`, `removeClient()`, `getActiveClients()`
    - Store connections in Redis with TTL of 5 minutes
    - Implement heartbeat mechanism (30 second interval)
    - Handle connection cleanup on disconnect
    - _Requirements: 1.2, 1.5, 1.7_
  
  - [~] 2.2 Create SSE broadcasting system
    - Implement `broadcast()` for all clients
    - Implement `sendToClient()` for specific client
    - Use Redis Pub/Sub for multi-instance broadcasting
    - Include event IDs for deduplication
    - _Requirements: 1.1, 1.4, 1.8_
  
  - [~] 2.3 Create SSE API endpoint
    - Create `/api/deliveries/stream` route handler
    - Implement ReadableStream for SSE
    - Send initial state on connection
    - Support Last-Event-ID for reconnection
    - Implement event filtering by restaurant/driver
    - _Requirements: 1.2, 1.6_
  
  - [~] 2.4 Write property tests for SSE Service
    - **Property 1: SSE Broadcast Latency** - For any delivery event, all clients receive within 500ms
    - **Property 4: SSE Broadcast to All Clients** - For any event, all clients receive same data
    - **Property 5: SSE Resource Cleanup** - For any disconnect, resources are cleaned up
    - **Property 7: SSE Concurrent Connection Capacity** - For any N≤100 connections, all maintained
    - **Property 8: SSE Event ID Uniqueness** - For any event, ID is unique
    - **Validates: Requirements 1.1, 1.4, 1.5, 1.7, 1.8**
  
  - [~] 2.5 Write unit tests for SSE Service
    - Test connection lifecycle (connect, disconnect, reconnect)
    - Test heartbeat mechanism
    - Test event filtering by restaurant/driver
    - Test error handling (Redis failure, serialization errors)
    - _Requirements: 1.1-1.8_

- [ ] 3. Implement Geolocation Service
  - [~] 3.1 Create location storage and retrieval
    - Implement `updateDriverLocation()` with Redis storage
    - Set TTL of 5 minutes (300 seconds)
    - Implement `getDriverLocation()` and `getActiveDriverLocations()`
    - Validate coordinates (latitude: -90 to 90, longitude: -180 to 180)
    - _Requirements: 2.2, 2.8_
  
  - [~] 3.2 Create location history tracking
    - Implement async PostgreSQL insert for location_history
    - Batch inserts every 5 minutes to reduce DB load
    - Implement `getLocationHistory()` with date range filtering
    - _Requirements: 2.2_
  
  - [~] 3.3 Create geospatial query functions
    - Implement `findNearbyDrivers()` using PostGIS
    - Implement `calculateDistance()` using Haversine formula
    - Optimize queries with spatial indexes
    - _Requirements: 3.8_
  
  - [~] 3.4 Create connection monitoring
    - Implement background job to check for stale locations (>2 minutes)
    - Mark drivers as "connection lost" when stale
    - Clear location data on delivery completion
    - _Requirements: 2.6, 2.7_
  
  - [~] 3.5 Create location API endpoints
    - Create POST `/api/locations` for driver updates
    - Create GET `/api/locations/drivers` for admin panel
    - Create GET `/api/locations/history/:driverId` for history
    - _Requirements: 2.1, 2.3_
  
  - [~] 3.6 Write property tests for Geolocation Service
    - **Property 9: Location Storage with TTL** - For any location, stored with 300s TTL
    - **Property 10: Location Query Performance** - For any request, response within 100ms
    - **Property 11: Connection Lost Detection** - For any driver with >2min no updates, marked lost
    - **Property 12: Location Coordinate Validation** - For any invalid coordinates, rejected
    - **Validates: Requirements 2.2, 2.3, 2.6, 2.8**
  
  - [~] 3.7 Write unit tests for Geolocation Service
    - Test location update with valid/invalid coordinates
    - Test TTL expiration
    - Test batch insert logic
    - Test geospatial queries with PostGIS
    - Test error handling (Redis failure, DB failure)
    - _Requirements: 2.1-2.8_

- [~] 4. Checkpoint - Core Infrastructure Complete
  - Ensure all tests pass (SSE + Geolocation)
  - Verify Redis connection and Pub/Sub working
  - Verify PostgreSQL with PostGIS working
  - Test SSE endpoint with multiple clients
  - Test location updates and queries
  - Ask the user if questions arise

- [ ] 5. Implement Assignment Algorithm
  - [~] 5.1 Create assignment score calculation
    - Implement `calculateAssignmentScore()` with weighted factors
    - Calculate distance score (0-100, lower distance = higher score)
    - Calculate workload score (0-100, fewer orders = higher score)
    - Calculate performance score (0-100, based on rating)
    - Apply configurable weights (distance: 40%, workload: 30%, performance: 30%)
    - _Requirements: 3.1, 3.2_
  
  - [~] 5.2 Create driver selection logic
    - Implement `assignDriver()` to find best driver
    - Get available drivers (status = AVAILABLE, not at max capacity)
    - Get driver locations from Geolocation Service
    - Calculate scores for all drivers
    - Implement tie-breaking (within 5%, choose lower workload)
    - _Requirements: 3.1, 3.3_
  
  - [~] 5.3 Create assignment logging
    - Log all assignment decisions to assignment_logs table
    - Include scores, distances, and driver metrics
    - Enable analysis of assignment quality
    - _Requirements: 3.1_
  
  - [~] 5.4 Create assignment queueing
    - Queue orders in Redis when no drivers available
    - Implement background job to retry every 60 seconds
    - Alert admin after 10 failed attempts
    - _Requirements: 3.4_
  
  - [~] 5.5 Create rejection handling
    - Implement `handleRejection()` to reassign within 10 seconds
    - Select next best driver from scored list
    - Track rejection reasons for analysis
    - _Requirements: 3.5_
  
  - [~] 5.6 Create weight configuration
    - Store weights in assignment_weights table by tenant
    - Implement `getWeights()` and `updateWeights()`
    - Support A/B testing different configurations
    - _Requirements: 3.7_
  
  - [~] 5.7 Write property tests for Assignment Algorithm
    - **Property 13: Assignment Score Calculation** - For any order, scores calculated for all drivers
    - **Property 14: Assignment Score Weights** - For any driver/order, correct weights applied
    - **Property 15: Assignment Tie-Breaking** - For any drivers within 5%, lower workload selected
    - **Property 16: Assignment Queueing** - For any order with no drivers, queued and retried
    - **Property 17: Assignment Rejection Handling** - For any rejection, reassigned within 10s
    - **Property 19: Assignment Weight Configurability** - For any weight change, scores updated
    - **Property 20: Assignment Distance Calculation** - For any pair, straight-line then route distance
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8**
  
  - [~] 5.8 Write unit tests for Assignment Algorithm
    - Test score calculation with specific driver/order combinations
    - Test tie-breaking with similar scores
    - Test queueing with no available drivers
    - Test rejection handling
    - Test weight configuration updates
    - Test error handling (location service failure, DB failure)
    - _Requirements: 3.1-3.8_

- [ ] 6. Implement Push Service
  - [~] 6.1 Create subscription management
    - Implement `subscribe()` to store push subscriptions
    - Store in push_subscriptions table with driver_id
    - Implement `unsubscribe()` and `getSubscription()`
    - Remove invalid subscriptions (410 Gone response)
    - _Requirements: 4.2_
  
  - [~] 6.2 Create notification sending
    - Implement `sendNotification()` using web-push library
    - Include action buttons ("Accept", "Reject")
    - Set priority (urgent for assignments, normal for updates)
    - Handle send failures with retry logic
    - _Requirements: 4.3, 4.5, 4.8_
  
  - [~] 6.3 Create notification queueing
    - Queue notifications in Redis for offline drivers
    - Implement `queueNotification()` and `processQueue()`
    - Background worker processes queue every 10 seconds
    - Retry failed sends up to 3 times with exponential backoff (1s, 2s, 4s)
    - _Requirements: 4.4, 4.6_
  
  - [~] 6.4 Create push API endpoints
    - Create POST `/api/push/subscribe` for subscription
    - Create POST `/api/push/unsubscribe` for unsubscribe
    - Create POST `/api/push/send` for admin testing
    - _Requirements: 4.1, 4.2_
  
  - [~] 6.5 Write property tests for Push Service
    - **Property 21: Push Subscription Storage** - For any permission grant, subscription stored
    - **Property 22: Push Notification Queueing** - For any offline driver, notification queued
    - **Property 23: Push Notification Actions** - For any notification, includes Accept/Reject buttons
    - **Property 24: Push Notification Retry** - For any failure, retries 3x with exponential backoff
    - **Property 25: Push Notification Priorities** - For any notification, correct priority set
    - **Validates: Requirements 4.2, 4.4, 4.5, 4.6, 4.8**
  
  - [~] 6.6 Write unit tests for Push Service
    - Test subscription storage and retrieval
    - Test notification sending with mock web-push
    - Test queueing for offline drivers
    - Test retry logic with exponential backoff
    - Test invalid subscription removal
    - Test error handling (web-push failure, Redis failure)
    - _Requirements: 4.1-4.8_

- [ ] 7. Implement ETA Calculator
  - [~] 7.1 Create initial ETA calculation
    - Implement `calculateInitialETA()` with distance and speed
    - Calculate base time from total distance
    - Apply driver adjustment factor (0.8-1.2 based on history)
    - Apply traffic adjustment factor (1.0-2.0)
    - Apply weather adjustment factor (1.0-1.15)
    - Calculate confidence interval (±20% based on variance)
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.7_
  
  - [~] 7.2 Create ETA recalculation
    - Implement `recalculateETA()` on location updates
    - Use remaining distance instead of total distance
    - Trigger WhatsApp notification if change >5 minutes
    - Store ETA history in eta_predictions table
    - _Requirements: 5.2, 5.6_
  
  - [~] 7.3 Create ML model for ETA prediction
    - Implement simple linear regression model
    - Train on historical data (predicted vs actual times)
    - Store model coefficients in database
    - Retrain model weekly with new data
    - Fallback to rule-based calculation if model fails
    - _Requirements: 5.8_
  
  - [~] 7.4 Create actual time recording
    - Implement `recordActualDeliveryTime()` on completion
    - Store in eta_predictions table for learning
    - Calculate prediction error for model improvement
    - _Requirements: 5.8_
  
  - [~] 7.5 Write property tests for ETA Calculator
    - **Property 26: Initial ETA Calculation** - For any assignment, initial ETA calculated
    - **Property 27: ETA Recalculation on Location Update** - For any location update, ETA recalculated
    - **Property 28: ETA Factor Consideration** - For any calculation, all factors considered
    - **Property 29: ETA Change Notification** - For any change >5min, WhatsApp sent
    - **Property 30: ETA Confidence Intervals** - For any ETA, includes confidence interval
    - **Property 31: ETA Learning from Actual Times** - For any completion, affects future predictions
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**
  
  - [~] 7.6 Write unit tests for ETA Calculator
    - Test initial ETA with specific distances and conditions
    - Test recalculation with location updates
    - Test factor adjustments (driver, traffic, weather)
    - Test confidence interval calculation
    - Test ML model training and prediction
    - Test error handling (missing data, model failure)
    - _Requirements: 5.1-5.8_

- [~] 8. Checkpoint - Core Services Complete
  - Ensure all tests pass (Assignment + Push + ETA)
  - Test full flow: order creation → assignment → notification → ETA
  - Verify assignment algorithm selects correct driver
  - Verify push notifications sent to drivers
  - Verify ETA calculated and updated
  - Ask the user if questions arise

- [ ] 9. Implement WhatsApp Service
  - [~] 9.1 Create message template system
    - Define message templates (ORDER_ASSIGNED, ORDER_DISPATCHED, ETA_UPDATE, ORDER_DELIVERED, ORDER_FAILED)
    - Implement `getTemplate()` with variable substitution
    - Store templates in code (approved by Twilio)
    - _Requirements: 8.7_
  
  - [~] 9.2 Create message sending
    - Implement event-based message sending (assigned, dispatched, completed, failed)
    - Use Twilio WhatsApp API
    - Include tracking link in dispatched message
    - Include feedback link in delivered message
    - Store message history in whatsapp_messages table
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  
  - [~] 9.3 Create rate limiting
    - Implement `canSendMessage()` with 10 messages/day limit
    - Queue messages if rate limit exceeded
    - Check opt-out preferences before sending
    - _Requirements: 8.8_
  
  - [~] 9.4 Create ETA update messages
    - Send message when ETA changes >5 minutes
    - Debounce updates (max 1 per 10 minutes)
    - _Requirements: 8.3_
  
  - [~] 9.5 Write property tests for WhatsApp Service
    - **Property 44: WhatsApp Event-Based Messaging** - For any event, appropriate message sent
    - **Property 45: WhatsApp ETA Update Messages** - For any change >5min, update sent
    - **Property 46: WhatsApp Template Compliance** - For any message, uses approved template
    - **Property 47: WhatsApp Rate Limiting** - For any customer >10 msgs/day, queued
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.7, 8.8**
  
  - [~] 9.6 Write unit tests for WhatsApp Service
    - Test message sending with mock Twilio API
    - Test template rendering with variables
    - Test rate limiting logic
    - Test opt-out handling
    - Test error handling (Twilio failure, rate limit)
    - _Requirements: 8.1-8.8_

- [ ] 10. Implement Analytics Engine
  - [~] 10.1 Create real-time metrics collection
    - Implement `recordDeliveryEvent()` to update Redis metrics
    - Track active deliveries, average delivery time, driver utilization
    - Update metrics on every delivery event
    - Set TTL for real-time metrics (1 hour)
    - _Requirements: 7.1, 7.2_
  
  - [~] 10.2 Create historical metrics aggregation
    - Implement background job to aggregate metrics every 5 minutes
    - Store in delivery_metrics table
    - Calculate hourly, daily, weekly aggregates
    - Use materialized views for complex queries
    - _Requirements: 7.3_
  
  - [~] 10.3 Create heatmap generation
    - Implement `getDeliveryHeatmap()` with geographic bounds
    - Query location_history for delivery density
    - Return array of {latitude, longitude, weight}
    - _Requirements: 7.4_
  
  - [~] 10.4 Create demand forecasting
    - Implement `predictDeliveryVolume()` using time series
    - Use moving average with day/hour patterns
    - Consider weather and events
    - Update predictions every hour
    - _Requirements: 7.5_
  
  - [~] 10.5 Create alert system
    - Implement `checkThresholds()` for metric alerts
    - Configure thresholds (avg delivery time >45min, failure rate >5%)
    - Trigger alerts when exceeded
    - Implement alert throttling (max 1 per metric per hour)
    - _Requirements: 7.6_
  
  - [~] 10.6 Create driver performance scoring
    - Calculate performance scores from on-time rate, ratings, avg time
    - Update scores daily
    - Store in driver records
    - _Requirements: 7.7_
  
  - [~] 10.7 Create data export
    - Implement CSV and JSON export for all metrics
    - Support date range filtering
    - Optimize queries for large datasets
    - _Requirements: 7.8_
  
  - [~] 10.8 Create analytics API endpoints
    - Create GET `/api/analytics/realtime` for current metrics
    - Create GET `/api/analytics/historical` for time series
    - Create GET `/api/analytics/heatmap` for geographic data
    - Create GET `/api/analytics/forecast` for predictions
    - Create GET `/api/analytics/export` for data export
    - _Requirements: 7.1-7.8_
  
  - [~] 10.9 Write property tests for Analytics Engine
    - **Property 36: Real-Time Metric Updates** - For any event, metrics update in real-time
    - **Property 37: Required Metrics Display** - For any dashboard view, all metrics present
    - **Property 38: Historical Data Charts** - For any period, chart data provided
    - **Property 39: Delivery Heatmap Generation** - For any bounds, heatmap data generated
    - **Property 40: Demand Forecasting** - For any time, forecast generated
    - **Property 41: Threshold Alert Triggering** - For any threshold exceeded, alert triggered
    - **Property 42: Driver Performance Score Calculation** - For any driver, score calculated correctly
    - **Property 43: Analytics Data Export** - For any metric, CSV and JSON supported
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
  
  - [~] 10.10 Write unit tests for Analytics Engine
    - Test metric collection from events
    - Test aggregation logic
    - Test heatmap generation with PostGIS
    - Test forecasting algorithm
    - Test alert triggering
    - Test performance score calculation
    - Test export formats (CSV, JSON)
    - Test error handling (Redis failure, DB failure)
    - _Requirements: 7.1-7.8_

- [ ] 11. Implement Modern Admin Panel UI
  - [~] 11.1 Create delivery list with Shadcn/UI Table
    - Use Shadcn/UI Table component
    - Implement sorting by all columns
    - Implement filtering by status, driver, date
    - Add skeleton loaders while fetching
    - _Requirements: 6.5_
  
  - [~] 11.2 Create real-time updates with SSE
    - Connect to `/api/deliveries/stream` on mount
    - Update delivery list on SSE events
    - Show toast notifications for important events
    - Handle reconnection automatically
    - _Requirements: 1.1, 1.3, 6.2_
  
  - [~] 11.3 Create Mapbox map with driver locations
    - Integrate Mapbox GL JS
    - Show driver markers with custom icons
    - Update marker positions on location events
    - Show delivery routes
    - _Requirements: 2.5_
  
  - [~] 11.4 Create drag-and-drop assignment
    - Implement drag-and-drop for manual assignment
    - Show optimistic update immediately
    - Revert on server error
    - Show toast on success/failure
    - _Requirements: 6.4_
  
  - [~] 11.5 Create forms with validation
    - Use Shadcn/UI Form components
    - Implement real-time validation
    - Show validation errors inline
    - Disable submit while loading
    - _Requirements: 6.6, 6.8_
  
  - [~] 11.6 Create analytics dashboard
    - Display real-time metrics (active deliveries, avg time, utilization)
    - Show historical charts (delivery volume by hour/day/week)
    - Show heatmap of delivery density
    - Show demand forecast
    - Auto-refresh every 30 seconds
    - _Requirements: 7.2, 7.3, 7.4, 7.5_
  
  - [~] 11.7 Write property tests for Admin Panel UI
    - **Property 32: Optimistic UI Updates** - For any action, UI updates immediately
    - **Property 33: Table Sorting and Filtering** - For any list, sorting and filtering work
    - **Property 34: Form Real-Time Validation** - For any invalid input, rejected in real-time
    - **Property 35: Loading State Disables Actions** - For any loading state, elements disabled
    - **Validates: Requirements 6.2, 6.5, 6.6, 6.8**
  
  - [~] 11.8 Write integration tests for Admin Panel
    - Test SSE connection and updates
    - Test map rendering and marker updates
    - Test drag-and-drop assignment
    - Test form validation and submission
    - Test analytics dashboard data loading
    - _Requirements: 6.1-6.8, 7.1-7.8_

- [ ] 12. Implement Driver App with Push Notifications
  - [~] 12.1 Create push notification setup
    - Request notification permission on login
    - Subscribe to push notifications
    - Store subscription on server
    - _Requirements: 4.1, 4.2_
  
  - [~] 12.2 Create notification handlers
    - Handle notification click to open order details
    - Handle action buttons (Accept, Reject)
    - Show in-app notification if app is open
    - _Requirements: 4.7_
  
  - [~] 12.3 Create location tracking
    - Send location updates every 30 seconds
    - Use Geolocation API
    - Handle permission denial gracefully
    - Queue updates when offline
    - _Requirements: 2.1_
  
  - [~] 12.4 Create order management UI
    - Show assigned orders
    - Show order details with map
    - Show ETA to customer
    - Allow status updates (dispatched, delivered, failed)
    - _Requirements: 3.6_
  
  - [~] 12.5 Write integration tests for Driver App
    - Test push notification flow
    - Test location tracking
    - Test order acceptance/rejection
    - Test status updates
    - Test offline queueing
    - _Requirements: 2.1, 4.1-4.8_

- [ ] 13. Implement Customer Portal
  - [~] 13.1 Create public tracking page
    - Create `/track/:orderId` route
    - Show order status and ETA
    - Show driver location on map
    - Auto-update via SSE
    - _Requirements: 8.6_
  
  - [~] 13.2 Create feedback form
    - Create feedback form with rating
    - Submit feedback to server
    - Store in database
    - _Requirements: 8.4_
  
  - [~] 13.3 Write integration tests for Customer Portal
    - Test tracking page rendering
    - Test real-time updates
    - Test feedback submission
    - _Requirements: 8.4, 8.6_

- [ ] 14. Integration and Wiring
  - [~] 14.1 Wire assignment to push notifications
    - Trigger push notification on assignment
    - Include order details in notification
    - _Requirements: 3.6, 4.3_
  
  - [~] 14.2 Wire assignment to WhatsApp
    - Trigger WhatsApp message on assignment
    - Include driver name and ETA
    - _Requirements: 8.1_
  
  - [~] 14.3 Wire location updates to ETA
    - Trigger ETA recalculation on location update
    - Broadcast ETA update via SSE
    - Trigger WhatsApp if change >5 minutes
    - _Requirements: 5.2, 5.6, 8.3_
  
  - [~] 14.4 Wire delivery events to analytics
    - Send all delivery events to analytics engine
    - Update real-time metrics
    - Trigger alerts if thresholds exceeded
    - _Requirements: 7.1, 7.6_
  
  - [~] 14.5 Wire status changes to WhatsApp
    - Trigger WhatsApp on dispatched, delivered, failed
    - Include appropriate message for each status
    - _Requirements: 8.2, 8.4, 8.5_
  
  - [~] 14.6 Write end-to-end tests
    - Test complete delivery flow (create → assign → dispatch → deliver)
    - Test error recovery flow (no drivers → queue → assign)
    - Test offline/online flow (offline → queue → online → sync)
    - _Requirements: All_

- [~] 15. Final Checkpoint - Complete System Test
  - Run all unit tests (expect 100% pass)
  - Run all property-based tests (expect 100% pass, 100 iterations each)
  - Run all integration tests (expect 100% pass)
  - Run all end-to-end tests (expect 100% pass)
  - Test with 100 concurrent SSE connections
  - Test with 100 active drivers sending locations
  - Test assignment with 100 available drivers
  - Test analytics with 10,000 events
  - Verify all error handling works
  - Verify all monitoring and logging works
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- End-to-end tests validate complete user flows
- Use TypeScript for all implementation
- Use Fast-check for property-based testing
- Use Shadcn/UI for all UI components
- Use Mapbox GL JS for maps
- Use Twilio WhatsApp API for customer communication
- Use Redis for real-time data (locations, metrics, queues)
- Use PostgreSQL with PostGIS for persistent data and geospatial queries
