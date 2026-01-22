# Requirements: KDS Stations Real-Time Integration & Analytics (FASE 3)

**Feature Name:** kds-stations-real-time-integration  
**Created:** 22 Enero 2026  
**Status:** Planning  
**Priority:** High  
**Estimated Effort:** 13 days (2.5 weeks)

---

## 1. Overview

Integrate the KDS Stations management page (`/admin/estaciones`) with real-time data from the database, add historical analytics with charts and heatmaps, and implement report export functionality.

**Current State:**
- ✅ FASE 1: Visual improvements with simulated data
- ✅ FASE 2: Advanced functionality (alerts, orders modal) with simulated data
- ⏳ FASE 3: Real data integration + Analytics + Export (THIS SPEC)

**Goal:**
Transform the admin/estaciones page from a visual prototype to a complete real-time monitoring and analytics system with:
1. Real database queries replacing all simulated data
2. WebSocket for live updates
3. Historical trend charts (line, bar, area)
4. Activity heatmap (7 days x 24 hours)
5. Station comparison view
6. PDF and Excel export capabilities

---

## 2. User Stories

### 2.1 As a Restaurant Manager
**I want to** see real-time metrics for each KDS station  
**So that** I can monitor kitchen performance and identify bottlenecks

**Acceptance Criteria:**
- AC 2.1.1: Active orders count reflects actual orders in the database
- AC 2.1.2: Average preparation time is calculated from completed orders
- AC 2.1.3: Efficiency percentage is based on orders completed within estimated time
- AC 2.1.4: Load percentage reflects current orders vs station capacity
- AC 2.1.5: Metrics update automatically every 5 seconds via WebSocket

### 2.2 As a Restaurant Manager
**I want to** view actual active orders for each station  
**So that** I can see which tables are waiting and how long

**Acceptance Criteria:**
- AC 2.2.1: Orders modal shows real orders from the database
- AC 2.2.2: Each order displays correct table number, items count, and wait time
- AC 2.2.3: Order status reflects actual item status (PENDING/COOKING/READY)
- AC 2.2.4: Orders are sorted by wait time (most urgent first)
- AC 2.2.5: Order list updates in real-time when status changes

### 2.3 As a Restaurant Manager
**I want to** receive automatic alerts when stations are underperforming  
**So that** I can take corrective action immediately

**Acceptance Criteria:**
- AC 2.3.1: Alert generated when average time exceeds station's estimated_time by 50%
- AC 2.3.2: Alert generated when active orders exceed 80% of capacity
- AC 2.3.3: Alert generated when efficiency drops below 70%
- AC 2.3.4: Alerts show correct severity level (high/medium/low)
- AC 2.3.5: Alerts can be dismissed and are persisted in database

### 2.4 As a Restaurant Manager
**I want to** configure estimated preparation time for each station  
**So that** the system can calculate accurate performance metrics

**Acceptance Criteria:**
- AC 2.4.1: Estimated time is saved to database when editing station
- AC 2.4.2: Estimated time is used for efficiency calculations
- AC 2.4.3: Estimated time is used for alert thresholds
- AC 2.4.4: Default estimated time is 10 minutes for new stations
- AC 2.4.5: Estimated time can be between 1-60 minutes

### 2.5 As a Restaurant Manager
**I want to** see global statistics across all stations  
**So that** I can understand overall kitchen performance

**Acceptance Criteria:**
- AC 2.5.1: Active stations count shows stations with is_active=true
- AC 2.5.2: Total active orders aggregates orders across all stations
- AC 2.5.3: Average time is calculated across all active stations
- AC 2.5.4: Global efficiency is weighted average of all stations
- AC 2.5.5: Statistics update in real-time via WebSocket

---

## 3. Technical Requirements

### 3.1 Database Schema Updates

**Add estimated_time to stations table:**
```sql
ALTER TABLE stations 
ADD COLUMN estimated_time INTEGER DEFAULT 10;
```

**Create alerts table:**
```sql
CREATE TABLE station_alerts (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP
);
```

### 3.2 API Endpoints

**Real-Time Metrics:**

**GET /api/admin/stations/:id/metrics**
- Returns real-time metrics for a specific station
- Response: `{ activeOrders, avgTime, efficiency, load }`

**GET /api/admin/stations/:id/orders**
- Returns active orders for a specific station
- Response: `{ orders: [{ id, tableNumber, items, waitTime, status }] }`

**GET /api/admin/stations/alerts**
- Returns active (non-dismissed) alerts
- Response: `{ alerts: [{ id, station, message, severity, timestamp }] }`

**POST /api/admin/stations/alerts/:id/dismiss**
- Marks an alert as dismissed
- Response: `{ success: true }`

**PUT /api/admin/stations/:id**
- Update station including estimated_time
- Body: `{ name?, is_active?, estimated_time? }`

**Historical Analytics:**

**GET /api/admin/stations/:id/trends**
- Returns historical trend data for charts
- Query params: `?metric=avgTime|efficiency|orders&period=7d|30d`
- Response: `{ data: [{ date, value }] }`

**GET /api/admin/stations/:id/heatmap**
- Returns activity heatmap data
- Query params: `?days=7`
- Response: `{ data: [{ day, hour, orderCount, avgTime }] }`

**GET /api/admin/stations/compare**
- Returns comparison data for multiple stations
- Query params: `?stations=id1,id2,id3&period=7d`
- Response: `{ stations: [{ id, metrics }] }`

**Export:**

**POST /api/admin/stations/export/pdf**
- Generates PDF report
- Body: `{ stationIds, dateRange }`
- Response: PDF file download

**POST /api/admin/stations/export/excel**
- Generates Excel report
- Body: `{ stationIds, dateRange }`
- Response: Excel file download

### 3.3 WebSocket Integration

**WebSocket endpoint:** `ws://localhost:3000/api/stations/live`

**Message types:**
- `metrics_update`: Station metrics changed
- `order_update`: Order status changed
- `alert_created`: New alert generated
- `alert_dismissed`: Alert was dismissed

**Client subscription:**
```typescript
ws.send(JSON.stringify({
  type: 'subscribe',
  stations: ['station-id-1', 'station-id-2']
}));
```

### 3.4 Performance Requirements

- PR 3.4.1: Metrics calculation must complete in < 100ms
- PR 3.4.2: WebSocket messages must be delivered in < 50ms
- PR 3.4.3: Orders query must support pagination (max 50 orders per request)
- PR 3.4.4: Alert generation must not block order processing
- PR 3.4.5: Database queries must use appropriate indices
- PR 3.4.6: Chart data queries must complete in < 200ms
- PR 3.4.7: Heatmap data must be pre-aggregated for fast retrieval
- PR 3.4.8: PDF export must complete in < 3 seconds
- PR 3.4.9: Excel export must handle 10,000+ rows efficiently

### 3.5 Chart Library Configuration

**Recharts Setup:**
```bash
npm install recharts
npm install --save-dev @types/recharts
```

**Chart Types:**
1. **LineChart** - Trend over time (avg time, efficiency)
2. **BarChart** - Orders per hour comparison
3. **AreaChart** - Cumulative metrics over time
4. **ComposedChart** - Multiple metrics on same chart

**Chart Features:**
- Responsive design (adapts to container width)
- Interactive tooltips with formatted values
- Legend with toggle visibility
- Grid lines for readability
- Color-coded by performance (green/yellow/red)
- Export chart as PNG image

### 3.6 Heatmap Implementation

**Data Structure:**
```typescript
interface HeatmapCell {
  day: string;        // 'Monday', 'Tuesday', etc.
  hour: number;       // 0-23
  orderCount: number; // Number of orders
  avgTime: number;    // Average prep time in minutes
  intensity: number;  // 0-100 for color scale
}
```

**Color Scale:**
- 0-20%: `#10b981` (green) - Low activity
- 21-40%: `#84cc16` (lime) - Below average
- 41-60%: `#eab308` (yellow) - Average
- 61-80%: `#f97316` (orange) - Above average
- 81-100%: `#ef4444` (red) - High activity

**Interaction:**
- Hover shows tooltip with exact metrics
- Click opens detailed view for that time slot
- Supports zoom to focus on specific days

### 3.7 Export Services

**PDF Export Structure:**
```
Page 1: Executive Summary
- Station overview
- Key metrics (current values)
- Performance indicators

Page 2-N: Detailed Charts
- Trend charts (one per page)
- Heatmap visualization
- Comparison tables

Last Page: Raw Data Tables
- Orders summary
- Alerts history
- Performance statistics
```

**Excel Export Structure:**
```
Sheet 1: Summary
- Station information
- Current metrics
- Date range

Sheet 2: Hourly Metrics
- Timestamp, Orders, Avg Time, Efficiency

Sheet 3: Daily Aggregates
- Date, Total Orders, Avg Time, Efficiency

Sheet 4: Alerts History
- Timestamp, Severity, Message, Status

Sheet 5: Orders Detail
- Order ID, Table, Items, Wait Time, Status
```

---

## 4. Data Calculations

### 4.1 Active Orders Count
```sql
SELECT COUNT(*) 
FROM sale_items si
JOIN sales s ON si.sale_id = s.id
WHERE si.station_code = :stationCode
  AND si.status IN ('PENDING', 'COOKING')
  AND s.status != 'VOIDED';
```

### 4.2 Average Preparation Time
```sql
SELECT AVG(
  EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
) as avg_minutes
FROM sale_items si
WHERE si.station_code = :stationCode
  AND si.status = 'READY'
  AND si.completed_at >= NOW() - INTERVAL '24 hours';
```

### 4.3 Efficiency Percentage
```sql
SELECT 
  COUNT(CASE 
    WHEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60 <= st.estimated_time 
    THEN 1 
  END) * 100.0 / COUNT(*) as efficiency
FROM sale_items si
JOIN stations st ON si.station_code = st.code
WHERE si.station_code = :stationCode
  AND si.status = 'READY'
  AND si.completed_at >= NOW() - INTERVAL '24 hours';
```

### 4.4 Load Percentage
```sql
-- Assuming max capacity is 15 orders per station
SELECT (COUNT(*) * 100.0 / 15) as load_percentage
FROM sale_items si
WHERE si.station_code = :stationCode
  AND si.status IN ('PENDING', 'COOKING');
```

### 4.5 Trend Data (Historical)
```sql
-- Average time per day for last 30 days
SELECT 
  DATE(si.completed_at) as date,
  AVG(EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60) as avg_minutes
FROM sale_items si
WHERE si.station_code = :stationCode
  AND si.status = 'READY'
  AND si.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(si.completed_at)
ORDER BY date;
```

### 4.6 Heatmap Data
```sql
-- Orders per hour per day of week for last 7 days
SELECT 
  TO_CHAR(si.created_at, 'Day') as day_name,
  EXTRACT(DOW FROM si.created_at) as day_of_week,
  EXTRACT(HOUR FROM si.created_at) as hour,
  COUNT(*) as order_count,
  AVG(EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60) as avg_time
FROM sale_items si
WHERE si.station_code = :stationCode
  AND si.created_at >= NOW() - INTERVAL '7 days'
GROUP BY day_name, day_of_week, hour
ORDER BY day_of_week, hour;
```

### 4.7 Hourly Orders (for Bar Chart)
```sql
-- Orders completed per hour for current day
SELECT 
  EXTRACT(HOUR FROM si.completed_at) as hour,
  COUNT(*) as orders_completed
FROM sale_items si
WHERE si.station_code = :stationCode
  AND si.status = 'READY'
  AND DATE(si.completed_at) = CURRENT_DATE
GROUP BY hour
ORDER BY hour;
```

### 4.8 Comparison Data
```sql
-- Compare multiple stations
SELECT 
  st.code,
  st.name,
  COUNT(CASE WHEN si.status IN ('PENDING', 'COOKING') THEN 1 END) as active_orders,
  AVG(CASE 
    WHEN si.status = 'READY' 
    THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60 
  END) as avg_time,
  COUNT(CASE 
    WHEN si.status = 'READY' 
      AND EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60 <= st.estimated_time 
    THEN 1 
  END) * 100.0 / NULLIF(COUNT(CASE WHEN si.status = 'READY' THEN 1 END), 0) as efficiency
FROM stations st
LEFT JOIN sale_items si ON si.station_code = st.code
  AND si.created_at >= NOW() - INTERVAL '24 hours'
WHERE st.id = ANY(:stationIds)
GROUP BY st.code, st.name, st.estimated_time;
```

---

## 5. Alert Rules

### 5.1 High Severity Alerts
- Average time > estimated_time * 1.5
- Load > 90%
- Efficiency < 60%

### 5.2 Medium Severity Alerts
- Average time > estimated_time * 1.2
- Load > 80%
- Efficiency < 70%
- Active orders > 12

### 5.3 Low Severity Alerts
- Average time > estimated_time
- Load > 60%
- Efficiency < 85%

---

## 6. Non-Functional Requirements

### 6.1 Scalability
- NFR 6.1.1: System must handle 5 stations with 15 orders each
- NFR 6.1.2: WebSocket must support 10 concurrent admin connections
- NFR 6.1.3: Metrics calculation must scale to 100+ orders per station

### 6.2 Reliability
- NFR 6.2.1: WebSocket must auto-reconnect on connection loss
- NFR 6.2.2: Fallback to polling if WebSocket unavailable
- NFR 6.2.3: Alert generation must be idempotent

### 6.3 Security
- NFR 6.3.1: WebSocket connections require admin authentication
- NFR 6.3.2: Station metrics only visible to authenticated admins
- NFR 6.3.3: Alert dismissal requires admin role

---

## 7. Additional Features (FASE 3 Extended)

### 7.1 Historical Trend Charts

**User Story 7.1:**
As a Restaurant Manager, I want to see historical performance trends for each station, so that I can identify patterns and optimize operations.

**Acceptance Criteria:**
- AC 7.1.1: Line chart showing average preparation time over last 7 days
- AC 7.1.2: Bar chart showing orders completed per hour for current day
- AC 7.1.3: Area chart showing efficiency percentage over last 30 days
- AC 7.1.4: Charts are interactive with tooltips showing exact values
- AC 7.1.5: Charts support date range selection (today, 7 days, 30 days)
- AC 7.1.6: Charts use Recharts library for consistency
- AC 7.1.7: Chart data is cached for 5 minutes to reduce load

### 7.2 Activity Heatmap

**User Story 7.2:**
As a Restaurant Manager, I want to see a heatmap of station activity by hour and day, so that I can identify peak times and plan staffing accordingly.

**Acceptance Criteria:**
- AC 7.2.1: Heatmap shows 7 days (rows) x 24 hours (columns)
- AC 7.2.2: Color intensity represents order volume (light = low, dark = high)
- AC 7.2.3: Clicking a cell shows detailed metrics for that hour
- AC 7.2.4: Heatmap supports station filtering (all stations or specific one)
- AC 7.2.5: Color scale is consistent across all stations
- AC 7.2.6: Heatmap updates daily at midnight

### 7.3 Export Reports

**User Story 7.3:**
As a Restaurant Manager, I want to export station performance reports, so that I can share insights with ownership and analyze offline.

**Acceptance Criteria:**
- AC 7.3.1: Export button generates PDF report with all metrics
- AC 7.3.2: PDF includes charts, tables, and summary statistics
- AC 7.3.3: Export button generates Excel file with raw data
- AC 7.3.4: Excel includes separate sheets for metrics, orders, and alerts
- AC 7.3.5: Reports include date range and generation timestamp
- AC 7.3.6: Export respects user's date range selection

### 7.4 Comparative Analytics

**User Story 7.4:**
As a Restaurant Manager, I want to compare performance between stations, so that I can identify best practices and underperformers.

**Acceptance Criteria:**
- AC 7.4.1: Side-by-side comparison view for 2-5 stations
- AC 7.4.2: Comparison includes all key metrics (orders, time, efficiency)
- AC 7.4.3: Visual indicators show which station is performing better
- AC 7.4.4: Comparison supports custom date ranges
- AC 7.4.5: Comparison can be exported as PDF

## 8. Out of Scope (Future Phases)

- ❌ Push notifications to mobile devices (FASE 4)
- ❌ SMS/WhatsApp alerts (FASE 4)
- ❌ Machine learning predictions (FASE 5)
- ❌ Mobile app for managers (FASE 5)
- ❌ Integration with inventory system (FASE 5)

---

## 8. Dependencies

- Existing Event Sourcing system for order events
- Prisma schema with stations and sale_items tables
- WebSocket infrastructure (needs implementation)
- Admin authentication system (already exists)
- **Recharts library** for charts and visualizations
- **jsPDF library** for PDF generation
- **ExcelJS library** for Excel export

---

## 9. Success Metrics

**Real-Time Integration:**
- ✅ All simulated data replaced with real database queries
- ✅ WebSocket delivering updates in < 50ms
- ✅ Metrics accuracy validated against manual calculations
- ✅ Zero data inconsistencies between UI and database
- ✅ Admin users can monitor kitchen in real-time

**Analytics & Visualization:**
- ✅ Charts render in < 200ms with 30 days of data
- ✅ Heatmap displays 7 days x 24 hours without lag
- ✅ PDF export completes in < 3 seconds
- ✅ Excel export handles 10,000+ rows efficiently
- ✅ Comparative view supports up to 5 stations simultaneously

---

## 10. Migration Plan

### Phase 1: Database Updates (Day 1)
1. Add estimated_time column to stations table
2. Create station_alerts table
3. Add indices for performance
4. Create materialized views for analytics

### Phase 2: Real-Time API Implementation (Day 2-3)
1. Implement metrics calculation endpoints
2. Implement orders listing endpoint
3. Implement alerts CRUD endpoints
4. Add caching layer with Redis

### Phase 3: WebSocket Integration (Day 4)
1. Set up WebSocket server
2. Implement subscription mechanism
3. Implement event broadcasting
4. Add reconnection logic

### Phase 4: Frontend Real-Time Integration (Day 5)
1. Replace simulated data with API calls
2. Integrate WebSocket client
3. Add error handling and fallbacks
4. Update UI components

### Phase 5: Analytics API Implementation (Day 6-7)
1. Implement trends endpoint with aggregations
2. Implement heatmap endpoint
3. Implement comparison endpoint
4. Optimize queries with indices

### Phase 6: Charts & Visualizations (Day 8-9)
1. Install Recharts library
2. Create TrendChart component (line, bar, area)
3. Create Heatmap component
4. Create ComparisonView component
5. Add date range selector
6. Add chart interactions (tooltips, zoom)

### Phase 7: Export Functionality (Day 10)
1. Install jsPDF and ExcelJS
2. Implement PDF export service
3. Implement Excel export service
4. Create export UI components
5. Add download progress indicators

### Phase 8: Testing & Validation (Day 11-12)
1. Unit tests for calculations
2. Integration tests for WebSocket
3. E2E tests for real-time updates
4. Performance testing under load
5. Visual regression tests for charts
6. Export validation tests

### Phase 9: Documentation & Polish (Day 13)
1. Update user documentation
2. Create admin training guide
3. Performance optimization
4. UI/UX refinements
5. Accessibility improvements

---

**Estimated Timeline:** 13 days (2.5 weeks)  
**Team Size:** 1-2 developers  
**Complexity:** Medium-High

---

**Next Steps:**
1. Review and approve requirements
2. Create design document with architecture
3. Create implementation tasks
4. Begin Phase 1 implementation


---

## 11. FASE 3 Feature Summary

### 🎯 Core Features

| Feature | Description | Priority | Complexity |
|---------|-------------|----------|------------|
| **Real-Time Data** | Replace simulated data with DB queries | 🔴 Critical | Medium |
| **WebSocket** | Live updates for metrics and orders | 🔴 Critical | High |
| **Trend Charts** | Historical performance visualization | 🟡 High | Medium |
| **Heatmap** | Activity patterns by hour/day | 🟡 High | Medium |
| **Comparison** | Side-by-side station analysis | 🟢 Medium | Low |
| **PDF Export** | Generate printable reports | 🟢 Medium | Medium |
| **Excel Export** | Export raw data for analysis | 🟢 Medium | Low |

### 📊 Chart Types

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LINE CHART - Trend Over Time                            │
│    ┌─────────────────────────────────────────────────┐     │
│    │     Avg Prep Time (Last 7 Days)                 │     │
│    │ 15 ┤                                    ╭─╮      │     │
│    │ 12 ┤              ╭─╮           ╭─╮   │ │      │     │
│    │  9 ┤      ╭─╮    │ │    ╭─╮   │ │   │ │      │     │
│    │  6 ┤  ╭─╮ │ │ ╭─╮│ │╭─╮│ │╭─╮│ │╭─╮│ │      │     │
│    │  3 ┤╭─╯ ╰─╯ ╰─╯ ╰╯ ╰╯ ╰╯ ╰╯ ╰╯ ╰╯ ╰╯ ╰╯      │     │
│    │    └─────────────────────────────────────────┘     │
│    │      Mon Tue Wed Thu Fri Sat Sun                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. BAR CHART - Orders Per Hour                             │
│    ┌─────────────────────────────────────────────────┐     │
│    │     Orders Completed Today                       │     │
│    │ 20 ┤                                              │     │
│    │ 15 ┤    ██          ██    ██                     │     │
│    │ 10 ┤    ██    ██    ██    ██    ██              │     │
│    │  5 ┤ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██          │     │
│    │    └─────────────────────────────────────────┘     │
│    │      12 13 14 15 16 17 18 19 20 21 22 (hour)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. HEATMAP - Activity by Day/Hour                          │
│    ┌─────────────────────────────────────────────────┐     │
│    │        0  2  4  6  8 10 12 14 16 18 20 22       │     │
│    │ Mon   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓ ░░       │     │
│    │ Tue   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓ ░░       │     │
│    │ Wed   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓ ░░       │     │
│    │ Thu   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓ ░░       │     │
│    │ Fri   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ██ ▓▓       │     │
│    │ Sat   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ██ ▓▓       │     │
│    │ Sun   ░░ ░░ ░░ ▓▓ ██ ██ ██ ██ ██ ██ ▓▓ ░░       │     │
│    └─────────────────────────────────────────────────┘     │
│    Legend: ░░ Low  ▓▓ Medium  ██ High                      │
└─────────────────────────────────────────────────────────────┘
```

### 🔄 Real-Time Update Flow

```
┌──────────────┐
│   Database   │
│  (PostgreSQL)│
└──────┬───────┘
       │
       │ Event: ORDER_SUBMITTED, ITEM_READY, etc.
       │
       ▼
┌──────────────────┐
│  Event Listener  │
│  (Server-side)   │
└──────┬───────────┘
       │
       │ Calculate Metrics
       │
       ▼
┌──────────────────┐
│  WebSocket       │
│  Broadcaster     │
└──────┬───────────┘
       │
       │ Push Update
       │
       ▼
┌──────────────────┐
│  Admin UI        │
│  (React Client)  │
└──────────────────┘
       │
       │ Update State
       │
       ▼
┌──────────────────┐
│  Charts &        │
│  Visualizations  │
└──────────────────┘
```

### 📦 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Charts** | Recharts | Line, Bar, Area charts |
| **Heatmap** | Custom React + CSS Grid | Activity visualization |
| **PDF** | jsPDF + html2canvas | Report generation |
| **Excel** | ExcelJS | Data export |
| **WebSocket** | ws (Node.js) | Real-time updates |
| **Cache** | Redis | Query optimization |
| **Database** | PostgreSQL + Prisma | Data storage |

### 🎨 UI Components Structure

```
src/app/admin/estaciones/
├── page.tsx                    # Main page (existing)
├── components/
│   ├── StationCard.tsx        # Enhanced card (existing)
│   ├── OrdersModal.tsx        # Orders detail (existing)
│   ├── AlertsPanel.tsx        # Alerts display (existing)
│   ├── TrendChart.tsx         # NEW: Line/Bar/Area charts
│   ├── ActivityHeatmap.tsx    # NEW: Heatmap visualization
│   ├── ComparisonView.tsx     # NEW: Station comparison
│   ├── DateRangeSelector.tsx  # NEW: Date picker
│   └── ExportButtons.tsx      # NEW: PDF/Excel export
└── hooks/
    ├── useStationMetrics.ts   # NEW: Real-time metrics
    ├── useStationOrders.ts    # NEW: Orders data
    ├── useStationAlerts.ts    # NEW: Alerts data
    ├── useStationTrends.ts    # NEW: Historical data
    └── useWebSocket.ts        # NEW: WebSocket connection
```

### 🧪 Testing Strategy

| Test Type | Coverage | Tools |
|-----------|----------|-------|
| **Unit Tests** | Calculations, utilities | Vitest |
| **Integration Tests** | API endpoints, WebSocket | Vitest + Supertest |
| **E2E Tests** | User flows, exports | Playwright |
| **Performance Tests** | Query speed, load testing | k6 |
| **Visual Tests** | Chart rendering | Playwright + Percy |

### 📈 Performance Targets

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Metrics Query | < 100ms | N/A | ⏳ Pending |
| WebSocket Latency | < 50ms | N/A | ⏳ Pending |
| Chart Render | < 200ms | N/A | ⏳ Pending |
| Heatmap Load | < 300ms | N/A | ⏳ Pending |
| PDF Export | < 3s | N/A | ⏳ Pending |
| Excel Export | < 2s | N/A | ⏳ Pending |

---

## 12. Implementation Checklist

### ✅ FASE 1 & 2 (Completed)
- [x] Basic CRUD for stations
- [x] Visual dashboard with simulated data
- [x] Station cards with metrics
- [x] Orders modal
- [x] Alerts system
- [x] Estimated time configuration

### ⏳ FASE 3 (This Spec)

**Real-Time Integration:**
- [ ] Add estimated_time column to database
- [ ] Create station_alerts table
- [ ] Implement metrics calculation API
- [ ] Implement orders listing API
- [ ] Implement alerts API
- [ ] Set up WebSocket server
- [ ] Integrate WebSocket client
- [ ] Replace simulated data with real queries

**Analytics & Charts:**
- [ ] Install Recharts library
- [ ] Create TrendChart component
- [ ] Implement trends API endpoint
- [ ] Add date range selector
- [ ] Create ActivityHeatmap component
- [ ] Implement heatmap API endpoint
- [ ] Create ComparisonView component
- [ ] Implement comparison API endpoint

**Export Functionality:**
- [ ] Install jsPDF and ExcelJS
- [ ] Create PDF export service
- [ ] Create Excel export service
- [ ] Implement export API endpoints
- [ ] Add export UI components
- [ ] Add download progress indicators

**Testing & Polish:**
- [ ] Write unit tests for calculations
- [ ] Write integration tests for APIs
- [ ] Write E2E tests for user flows
- [ ] Performance testing
- [ ] Visual regression tests
- [ ] Documentation updates

---

**Total User Stories:** 9  
**Total Acceptance Criteria:** 60+  
**Estimated Effort:** 13 days  
**Dependencies:** Recharts, jsPDF, ExcelJS, WebSocket  
**Risk Level:** Medium (WebSocket complexity, chart performance)

---

**Next Steps:**
1. ✅ Requirements approved
2. ⏳ Create design.md with architecture
3. ⏳ Create tasks.md with implementation plan
4. ⏳ Begin implementation Phase 1
