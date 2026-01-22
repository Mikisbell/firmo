# Implementation Plan: KDS Stations Real-Time Integration & Analytics (FASE 3)

**Feature Name:** kds-stations-real-time-integration  
**Created:** 22 Enero 2026  
**Status:** Ready for Implementation  
**Priority:** High  
**Estimated Effort:** 13 days (2.5 weeks)

---

## Overview

Transform the KDS Stations management page from a visual prototype with simulated data into a complete real-time monitoring and analytics system with:
- Real database queries replacing all simulated data
- WebSocket for live updates (< 50ms latency)
- Historical trend visualization with Recharts
- Activity heatmap for pattern identification
- Station comparison analytics
- PDF and Excel export capabilities

**Timeline:** 13 days organized in 3 weeks:
- **Week 1 (Days 1-5):** Fundamentos - Database, APIs, WebSocket, Frontend Integration
- **Week 2 (Days 6-10):** Analytics & Visualización - Charts, Heatmap, Export
- **Week 3 (Days 11-13):** Testing & Polish - Tests, Documentation, Optimization

---

## Tasks

### Week 1: Fundamentos (Days 1-5)

#### Day 1: Database Updates

- [x] 1. Database Schema Updates
  - [x] 1.1 Add estimated_time column to stations table
    - Create migration file `migrations/add_estimated_time.sql`
    - Add column with DEFAULT 10 and NOT NULL constraint
    - Add CHECK constraint for range 1-60
    - Add comment explaining purpose
    - _Requirements: 2.4.1, 2.4.4, 2.4.5_
    - _Estimated: 30 minutes_

  - [x] 1.2 Create station_alerts table
    - Create migration file `migrations/create_station_alerts.sql`
    - Define all columns (id, station_id, message, severity, metric_type, etc.)
    - Add foreign key constraints
    - Add CHECK constraints for severity and metric_type
    - Add dismissed_at_required constraint
    - _Requirements: 2.3.5_
    - _Estimated: 45 minutes_

  - [x] 1.3 Add performance indices
    - Create migration file `migrations/add_metrics_indices.sql`
    - Add idx_sale_items_station_metrics covering index
    - Add idx_sale_items_completed partial index
    - Add idx_sale_items_efficiency index
    - Add idx_sales_active_orders index
    - Add idx_station_alerts indices (station_id, is_dismissed, created_at, severity, tenant_id)
    - _Requirements: PR 3.4.1, PR 3.4.5_
    - _Estimated: 30 minutes_

  - [x] 1.4 Create materialized views
    - Create migration file `migrations/create_materialized_views.sql`
    - Create station_hourly_metrics view with aggregations
    - Create station_daily_summary view with aggregations
    - Add indices on materialized views
    - Add refresh schedule comments
    - _Requirements: PR 3.4.7_
    - _Estimated: 1 hour_

  - [x] 1.5 Run migrations and verify
    - Create migration script `scripts/migrate-fase3.sh`
    - Run all migrations in order
    - Verify schema changes with `\d stations` and `\d station_alerts`
    - Refresh materialized views
    - Test rollback procedure
    - _Requirements: All database requirements_
    - _Estimated: 30 minutes_


#### Day 2-3: Real-Time APIs

- [x] 2. Metrics Calculation Service
  - [x] 2.1 Create metrics calculation service
    - Create `src/app/api/admin/stations/services/metrics-service.ts`
    - Implement calculateStationMetrics() function
    - Calculate active orders (PENDING + COOKING, not VOIDED)
    - Calculate average time (last 24h completed orders)
    - Calculate efficiency (% within estimated_time)
    - Calculate load (% of capacity, max 15 orders)
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4_
    - _Estimated: 2 hours_

  - [ ]* 2.2 Write property test for metrics calculation
    - **Property 1: Active Orders Count Accuracy**
    - **Property 2: Average Time Calculation Correctness**
    - **Property 3: Efficiency Percentage Accuracy**
    - **Property 4: Load Percentage Calculation**
    - **Validates: Requirements 2.1.1, 2.1.2, 2.1.3, 2.1.4**
    - Create `src/app/api/admin/stations/services/__tests__/metrics-service.property.test.ts`
    - Use fast-check with 100 iterations
    - Generate random sale_items data
    - Verify calculations match expected values
    - _Estimated: 2 hours_

  - [x] 2.3 Implement GET /api/admin/stations/:id/metrics endpoint
    - Create `src/app/api/admin/stations/[id]/metrics/route.ts`
    - Add admin authentication middleware
    - Check Redis cache first (5 min TTL)
    - Query database if cache miss
    - Call calculateStationMetrics()
    - Cache result in Redis
    - Return JSON response
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5_
    - _Estimated: 1.5 hours_

  - [ ]* 2.4 Write unit tests for metrics endpoint
    - Test 404 for non-existent station
    - Test cache hit scenario
    - Test cache miss scenario
    - Test empty completed orders
    - Test admin authentication
    - _Estimated: 1 hour_

- [x] 3. Orders Listing API
  - [x] 3.1 Implement GET /api/admin/stations/:id/orders endpoint
    - Create `src/app/api/admin/stations/[id]/orders/route.ts`
    - Add admin authentication
    - Query active orders for station
    - Join with sales and products tables
    - Calculate wait time for each order
    - Support pagination (limit, offset)
    - Return orders sorted by wait time (most urgent first)
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4_
    - _Estimated: 2 hours_

  - [ ]* 3.2 Write property test for orders listing
    - **Property 5: Order Data Completeness**
    - **Property 6: Order Status Consistency**
    - **Property 7: Order Sorting Correctness**
    - **Validates: Requirements 2.2.2, 2.2.3, 2.2.4**
    - Generate random orders with items
    - Verify all required fields present
    - Verify status aggregation logic
    - Verify sorting by wait time
    - _Estimated: 1.5 hours_

- [x] 4. Alerts Management APIs
  - [x] 4.1 Create alert generation service
    - Create `src/app/api/admin/stations/services/alert-service.ts`
    - Implement checkAlertRules() function
    - Check high severity rules (avgTime > 1.5x, load > 90%, efficiency < 60%)
    - Check medium severity rules (avgTime > 1.2x, load > 80%, efficiency < 70%)
    - Check low severity rules (avgTime > 1x, load > 60%, efficiency < 85%)
    - Generate alert with correct severity and message
    - _Requirements: 2.3.1, 2.3.2, 2.3.3, 2.3.4_
    - _Estimated: 1.5 hours_

  - [ ]* 4.2 Write property test for alert generation
    - **Property 8: Alert Threshold Accuracy**
    - **Validates: Requirements 2.3.1, 2.3.2, 2.3.3, 2.3.4**
    - Generate random metrics values
    - Verify alerts generated when thresholds exceeded
    - Verify correct severity levels
    - Verify no alerts when within thresholds
    - _Estimated: 1 hour_

  - [x] 4.3 Implement GET /api/admin/stations/alerts endpoint
    - Create `src/app/api/admin/stations/alerts/route.ts`
    - Add admin authentication
    - Query non-dismissed alerts
    - Support filtering by stationId and severity
    - Join with stations table for station names
    - Return alerts sorted by created_at DESC
    - _Requirements: 2.3.4, 2.3.5_
    - _Estimated: 1 hour_

  - [x] 4.4 Implement POST /api/admin/stations/alerts/:id/dismiss endpoint
    - Create `src/app/api/admin/stations/alerts/[id]/dismiss/route.ts`
    - Add admin authentication
    - Validate alert exists and not already dismissed
    - Update is_dismissed = true
    - Set dismissed_at timestamp
    - Set dismissed_by employee_id
    - Return updated alert
    - _Requirements: 2.3.5_
    - _Estimated: 45 minutes_

  - [ ]* 4.5 Write property test for alert persistence
    - **Property 9: Alert Persistence Round-Trip**
    - **Validates: Requirements 2.3.5**
    - Create alert, dismiss it, query it
    - Verify is_dismissed = true
    - Verify dismissed_at is set
    - _Estimated: 30 minutes_

- [x] 5. Station Configuration API
  - [x] 5.1 Update PUT /api/admin/stations/:id endpoint
    - Modify existing `src/app/api/admin/stations/[id]/route.ts`
    - Add support for updating estimated_time
    - Validate estimated_time range (1-60)
    - Update station record
    - Invalidate metrics cache
    - Return updated station
    - _Requirements: 2.4.1, 2.4.2, 2.4.3, 2.4.5_
    - _Estimated: 1 hour_

  - [ ]* 5.2 Write property tests for configuration
    - **Property 10: Estimated Time Persistence**
    - **Property 11: Estimated Time Validation**
    - **Validates: Requirements 2.4.1, 2.4.5**
    - Test update and query round-trip
    - Test validation of valid range (1-60)
    - Test rejection of invalid values
    - _Estimated: 45 minutes_


- [x] 6. Cache Layer Implementation
  - [x] 6.1 Set up Redis cache service
    - Verify `src/core/cache/redis.service.ts` exists and is configured
    - Add cache key patterns for KDS metrics
    - Implement cache invalidation on events
    - Add cache warming on deployment
    - _Requirements: PR 3.4.6_
    - _Estimated: 1 hour_

  - [x] 6.2 Implement cache invalidation triggers
    - Listen to ITEM_COMPLETED events
    - Listen to ORDER_SUBMITTED events
    - Invalidate station metrics cache
    - Invalidate trends cache for today
    - Broadcast WebSocket update
    - _Requirements: 2.1.5, 2.2.5_
    - _Estimated: 1 hour_

#### Day 4: WebSocket Integration

- [ ] 7. WebSocket Server Setup
  - [ ] 7.1 Install WebSocket dependencies
    - Run `npm install ws @types/ws`
    - Update package.json
    - _Requirements: NFR 6.1.2_
    - _Estimated: 10 minutes_

  - [ ] 7.2 Create WebSocket server
    - Create `src/app/api/stations/live/route.ts`
    - Set up WebSocketServer with noServer: true
    - Implement connection manager (Map<stationId, Set<WebSocket>>)
    - Add authentication check on connection
    - Send welcome message on connect
    - _Requirements: NFR 6.1.2, NFR 6.3.1_
    - _Estimated: 2 hours_

  - [ ] 7.3 Implement subscription mechanism
    - Handle 'subscribe' message type
    - Handle 'unsubscribe' message type
    - Handle 'ping' message type (keep-alive)
    - Store subscriptions in connection manager
    - Send subscription confirmation
    - _Requirements: NFR 6.1.2_
    - _Estimated: 1 hour_

  - [ ] 7.4 Implement event broadcasting
    - Create broadcastMetricsUpdate() function
    - Create broadcastOrderUpdate() function
    - Create broadcastAlertCreated() function
    - Create broadcastAlertDismissed() function
    - Send messages to all subscribed clients
    - Handle disconnected clients gracefully
    - _Requirements: 2.1.5, 2.2.5, NFR 6.1.2_
    - _Estimated: 1.5 hours_

  - [ ]* 7.5 Write integration tests for WebSocket
    - Test connection and authentication
    - Test subscription mechanism
    - Test message broadcasting
    - Test multiple clients receiving updates
    - Test disconnection handling
    - _Estimated: 2 hours_

- [ ] 8. WebSocket Client Implementation
  - [ ] 8.1 Create useWebSocket hook
    - Create `src/app/admin/estaciones/hooks/useWebSocket.ts`
    - Implement connection logic with token authentication
    - Implement auto-reconnect with exponential backoff
    - Implement keep-alive ping (every 30 seconds)
    - Handle connection state (isConnected)
    - Handle incoming messages (lastMessage)
    - Implement send() function
    - _Requirements: NFR 6.2.1, NFR 6.2.2_
    - _Estimated: 2 hours_

  - [ ] 8.2 Add WebSocket connection indicator to UI
    - Update `src/app/admin/estaciones/page.tsx`
    - Add connection status indicator (green/red dot)
    - Show "Connected" or "Disconnected" text
    - Display reconnection attempts if disconnected
    - _Requirements: NFR 6.2.1_
    - _Estimated: 30 minutes_

#### Day 5: Frontend Real-Time Integration

- [-] 9. Replace Simulated Data with Real APIs
  - [x] 9.1 Create useStationMetrics hook
    - Create `src/app/admin/estaciones/hooks/useStationMetrics.ts`
    - Fetch metrics from API on mount
    - Implement polling fallback (30 seconds) if WebSocket disconnected
    - Implement updateMetrics() for WebSocket updates
    - Handle loading and error states
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5_
    - _Estimated: 1.5 hours_

  - [x] 9.2 Create useStationOrders hook
    - Create `src/app/admin/estaciones/hooks/useStationOrders.ts`
    - Fetch orders from API
    - Support pagination
    - Handle real-time updates via WebSocket
    - Handle loading and error states
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5_
    - _Estimated: 1 hour_

  - [x] 9.3 Create useStationAlerts hook
    - Create `src/app/admin/estaciones/hooks/useStationAlerts.ts`
    - Fetch alerts from API
    - Support filtering by station and severity
    - Handle real-time alert creation via WebSocket
    - Handle alert dismissal
    - _Requirements: 2.3.4, 2.3.5_
    - _Estimated: 1 hour_

  - [ ] 9.4 Update StationCard component
    - Modify `src/app/admin/estaciones/components/StationCard.tsx`
    - Replace simulated data with useStationMetrics hook
    - Integrate WebSocket for real-time updates
    - Add loading skeleton
    - Add error handling UI
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5_
    - _Estimated: 1 hour_

  - [ ] 9.5 Update OrdersModal component
    - Modify `src/app/admin/estaciones/components/OrdersModal.tsx`
    - Replace simulated data with useStationOrders hook
    - Integrate WebSocket for real-time updates
    - Add pagination controls
    - Add loading and error states
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5_
    - _Estimated: 1 hour_

  - [ ] 9.6 Update AlertsPanel component
    - Modify `src/app/admin/estaciones/components/AlertsPanel.tsx`
    - Replace simulated data with useStationAlerts hook
    - Integrate WebSocket for real-time updates
    - Add dismiss functionality
    - Add severity filtering
    - _Requirements: 2.3.4, 2.3.5_
    - _Estimated: 1 hour_

  - [ ] 9.7 Update global statistics
    - Update main page to calculate global stats from real data
    - Active stations count (is_active = true)
    - Total active orders (sum across all stations)
    - Average time (weighted average)
    - Global efficiency (weighted average)
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4, 2.5.5_
    - _Estimated: 1 hour_

  - [ ]* 9.8 Write property tests for global statistics
    - **Property 22: Active Stations Count Accuracy**
    - **Property 23: Global Aggregation Consistency**
    - **Validates: Requirements 2.5.1, 2.5.2**
    - Generate random station data
    - Verify counts and aggregations
    - _Estimated: 1 hour_

- [ ] 10. Checkpoint - Week 1 Complete
  - Verify all database migrations applied
  - Verify all APIs returning real data
  - Verify WebSocket connection working
  - Verify frontend displaying real-time data
  - Run all tests and ensure passing
  - Ask user if questions arise


### Week 2: Analytics & Visualización (Days 6-10)

#### Day 6-7: Analytics APIs

- [ ] 11. Trends API Implementation
  - [ ] 11.1 Implement GET /api/admin/stations/:id/trends endpoint
    - Create `src/app/api/admin/stations/[id]/trends/route.ts`
    - Add admin authentication
    - Support query params: metric (avgTime|efficiency|orders), period (7d|30d|90d)
    - Check Redis cache first (1 hour TTL)
    - Query materialized view station_daily_summary
    - Calculate summary statistics (average, min, max, trend)
    - Cache result
    - Return JSON response
    - _Requirements: 7.1.1, 7.1.2, 7.1.3, 7.1.5, PR 3.4.6_
    - _Estimated: 2 hours_

  - [ ]* 11.2 Write property test for trends API
    - **Property 12: Trend Data Date Range Accuracy**
    - **Validates: Requirements 7.1.5, 7.4.4**
    - Generate random date ranges
    - Verify returned data within range
    - Verify no data outside range
    - _Estimated: 1 hour_

  - [ ]* 11.3 Write unit tests for trends endpoint
    - Test cache hit scenario
    - Test cache miss scenario
    - Test different metric types
    - Test different period values
    - Test trend calculation (improving/declining/stable)
    - _Estimated: 1.5 hours_

- [ ] 12. Heatmap API Implementation
  - [ ] 12.1 Implement GET /api/admin/stations/:id/heatmap endpoint
    - Create `src/app/api/admin/stations/[id]/heatmap/route.ts`
    - Add admin authentication
    - Support query params: days (7|14|30), metric (orderCount|avgTime|efficiency)
    - Check Redis cache first (1 day TTL)
    - Query materialized view station_hourly_metrics
    - Calculate intensity normalization (0-100)
    - Return 7x24 grid data
    - _Requirements: 7.2.1, 7.2.2, 7.2.4, 7.2.5, PR 3.4.7_
    - _Estimated: 2.5 hours_

  - [ ]* 12.2 Write property tests for heatmap API
    - **Property 13: Heatmap Structure Completeness**
    - **Property 14: Color Intensity Normalization**
    - **Property 15: Station Filtering Correctness**
    - **Validates: Requirements 7.2.1, 7.2.2, 7.2.4, 7.2.5**
    - Verify 168 cells for 7 days
    - Verify intensity normalization consistency
    - Verify station filtering
    - _Estimated: 1.5 hours_

- [ ] 13. Comparison API Implementation
  - [ ] 13.1 Implement GET /api/admin/stations/compare endpoint
    - Create `src/app/api/admin/stations/compare/route.ts`
    - Add admin authentication
    - Support query params: stations (comma-separated IDs), period (7d|30d)
    - Validate 2-5 stations
    - Check Redis cache first (15 min TTL)
    - Query metrics for all stations
    - Calculate rankings
    - Identify best/worst performers
    - Return comparison data with summary
    - _Requirements: 7.4.1, 7.4.2, 7.4.3, 7.4.4_
    - _Estimated: 2 hours_

  - [ ]* 13.2 Write property tests for comparison API
    - **Property 16: Comparison Data Completeness**
    - **Property 17: Performance Ranking Correctness**
    - **Validates: Requirements 7.4.1, 7.4.2, 7.4.3**
    - Generate random station metrics
    - Verify all metrics present
    - Verify ranking logic
    - _Estimated: 1 hour_

#### Day 8-9: Charts & Heatmap Components

- [ ] 14. Install Chart Dependencies
  - [ ] 14.1 Install Recharts library
    - Run `npm install recharts`
    - Run `npm install --save-dev @types/recharts`
    - Verify installation
    - _Requirements: 7.1.6_
    - _Estimated: 10 minutes_

- [ ] 15. Trend Chart Component
  - [ ] 15.1 Create TrendChart component
    - Create `src/app/admin/estaciones/components/TrendChart.tsx`
    - Support props: stationId, metric, period, chartType
    - Implement LineChart for time series
    - Implement BarChart for hourly comparison
    - Implement AreaChart for cumulative metrics
    - Add responsive container
    - Add interactive tooltips
    - Add legend with toggle
    - Add grid lines
    - Add color coding (green/yellow/red based on performance)
    - _Requirements: 7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.6_
    - _Estimated: 3 hours_

  - [ ] 15.2 Create useStationTrends hook
    - Create `src/app/admin/estaciones/hooks/useStationTrends.ts`
    - Fetch trends data from API
    - Handle loading and error states
    - Support refetch
    - Cache data client-side
    - _Requirements: 7.1.5, 7.1.7_
    - _Estimated: 1 hour_

  - [ ] 15.3 Create DateRangeSelector component
    - Create `src/app/admin/estaciones/components/DateRangeSelector.tsx`
    - Add buttons for "Today", "7 Days", "30 Days", "90 Days"
    - Add custom date range picker
    - Emit onChange event
    - Style with Tailwind
    - _Requirements: 7.1.5_
    - _Estimated: 1 hour_

  - [ ] 15.4 Integrate TrendChart into station details view
    - Add chart section to station details modal/page
    - Add metric selector (avgTime, efficiency, orders)
    - Add period selector
    - Add chart type selector (line, bar, area)
    - Add loading skeleton
    - Add error boundary
    - _Requirements: 7.1.1, 7.1.2, 7.1.3, 7.1.4, 7.1.5_
    - _Estimated: 1.5 hours_

- [ ] 16. Activity Heatmap Component
  - [ ] 16.1 Create ActivityHeatmap component
    - Create `src/app/admin/estaciones/components/ActivityHeatmap.tsx`
    - Support props: stationId, metric, days
    - Render 7x24 grid using CSS Grid
    - Implement color scale (green to red)
    - Add hover tooltips with exact metrics
    - Add click handler for detailed view
    - Add day labels (Monday-Sunday)
    - Add hour labels (0-23)
    - Add legend for color scale
    - _Requirements: 7.2.1, 7.2.2, 7.2.3, 7.2.5_
    - _Estimated: 3 hours_

  - [ ] 16.2 Create useHeatmapData hook
    - Create `src/app/admin/estaciones/hooks/useHeatmapData.ts`
    - Fetch heatmap data from API
    - Handle loading and error states
    - Support refetch
    - Cache data client-side
    - _Requirements: 7.2.6_
    - _Estimated: 45 minutes_

  - [ ] 16.3 Integrate ActivityHeatmap into dashboard
    - Add heatmap section to main dashboard
    - Add station filter (all stations or specific one)
    - Add metric selector (orderCount, avgTime, efficiency)
    - Add loading skeleton
    - Add error boundary
    - _Requirements: 7.2.1, 7.2.4_
    - _Estimated: 1 hour_

- [ ] 17. Comparison View Component
  - [ ] 17.1 Create ComparisonView component
    - Create `src/app/admin/estaciones/components/ComparisonView.tsx`
    - Support props: stationIds (2-5), period
    - Render side-by-side comparison table
    - Show all key metrics for each station
    - Highlight best performer (green)
    - Highlight worst performer (red)
    - Add visual indicators (🟢🟡🔴)
    - Add rank column
    - _Requirements: 7.4.1, 7.4.2, 7.4.3_
    - _Estimated: 2 hours_

  - [ ] 17.2 Add station multi-selector
    - Add checkbox list for selecting 2-5 stations
    - Validate selection (min 2, max 5)
    - Add "Select All" / "Clear All" buttons
    - Show selected count
    - _Requirements: 7.4.1_
    - _Estimated: 1 hour_

  - [ ] 17.3 Integrate ComparisonView into dashboard
    - Add comparison section to dashboard
    - Add station selector
    - Add period selector
    - Add loading skeleton
    - Add error boundary
    - _Requirements: 7.4.1, 7.4.4_
    - _Estimated: 1 hour_


#### Day 10: Export Functionality

- [ ] 18. Install Export Dependencies
  - [ ] 18.1 Install PDF and Excel libraries
    - Run `npm install jspdf html2canvas`
    - Run `npm install exceljs`
    - Run `npm install --save-dev @types/jspdf`
    - Verify installation
    - _Requirements: 7.3.1, 7.3.3_
    - _Estimated: 10 minutes_

- [ ] 19. PDF Export Service
  - [ ] 19.1 Create PDF export service
    - Create `src/app/api/admin/stations/services/pdf-export-service.ts`
    - Implement generatePDFReport() function
    - Add executive summary page
    - Add metrics tables
    - Add charts (if requested)
    - Add heatmap visualization
    - Add metadata (date range, timestamp)
    - Format with proper styling
    - _Requirements: 7.3.1, 7.3.2, 7.3.5_
    - _Estimated: 3 hours_

  - [ ] 19.2 Implement POST /api/admin/stations/export/pdf endpoint
    - Create `src/app/api/admin/stations/export/pdf/route.ts`
    - Add admin authentication
    - Validate request body (stationIds, dateRange, options)
    - Fetch all required data
    - Call generatePDFReport()
    - Return PDF as blob with proper headers
    - Add Content-Disposition header for download
    - _Requirements: 7.3.1, 7.3.2, PR 3.4.8_
    - _Estimated: 1.5 hours_

  - [ ]* 19.3 Write property test for PDF export
    - **Property 18: PDF Content Completeness**
    - **Property 20: Export Metadata Inclusion**
    - **Property 21: Export Date Filtering**
    - **Validates: Requirements 7.3.1, 7.3.2, 7.3.5, 7.3.6**
    - Generate PDF with random data
    - Verify all sections present
    - Verify metadata included
    - Verify date filtering
    - _Estimated: 1.5 hours_

- [ ] 20. Excel Export Service
  - [ ] 20.1 Create Excel export service
    - Create `src/app/api/admin/stations/services/excel-export-service.ts`
    - Implement generateExcelReport() function
    - Create Summary sheet with station info
    - Create Hourly Metrics sheet with time series data
    - Create Orders sheet with order details
    - Create Alerts sheet with alert history
    - Add column headers and formatting
    - Add metadata (date range, timestamp)
    - _Requirements: 7.3.3, 7.3.4, 7.3.5_
    - _Estimated: 2.5 hours_

  - [ ] 20.2 Implement POST /api/admin/stations/export/excel endpoint
    - Create `src/app/api/admin/stations/export/excel/route.ts`
    - Add admin authentication
    - Validate request body (stationIds, dateRange)
    - Fetch all required data
    - Call generateExcelReport()
    - Return Excel file as blob with proper headers
    - Add Content-Disposition header for download
    - _Requirements: 7.3.3, 7.3.4, PR 3.4.9_
    - _Estimated: 1 hour_

  - [ ]* 20.3 Write property test for Excel export
    - **Property 19: Excel Structure Completeness**
    - **Property 20: Export Metadata Inclusion**
    - **Property 21: Export Date Filtering**
    - **Validates: Requirements 7.3.3, 7.3.4, 7.3.5, 7.3.6**
    - Generate Excel with random data
    - Verify 4 sheets present
    - Verify metadata included
    - Verify date filtering
    - Verify handles 10,000+ rows
    - _Estimated: 1.5 hours_

- [ ] 21. Export UI Components
  - [ ] 21.1 Create ExportButtons component
    - Create `src/app/admin/estaciones/components/ExportButtons.tsx`
    - Add "Export PDF" button
    - Add "Export Excel" button
    - Add date range selector
    - Add station selector (which stations to include)
    - Add options (include charts, include heatmap)
    - Show progress indicator during generation
    - Handle download errors
    - _Requirements: 7.3.1, 7.3.3, 7.3.6_
    - _Estimated: 2 hours_

  - [ ] 21.2 Create useExport hook
    - Create `src/app/admin/estaciones/hooks/useExport.ts`
    - Implement exportPDF() function
    - Implement exportExcel() function
    - Handle loading state
    - Handle error state
    - Trigger browser download
    - _Requirements: 7.3.1, 7.3.3_
    - _Estimated: 1 hour_

  - [ ] 21.3 Integrate ExportButtons into dashboard
    - Add export section to dashboard header
    - Add export buttons
    - Add export configuration modal
    - Add success/error notifications
    - _Requirements: 7.3.1, 7.3.3_
    - _Estimated: 1 hour_

- [ ] 22. Checkpoint - Week 2 Complete
  - Verify all analytics APIs working
  - Verify charts rendering correctly
  - Verify heatmap displaying data
  - Verify comparison view working
  - Verify PDF export generating correctly
  - Verify Excel export generating correctly
  - Run all tests and ensure passing
  - Ask user if questions arise

### Week 3: Testing & Polish (Days 11-13)

#### Day 11-12: Comprehensive Testing

- [ ] 23. Unit Tests
  - [ ]* 23.1 Write unit tests for metrics service
    - Test calculateStationMetrics() with various inputs
    - Test edge cases (no orders, all voided, etc.)
    - Test error handling
    - _Estimated: 2 hours_

  - [ ]* 23.2 Write unit tests for alert service
    - Test checkAlertRules() with various metrics
    - Test severity level assignment
    - Test alert message generation
    - _Estimated: 1.5 hours_

  - [ ]* 23.3 Write unit tests for export services
    - Test PDF generation with various data
    - Test Excel generation with various data
    - Test error handling
    - _Estimated: 2 hours_

  - [ ]* 23.4 Write unit tests for custom hooks
    - Test useStationMetrics hook
    - Test useStationOrders hook
    - Test useStationAlerts hook
    - Test useStationTrends hook
    - Test useHeatmapData hook
    - Test useWebSocket hook
    - Test useExport hook
    - _Estimated: 3 hours_

- [ ] 24. Integration Tests
  - [ ]* 24.1 Write integration tests for API endpoints
    - Test metrics endpoint with real database
    - Test orders endpoint with real database
    - Test alerts endpoint with real database
    - Test trends endpoint with materialized views
    - Test heatmap endpoint with materialized views
    - Test comparison endpoint with multiple stations
    - Test export endpoints with file generation
    - _Estimated: 4 hours_

  - [ ]* 24.2 Write integration tests for WebSocket
    - Test connection and authentication
    - Test subscription mechanism
    - Test message broadcasting to multiple clients
    - Test reconnection logic
    - Test keep-alive ping/pong
    - _Estimated: 2 hours_

  - [ ]* 24.3 Write integration tests for cache layer
    - Test cache hit scenarios
    - Test cache miss scenarios
    - Test cache invalidation on events
    - Test fallback to database when Redis unavailable
    - _Estimated: 1.5 hours_

- [ ] 25. E2E Tests with Playwright
  - [ ]* 25.1 Write E2E test for real-time metrics updates
    - Navigate to stations page
    - Verify initial metrics displayed
    - Trigger order completion in another tab
    - Verify metrics updated via WebSocket
    - Verify no page refresh required
    - _Requirements: 2.1.5, 2.2.5_
    - _Estimated: 1.5 hours_

  - [ ]* 25.2 Write E2E test for trend charts
    - Navigate to stations page
    - Click on station to open details
    - Verify trend chart renders
    - Change metric selector
    - Verify chart updates
    - Change period selector
    - Verify chart updates
    - _Requirements: 7.1.1, 7.1.2, 7.1.3, 7.1.5_
    - _Estimated: 1.5 hours_

  - [ ]* 25.3 Write E2E test for heatmap
    - Navigate to stations page
    - Verify heatmap renders
    - Hover over cell
    - Verify tooltip displays
    - Click on cell
    - Verify detailed view opens
    - _Requirements: 7.2.1, 7.2.2, 7.2.3_
    - _Estimated: 1 hour_

  - [ ]* 25.4 Write E2E test for comparison view
    - Navigate to stations page
    - Select 2-3 stations
    - Verify comparison table displays
    - Verify rankings correct
    - Verify best/worst highlighted
    - _Requirements: 7.4.1, 7.4.2, 7.4.3_
    - _Estimated: 1 hour_

  - [ ]* 25.5 Write E2E test for PDF export
    - Navigate to stations page
    - Click "Export PDF" button
    - Select date range
    - Select stations
    - Click "Generate"
    - Verify download starts
    - Verify file size > 0
    - _Requirements: 7.3.1, 7.3.2_
    - _Estimated: 1 hour_

  - [ ]* 25.6 Write E2E test for Excel export
    - Navigate to stations page
    - Click "Export Excel" button
    - Select date range
    - Select stations
    - Click "Generate"
    - Verify download starts
    - Verify file size > 0
    - _Requirements: 7.3.3, 7.3.4_
    - _Estimated: 1 hour_

  - [ ]* 25.7 Write E2E test for alert dismissal
    - Navigate to stations page
    - Verify alert displayed
    - Click "Dismiss" button
    - Verify alert removed from UI
    - Refresh page
    - Verify alert still dismissed
    - _Requirements: 2.3.5_
    - _Estimated: 45 minutes_


- [ ] 26. Performance Testing
  - [ ]* 26.1 Write performance test for metrics calculation
    - Use k6 or similar tool
    - Test with 10 concurrent users
    - Verify p95 < 100ms
    - Verify no errors
    - _Requirements: PR 3.4.1_
    - _Estimated: 1 hour_

  - [ ]* 26.2 Write performance test for WebSocket
    - Test with 10 concurrent connections
    - Verify message delivery < 50ms
    - Verify no dropped messages
    - _Requirements: PR 3.4.2_
    - _Estimated: 1 hour_

  - [ ]* 26.3 Write performance test for charts
    - Test chart rendering with 30 days of data
    - Verify render time < 200ms
    - Test with multiple charts on page
    - _Requirements: PR 3.4.6_
    - _Estimated: 1 hour_

  - [ ]* 26.4 Write performance test for heatmap
    - Test heatmap rendering with 7 days data
    - Verify load time < 300ms
    - Test with large datasets
    - _Requirements: PR 3.4.7_
    - _Estimated: 1 hour_

  - [ ]* 26.5 Write performance test for exports
    - Test PDF generation with 5 stations
    - Verify completion < 3 seconds
    - Test Excel generation with 10,000 rows
    - Verify completion < 2 seconds
    - _Requirements: PR 3.4.8, PR 3.4.9_
    - _Estimated: 1.5 hours_

- [ ] 27. Visual Regression Tests
  - [ ]* 27.1 Set up visual regression testing
    - Install Percy or similar tool
    - Configure Playwright integration
    - _Estimated: 30 minutes_

  - [ ]* 27.2 Capture baseline screenshots
    - Station cards with metrics
    - Trend charts (line, bar, area)
    - Activity heatmap
    - Comparison view
    - Export modal
    - _Estimated: 1 hour_

  - [ ]* 27.3 Write visual regression tests
    - Test station card rendering
    - Test chart rendering
    - Test heatmap rendering
    - Test comparison table rendering
    - Test responsive layouts (mobile, tablet, desktop)
    - _Estimated: 2 hours_

#### Day 13: Documentation & Polish

- [ ] 28. Documentation
  - [ ] 28.1 Update user documentation
    - Create `docs/03-features/FLUJO_KDS_ANALYTICS.md`
    - Document real-time metrics feature
    - Document trend charts usage
    - Document heatmap interpretation
    - Document comparison view
    - Document export functionality
    - Add screenshots
    - _Estimated: 2 hours_

  - [ ] 28.2 Create admin training guide
    - Create `docs/04-operations/KDS_ADMIN_GUIDE.md`
    - Document how to monitor stations
    - Document how to interpret metrics
    - Document how to respond to alerts
    - Document how to use analytics
    - Document how to export reports
    - Add troubleshooting section
    - _Estimated: 2 hours_

  - [ ] 28.3 Update API documentation
    - Document all new endpoints
    - Add request/response examples
    - Document WebSocket protocol
    - Add authentication requirements
    - Add rate limiting information
    - _Estimated: 1.5 hours_

  - [ ] 28.4 Update README
    - Add FASE 3 features to main README
    - Update feature checklist
    - Add links to new documentation
    - Update screenshots
    - _Estimated: 30 minutes_

- [ ] 29. Performance Optimization
  - [ ] 29.1 Optimize database queries
    - Review query execution plans
    - Add missing indices if needed
    - Optimize materialized view refresh
    - Add query result caching
    - _Requirements: PR 3.4.5_
    - _Estimated: 2 hours_

  - [ ] 29.2 Optimize frontend bundle size
    - Implement code splitting for charts
    - Lazy load export libraries
    - Tree shake unused Recharts components
    - Optimize images and assets
    - _Estimated: 1.5 hours_

  - [ ] 29.3 Optimize WebSocket performance
    - Implement message batching
    - Add message compression
    - Optimize subscription management
    - Add connection pooling
    - _Requirements: PR 3.4.2_
    - _Estimated: 1.5 hours_

  - [ ] 29.4 Optimize cache strategy
    - Review cache TTLs
    - Implement cache warming
    - Add cache preloading
    - Optimize cache invalidation
    - _Estimated: 1 hour_

- [ ] 30. UI/UX Polish
  - [ ] 30.1 Add loading skeletons
    - Add skeleton for station cards
    - Add skeleton for charts
    - Add skeleton for heatmap
    - Add skeleton for comparison table
    - _Estimated: 1 hour_

  - [ ] 30.2 Improve error handling UI
    - Add error boundaries for all major components
    - Add user-friendly error messages
    - Add retry buttons
    - Add fallback UI
    - _Estimated: 1.5 hours_

  - [ ] 30.3 Add animations and transitions
    - Add fade-in for charts
    - Add smooth transitions for metric updates
    - Add hover effects for heatmap cells
    - Add loading animations
    - _Estimated: 1 hour_

  - [ ] 30.4 Improve accessibility
    - Add ARIA labels to all interactive elements
    - Ensure keyboard navigation works
    - Add screen reader support
    - Test with accessibility tools
    - _Estimated: 1.5 hours_

  - [ ] 30.5 Responsive design improvements
    - Test on mobile devices
    - Test on tablets
    - Optimize chart sizing for small screens
    - Optimize heatmap for mobile
    - Add mobile-specific layouts
    - _Estimated: 2 hours_

- [ ] 31. Security Audit
  - [ ] 31.1 Review authentication and authorization
    - Verify admin-only access on all endpoints
    - Verify WebSocket authentication
    - Verify tenant isolation
    - Test with non-admin users
    - _Estimated: 1 hour_

  - [ ] 31.2 Review input validation
    - Verify all API inputs validated
    - Verify SQL injection prevention
    - Verify XSS prevention
    - Test with malicious inputs
    - _Estimated: 1 hour_

  - [ ] 31.3 Review rate limiting
    - Verify rate limits on all endpoints
    - Test with high request volumes
    - Verify proper error responses
    - _Estimated: 45 minutes_

  - [ ] 31.4 Review data sanitization
    - Verify user-generated content sanitized
    - Verify alert messages sanitized
    - Test with HTML/script injection
    - _Estimated: 45 minutes_

- [ ] 32. Final Testing & Validation
  - [ ] 32.1 Run full test suite
    - Run all unit tests
    - Run all property tests
    - Run all integration tests
    - Run all E2E tests
    - Verify 85%+ code coverage
    - _Estimated: 1 hour_

  - [ ] 32.2 Manual testing
    - Test all user flows manually
    - Test on different browsers (Chrome, Firefox, Safari)
    - Test on different devices (desktop, tablet, mobile)
    - Test with real data
    - Test edge cases
    - _Estimated: 2 hours_

  - [ ] 32.3 Performance validation
    - Run performance tests
    - Verify all performance targets met
    - Profile slow queries
    - Profile slow components
    - _Estimated: 1 hour_

  - [ ] 32.4 Security validation
    - Run security audit
    - Test authentication flows
    - Test authorization rules
    - Test input validation
    - _Estimated: 1 hour_

- [ ] 33. Deployment Preparation
  - [ ] 33.1 Create deployment checklist
    - List all migrations to run
    - List all environment variables needed
    - List all dependencies to install
    - List all services to restart
    - _Estimated: 30 minutes_

  - [ ] 33.2 Create rollback plan
    - Document rollback steps
    - Test rollback procedure
    - Create rollback scripts
    - _Estimated: 45 minutes_

  - [ ] 33.3 Set up monitoring
    - Add health check endpoint
    - Add metrics collection
    - Add error tracking
    - Add performance monitoring
    - Configure alerts
    - _Estimated: 1.5 hours_

  - [ ] 33.4 Create deployment script
    - Create `scripts/deploy-fase3.sh`
    - Include all deployment steps
    - Include verification steps
    - Include rollback trigger
    - _Estimated: 1 hour_

- [ ] 34. Final Checkpoint - FASE 3 Complete
  - Verify all 23 correctness properties tested
  - Verify all acceptance criteria met
  - Verify all performance targets met
  - Verify all security requirements met
  - Verify all documentation complete
  - Run final deployment checklist
  - Ask user for final approval

---

## Notes

### Task Marking Convention
- `[ ]` - Not started
- `[x]` - Completed
- `[ ]*` - Optional task (can be skipped for faster MVP)

### Property-Based Testing
- All property tests marked with `*` are optional but highly recommended
- Each property test should run 100+ iterations
- Each property test must reference its design document property number
- Tag format: `Feature: kds-stations-real-time-integration, Property {N}: {description}`

### Dependencies
- Tasks must be completed in order within each day
- Days can overlap if resources available
- Week 2 depends on Week 1 completion
- Week 3 depends on Week 2 completion

### Estimated Total Effort
- **Week 1:** 5 days (40 hours) - Fundamentos
- **Week 2:** 5 days (40 hours) - Analytics & Visualización
- **Week 3:** 3 days (24 hours) - Testing & Polish
- **Total:** 13 days (104 hours)

### Success Criteria
- ✅ All simulated data replaced with real database queries
- ✅ WebSocket delivering updates in < 50ms
- ✅ Charts rendering in < 200ms
- ✅ Heatmap loading in < 300ms
- ✅ PDF export completing in < 3 seconds
- ✅ Excel export handling 10,000+ rows efficiently
- ✅ 85%+ code coverage across all components
- ✅ All 23 correctness properties validated
- ✅ Zero data inconsistencies between UI and database

---

**Document Version:** 1.0  
**Created:** 22 Enero 2026  
**Status:** Ready for Execution  
**Next Step:** Begin Day 1 - Database Updates
