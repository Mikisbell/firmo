# Design: KDS Stations Real-Time Integration & Analytics (FASE 3)

**Feature Name:** kds-stations-real-time-integration  
**Created:** 22 Enero 2026  
**Status:** Design Phase  
**Priority:** High

---

## 1. Overview

This design document specifies the architecture for transforming the KDS Stations management page from a visual prototype with simulated data into a complete real-time monitoring and analytics system.

### 1.1 Goals

- Replace all simulated data with real database queries
- Implement WebSocket for live updates (< 50ms latency)
- Add historical trend visualization with Recharts
- Create activity heatmap for pattern identification
- Enable station comparison analytics
- Provide PDF and Excel export capabilities

### 1.2 Non-Goals (Out of Scope)

- Push notifications to mobile devices (FASE 4)
- SMS/WhatsApp alerts (FASE 4)
- Machine learning predictions (FASE 5)
- Mobile app for managers (FASE 5)
- Inventory system integration (FASE 5)

### 1.3 Success Criteria

- All metrics calculated from real database data
- WebSocket updates delivered in < 50ms
- Chart rendering completes in < 200ms
- Heatmap loads in < 300ms
- PDF export completes in < 3 seconds
- Excel export handles 10,000+ rows efficiently
- Zero data inconsistencies between UI and database



---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  React Components (Next.js 15)                                   │
│  ├─ StationCard (enhanced with real data)                       │
│  ├─ OrdersModal (real-time order list)                          │
│  ├─ AlertsPanel (database-backed alerts)                        │
│  ├─ TrendChart (Recharts: Line, Bar, Area)                      │
│  ├─ ActivityHeatmap (7x24 grid visualization)                   │
│  ├─ ComparisonView (multi-station analysis)                     │
│  ├─ DateRangeSelector (filter controls)                         │
│  └─ ExportButtons (PDF/Excel generation)                        │
│                                                                   │
│  Custom Hooks                                                     │
│  ├─ useStationMetrics() - Real-time metrics                     │
│  ├─ useStationOrders() - Active orders list                     │
│  ├─ useStationAlerts() - Alert management                       │
│  ├─ useStationTrends() - Historical data                        │
│  ├─ useHeatmapData() - Activity patterns                        │
│  └─ useWebSocket() - Live connection                            │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      WEBSOCKET LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket Server (ws library)                                   │
│  ├─ Connection Manager                                           │
│  ├─ Subscription Handler (station-specific)                     │
│  ├─ Event Broadcaster (metrics, orders, alerts)                 │
│  ├─ Reconnection Logic (exponential backoff)                    │
│  └─ Authentication Middleware (admin-only)                       │
│                                                                   │
│  Message Types:                                                   │
│  • metrics_update - Station metrics changed                      │
│  • order_update - Order status changed                           │
│  • alert_created - New alert generated                           │
│  • alert_dismissed - Alert was dismissed                         │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Internal Events
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  Real-Time Endpoints (Next.js API Routes)                        │
│  ├─ GET /api/admin/stations/:id/metrics                         │
│  ├─ GET /api/admin/stations/:id/orders                          │
│  ├─ GET /api/admin/stations/alerts                              │
│  ├─ POST /api/admin/stations/alerts/:id/dismiss                 │
│  └─ PUT /api/admin/stations/:id (update estimated_time)         │
│                                                                   │
│  Analytics Endpoints                                              │
│  ├─ GET /api/admin/stations/:id/trends?period=7d|30d            │
│  ├─ GET /api/admin/stations/:id/heatmap?days=7                  │
│  └─ GET /api/admin/stations/compare?stations=id1,id2            │
│                                                                   │
│  Export Endpoints                                                 │
│  ├─ POST /api/admin/stations/export/pdf                         │
│  └─ POST /api/admin/stations/export/excel                       │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Queries
┌─────────────────────────────────────────────────────────────────┐
│                        CACHE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Redis Cache Service                                             │
│  ├─ Metrics Cache (TTL: 5 minutes)                              │
│  ├─ Trends Cache (TTL: 1 hour)                                  │
│  ├─ Heatmap Cache (TTL: 1 day)                                  │
│  └─ Comparison Cache (TTL: 15 minutes)                          │
│                                                                   │
│  Cache Invalidation:                                              │
│  • On ORDER_SUBMITTED, ITEM_READY, ITEM_COMPLETED events        │
│  • On station configuration changes                              │
│  • On manual refresh request                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↕ SQL Queries
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL + Prisma ORM                                         │
│                                                                   │
│  Tables:                                                          │
│  ├─ stations (with estimated_time column)                       │
│  ├─ station_alerts (new table)                                  │
│  ├─ sale_items (for metrics calculation)                        │
│  ├─ sales (for order aggregation)                               │
│  └─ events (event sourcing log)                                 │
│                                                                   │
│  Indices:                                                         │
│  ├─ sale_items(station_code, status, created_at)                │
│  ├─ sale_items(station_code, completed_at)                      │
│  ├─ station_alerts(station_id, is_dismissed, created_at)        │
│  └─ sales(status, created_at)                                   │
│                                                                   │
│  Materialized Views (for analytics):                             │
│  ├─ station_hourly_metrics (pre-aggregated hourly data)         │
│  └─ station_daily_summary (pre-aggregated daily data)           │
└─────────────────────────────────────────────────────────────────┘
```



### 2.2 Data Flow Diagrams

#### 2.2.1 Real-Time Metrics Flow

```
┌──────────────┐
│   Kitchen    │
│   Terminal   │
└──────┬───────┘
       │ User marks item as READY
       ▼
┌──────────────────┐
│  Event Sourcing  │
│  ITEM_COMPLETED  │
└──────┬───────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│   PostgreSQL     │                 │  Cache Service   │
│  (sale_items)    │                 │  Invalidate Key  │
└──────┬───────────┘                 └──────────────────┘
       │
       │ Trigger: Calculate Metrics
       ▼
┌──────────────────┐
│  Metrics Service │
│  - Active Orders │
│  - Avg Time      │
│  - Efficiency    │
│  - Load %        │
└──────┬───────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│  Alert Service   │                 │  WebSocket       │
│  Check Rules     │                 │  Broadcaster     │
│  Generate Alert  │                 │  metrics_update  │
└──────┬───────────┘                 └──────┬───────────┘
       │                                     │
       │ If threshold exceeded               │
       ▼                                     ▼
┌──────────────────┐                 ┌──────────────────┐
│  station_alerts  │                 │  Connected       │
│  INSERT new      │                 │  Admin Clients   │
└──────┬───────────┘                 └──────────────────┘
       │                                     │
       │                                     │
       └─────────────────┬───────────────────┘
                         │
                         ▼
                 ┌──────────────────┐
                 │  Admin UI        │
                 │  Update Display  │
                 └──────────────────┘
```

#### 2.2.2 Historical Analytics Flow

```
┌──────────────┐
│  Admin User  │
│  Selects     │
│  Date Range  │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Frontend        │
│  useStationTrends│
└──────┬───────────┘
       │ GET /api/admin/stations/:id/trends?period=30d
       ▼
┌──────────────────┐
│  API Route       │
│  Check Cache     │
└──────┬───────────┘
       │
       ├─── Cache Hit ────────────────┐
       │                              │
       │ Cache Miss                   │
       ▼                              │
┌──────────────────┐                  │
│  Query Builder   │                  │
│  Build SQL       │                  │
└──────┬───────────┘                  │
       │                              │
       ▼                              │
┌──────────────────┐                  │
│  PostgreSQL      │                  │
│  Materialized    │                  │
│  View Query      │                  │
└──────┬───────────┘                  │
       │                              │
       ▼                              │
┌──────────────────┐                  │
│  Data Transform  │                  │
│  Format for      │                  │
│  Recharts        │                  │
└──────┬───────────┘                  │
       │                              │
       ├─── Store in Cache ───────────┤
       │                              │
       └──────────────┬───────────────┘
                      │
                      ▼
              ┌──────────────────┐
              │  Return JSON     │
              │  to Frontend     │
              └──────┬───────────┘
                     │
                     ▼
              ┌──────────────────┐
              │  Recharts        │
              │  Render Chart    │
              └──────────────────┘
```



---

## 3. Database Schema Updates

### 3.1 Add estimated_time to stations

```sql
-- Migration: Add estimated_time column
ALTER TABLE stations 
ADD COLUMN estimated_time INTEGER DEFAULT 10 NOT NULL;

-- Add check constraint
ALTER TABLE stations
ADD CONSTRAINT stations_estimated_time_range 
CHECK (estimated_time >= 1 AND estimated_time <= 60);

-- Add comment
COMMENT ON COLUMN stations.estimated_time IS 
'Estimated preparation time in minutes (1-60). Used for efficiency calculations and alert thresholds.';
```

### 3.2 Create station_alerts table

```sql
-- Migration: Create station_alerts table
CREATE TABLE station_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('avg_time', 'load', 'efficiency')),
  metric_value DECIMAL(10, 2) NOT NULL,
  threshold_value DECIMAL(10, 2) NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  dismissed_at TIMESTAMP,
  dismissed_by TEXT REFERENCES employees(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  
  -- Ensure dismissed_at is set when is_dismissed is true
  CONSTRAINT dismissed_at_required CHECK (
    (is_dismissed = FALSE AND dismissed_at IS NULL) OR
    (is_dismissed = TRUE AND dismissed_at IS NOT NULL)
  )
);

-- Indices for performance
CREATE INDEX idx_station_alerts_station_id ON station_alerts(station_id);
CREATE INDEX idx_station_alerts_is_dismissed ON station_alerts(is_dismissed) WHERE is_dismissed = FALSE;
CREATE INDEX idx_station_alerts_created_at ON station_alerts(created_at DESC);
CREATE INDEX idx_station_alerts_severity ON station_alerts(severity) WHERE is_dismissed = FALSE;
CREATE INDEX idx_station_alerts_tenant_id ON station_alerts(tenant_id);

-- Comments
COMMENT ON TABLE station_alerts IS 'Stores performance alerts for KDS stations';
COMMENT ON COLUMN station_alerts.metric_type IS 'Type of metric that triggered the alert';
COMMENT ON COLUMN station_alerts.metric_value IS 'Actual value of the metric when alert was generated';
COMMENT ON COLUMN station_alerts.threshold_value IS 'Threshold value that was exceeded';
```

### 3.3 Add indices for metrics queries

```sql
-- Optimize metrics calculation queries
CREATE INDEX idx_sale_items_station_metrics ON sale_items(
  station_code, 
  status, 
  created_at DESC
) WHERE status IN ('PENDING', 'COOKING', 'READY');

CREATE INDEX idx_sale_items_completed ON sale_items(
  station_code, 
  completed_at DESC
) WHERE status = 'READY' AND completed_at IS NOT NULL;

CREATE INDEX idx_sale_items_efficiency ON sale_items(
  station_code,
  created_at,
  completed_at
) WHERE status = 'READY';

-- Optimize order listing queries
CREATE INDEX idx_sales_active_orders ON sales(
  status,
  created_at DESC
) WHERE status NOT IN ('COMPLETED', 'VOIDED');
```

### 3.4 Create materialized views for analytics

```sql
-- Hourly aggregated metrics (refreshed every hour)
CREATE MATERIALIZED VIEW station_hourly_metrics AS
SELECT 
  si.station_code,
  DATE_TRUNC('hour', si.created_at) as hour_start,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN si.status = 'READY' THEN 1 END) as completed_orders,
  AVG(
    CASE 
      WHEN si.status = 'READY' AND si.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
    END
  ) as avg_prep_time_minutes,
  st.estimated_time,
  COUNT(
    CASE 
      WHEN si.status = 'READY' 
        AND si.completed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60 <= st.estimated_time
      THEN 1 
    END
  ) * 100.0 / NULLIF(COUNT(CASE WHEN si.status = 'READY' THEN 1 END), 0) as efficiency_percentage
FROM sale_items si
JOIN stations st ON si.station_code = st.code
WHERE si.created_at >= NOW() - INTERVAL '90 days'
GROUP BY si.station_code, DATE_TRUNC('hour', si.created_at), st.estimated_time;

-- Index for fast lookups
CREATE INDEX idx_station_hourly_metrics_lookup ON station_hourly_metrics(
  station_code,
  hour_start DESC
);

-- Daily aggregated metrics (refreshed daily at midnight)
CREATE MATERIALIZED VIEW station_daily_summary AS
SELECT 
  si.station_code,
  DATE(si.created_at) as date,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN si.status = 'READY' THEN 1 END) as completed_orders,
  AVG(
    CASE 
      WHEN si.status = 'READY' AND si.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
    END
  ) as avg_prep_time_minutes,
  MIN(
    CASE 
      WHEN si.status = 'READY' AND si.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
    END
  ) as min_prep_time_minutes,
  MAX(
    CASE 
      WHEN si.status = 'READY' AND si.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60
    END
  ) as max_prep_time_minutes,
  st.estimated_time,
  COUNT(
    CASE 
      WHEN si.status = 'READY' 
        AND si.completed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (si.completed_at - si.created_at)) / 60 <= st.estimated_time
      THEN 1 
    END
  ) * 100.0 / NULLIF(COUNT(CASE WHEN si.status = 'READY' THEN 1 END), 0) as efficiency_percentage
FROM sale_items si
JOIN stations st ON si.station_code = st.code
WHERE si.created_at >= NOW() - INTERVAL '90 days'
GROUP BY si.station_code, DATE(si.created_at), st.estimated_time;

-- Index for fast lookups
CREATE INDEX idx_station_daily_summary_lookup ON station_daily_summary(
  station_code,
  date DESC
);

-- Refresh schedule (run via cron or pg_cron)
-- Hourly: REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics;
-- Daily: REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary;
```



---

## 4. Component Architecture

### 4.1 Frontend Component Structure

```
src/app/admin/estaciones/
├── page.tsx                          # Main page (enhanced)
├── components/
│   ├── StationCard.tsx              # Enhanced with real data
│   ├── OrdersModal.tsx              # Real-time orders list
│   ├── AlertsPanel.tsx              # Database-backed alerts
│   ├── TrendChart.tsx               # NEW: Historical charts
│   ├── ActivityHeatmap.tsx          # NEW: 7x24 heatmap
│   ├── ComparisonView.tsx           # NEW: Multi-station comparison
│   ├── DateRangeSelector.tsx        # NEW: Date filter
│   ├── ExportButtons.tsx            # NEW: PDF/Excel export
│   └── MetricsCard.tsx              # Reusable metric display
├── hooks/
│   ├── useStationMetrics.ts         # NEW: Real-time metrics
│   ├── useStationOrders.ts          # NEW: Orders data
│   ├── useStationAlerts.ts          # NEW: Alerts management
│   ├── useStationTrends.ts          # NEW: Historical data
│   ├── useHeatmapData.ts            # NEW: Heatmap data
│   ├── useWebSocket.ts              # NEW: WebSocket connection
│   └── useExport.ts                 # NEW: Export functionality
├── services/
│   ├── metricsService.ts            # Metrics calculations
│   ├── alertService.ts              # Alert generation logic
│   ├── exportService.ts             # PDF/Excel generation
│   └── websocketService.ts          # WebSocket client
└── types/
    ├── metrics.ts                    # Metrics type definitions
    ├── alerts.ts                     # Alert type definitions
    └── charts.ts                     # Chart data types
```

### 4.2 Component Responsibilities

#### 4.2.1 StationCard (Enhanced)

**Purpose:** Display real-time metrics for a single station

**Props:**
```typescript
interface StationCardProps {
  stationId: string;
  stationCode: string;
  stationName: string;
  estimatedTime: number;
  onEditEstimatedTime: (newTime: number) => void;
}
```

**Data Sources:**
- `useStationMetrics(stationId)` - Real-time metrics via WebSocket
- `useStationAlerts(stationId)` - Active alerts for this station

**Responsibilities:**
- Display active orders count (from database)
- Display average preparation time (calculated)
- Display efficiency percentage (calculated)
- Display load percentage (calculated)
- Show alert badge if alerts exist
- Handle estimated time editing
- Auto-update every 5 seconds via WebSocket

#### 4.2.2 TrendChart (NEW)

**Purpose:** Display historical trend data with Recharts

**Props:**
```typescript
interface TrendChartProps {
  stationId: string;
  metric: 'avgTime' | 'efficiency' | 'orders';
  period: '7d' | '30d' | '90d';
  chartType: 'line' | 'bar' | 'area';
}
```

**Data Sources:**
- `useStationTrends(stationId, metric, period)` - Historical data from API

**Responsibilities:**
- Fetch historical data for selected metric and period
- Render appropriate chart type (Line, Bar, or Area)
- Display interactive tooltips with exact values
- Support date range selection
- Handle loading and error states
- Cache data for 5 minutes

**Chart Configuration:**
```typescript
// Line Chart - Average Time Trend
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={trendData}>
    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
    <XAxis 
      dataKey="date" 
      stroke="#9ca3af"
      tickFormatter={(date) => format(new Date(date), 'MMM dd')}
    />
    <YAxis 
      stroke="#9ca3af"
      label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
    />
    <Tooltip 
      contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
      labelFormatter={(date) => format(new Date(date), 'PPP')}
      formatter={(value: number) => [`${value.toFixed(1)} min`, 'Avg Time']}
    />
    <Legend />
    <Line 
      type="monotone" 
      dataKey="avgTime" 
      stroke="#10b981" 
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />
  </LineChart>
</ResponsiveContainer>
```

#### 4.2.3 ActivityHeatmap (NEW)

**Purpose:** Display activity patterns in a 7x24 grid

**Props:**
```typescript
interface ActivityHeatmapProps {
  stationId?: string; // undefined = all stations
  metric: 'orderCount' | 'avgTime' | 'efficiency';
  days: 7 | 14 | 30;
}
```

**Data Sources:**
- `useHeatmapData(stationId, metric, days)` - Aggregated hourly data

**Responsibilities:**
- Display 7 days x 24 hours grid
- Color-code cells based on intensity
- Show tooltip on hover with exact metrics
- Handle cell click to show detailed view
- Support station filtering
- Support metric switching

**Data Structure:**
```typescript
interface HeatmapCell {
  day: string;          // 'Monday', 'Tuesday', etc.
  dayOfWeek: number;    // 0-6
  hour: number;         // 0-23
  orderCount: number;
  avgTime: number;
  efficiency: number;
  intensity: number;    // 0-100 (normalized for color)
}
```

**Color Scale:**
```typescript
const getColorClass = (intensity: number): string => {
  if (intensity >= 80) return 'bg-red-500';      // High activity
  if (intensity >= 60) return 'bg-orange-500';   // Above average
  if (intensity >= 40) return 'bg-yellow-500';   // Average
  if (intensity >= 20) return 'bg-lime-500';     // Below average
  return 'bg-green-500';                         // Low activity
};
```



#### 4.2.4 ComparisonView (NEW)

**Purpose:** Compare metrics across 2-5 stations

**Props:**
```typescript
interface ComparisonViewProps {
  stationIds: string[];  // 2-5 station IDs
  period: '7d' | '30d';
}
```

**Data Sources:**
- `GET /api/admin/stations/compare?stations=id1,id2&period=7d`

**Responsibilities:**
- Display side-by-side comparison table
- Highlight best and worst performers
- Show visual indicators (🟢🟡🔴)
- Support export as PDF
- Handle 2-5 stations simultaneously

**Comparison Metrics:**
```typescript
interface StationComparison {
  stationId: string;
  stationName: string;
  activeOrders: number;
  avgTime: number;
  efficiency: number;
  load: number;
  totalOrders: number;
  rank: number;  // 1 = best, N = worst
}
```

#### 4.2.5 ExportButtons (NEW)

**Purpose:** Generate PDF and Excel reports

**Props:**
```typescript
interface ExportButtonsProps {
  stationIds: string[];
  dateRange: { start: Date; end: Date };
  includeCharts: boolean;
}
```

**Responsibilities:**
- Generate PDF report with charts and tables
- Generate Excel file with raw data
- Show progress indicator during generation
- Handle download errors
- Support custom date ranges

---

## 5. API Endpoint Specifications

### 5.1 Real-Time Metrics Endpoints

#### GET /api/admin/stations/:id/metrics

**Purpose:** Get current real-time metrics for a station

**Authentication:** Admin only

**Request:**
```typescript
GET /api/admin/stations/station-parrilla/metrics
```

**Response:**
```typescript
{
  stationId: string;
  stationCode: string;
  activeOrders: number;        // Count of PENDING + COOKING items
  avgTime: number;             // Average prep time in minutes (last 24h)
  efficiency: number;          // Percentage of orders within estimated time
  load: number;                // Percentage of capacity used (max 15 orders)
  estimatedTime: number;       // Station's estimated time setting
  lastUpdated: string;         // ISO timestamp
}
```

**Implementation:**
```typescript
// src/app/api/admin/stations/[id]/metrics/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  // Check cache first
  const cached = await redis.get(`station:${id}:metrics`);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }
  
  // Query database
  const station = await prisma.stations.findUnique({
    where: { id },
    select: { code: true, estimated_time: true }
  });
  
  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  }
  
  // Calculate metrics
  const metrics = await calculateStationMetrics(station.code);
  
  // Cache for 5 minutes
  await redis.setex(
    `station:${id}:metrics`,
    300,
    JSON.stringify(metrics)
  );
  
  return NextResponse.json(metrics);
}
```

**Metrics Calculation:**
```typescript
async function calculateStationMetrics(stationCode: string) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Active orders (PENDING + COOKING)
  const activeOrders = await prisma.sale_items.count({
    where: {
      station_code: stationCode,
      status: { in: ['PENDING', 'COOKING'] },
      sale: { status: { not: 'VOIDED' } }
    }
  });
  
  // Average time (last 24 hours, completed orders)
  const completedItems = await prisma.sale_items.findMany({
    where: {
      station_code: stationCode,
      status: 'READY',
      completed_at: { gte: yesterday }
    },
    select: {
      created_at: true,
      completed_at: true
    }
  });
  
  const avgTime = completedItems.length > 0
    ? completedItems.reduce((sum, item) => {
        const prepTime = (item.completed_at!.getTime() - item.created_at.getTime()) / 60000;
        return sum + prepTime;
      }, 0) / completedItems.length
    : 0;
  
  // Efficiency (% within estimated time)
  const station = await prisma.stations.findUnique({
    where: { code: stationCode },
    select: { estimated_time: true }
  });
  
  const onTimeCount = completedItems.filter(item => {
    const prepTime = (item.completed_at!.getTime() - item.created_at.getTime()) / 60000;
    return prepTime <= station!.estimated_time;
  }).length;
  
  const efficiency = completedItems.length > 0
    ? (onTimeCount / completedItems.length) * 100
    : 0;
  
  // Load (% of capacity, assuming max 15 orders)
  const load = (activeOrders / 15) * 100;
  
  return {
    stationCode,
    activeOrders,
    avgTime: Math.round(avgTime * 10) / 10,
    efficiency: Math.round(efficiency),
    load: Math.round(load),
    estimatedTime: station!.estimated_time,
    lastUpdated: now.toISOString()
  };
}
```



#### GET /api/admin/stations/:id/orders

**Purpose:** Get active orders for a station

**Authentication:** Admin only

**Query Parameters:**
- `limit` (optional): Max orders to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```typescript
{
  orders: Array<{
    orderId: string;
    tableNumber: number;
    items: Array<{
      itemId: string;
      productName: string;
      quantity: number;
      status: 'PENDING' | 'COOKING' | 'READY';
    }>;
    waitTime: number;        // Minutes since order created
    status: 'PENDING' | 'COOKING' | 'READY';
    createdAt: string;
  }>;
  total: number;
  hasMore: boolean;
}
```

#### GET /api/admin/stations/alerts

**Purpose:** Get active (non-dismissed) alerts for all stations

**Authentication:** Admin only

**Query Parameters:**
- `stationId` (optional): Filter by station
- `severity` (optional): Filter by severity (high/medium/low)

**Response:**
```typescript
{
  alerts: Array<{
    id: string;
    stationId: string;
    stationName: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    metricType: 'avg_time' | 'load' | 'efficiency';
    metricValue: number;
    thresholdValue: number;
    createdAt: string;
  }>;
  total: number;
}
```

#### POST /api/admin/stations/alerts/:id/dismiss

**Purpose:** Dismiss an alert

**Authentication:** Admin only

**Request Body:**
```typescript
{
  dismissedBy: string;  // Employee ID
}
```

**Response:**
```typescript
{
  success: boolean;
  alert: {
    id: string;
    isDismissed: boolean;
    dismissedAt: string;
    dismissedBy: string;
  };
}
```

### 5.2 Analytics Endpoints

#### GET /api/admin/stations/:id/trends

**Purpose:** Get historical trend data for charts

**Authentication:** Admin only

**Query Parameters:**
- `metric`: 'avgTime' | 'efficiency' | 'orders' (required)
- `period`: '7d' | '30d' | '90d' (required)

**Response:**
```typescript
{
  stationId: string;
  metric: string;
  period: string;
  data: Array<{
    date: string;        // ISO date
    value: number;       // Metric value
  }>;
  summary: {
    average: number;
    min: number;
    max: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}
```

**Implementation:**
```typescript
// Use materialized view for performance
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const metric = searchParams.get('metric');
  const period = searchParams.get('period');
  
  // Check cache
  const cacheKey = `trends:${params.id}:${metric}:${period}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }
  
  // Query materialized view
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const station = await prisma.stations.findUnique({
    where: { id: params.id },
    select: { code: true }
  });
  
  const data = await prisma.$queryRaw`
    SELECT 
      date,
      ${metric === 'avgTime' ? 'avg_prep_time_minutes' : 
        metric === 'efficiency' ? 'efficiency_percentage' : 
        'completed_orders'} as value
    FROM station_daily_summary
    WHERE station_code = ${station!.code}
      AND date >= ${startDate}
    ORDER BY date ASC
  `;
  
  // Calculate summary statistics
  const values = data.map(d => d.value);
  const summary = {
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    trend: calculateTrend(values)
  };
  
  const result = {
    stationId: params.id,
    metric,
    period,
    data,
    summary
  };
  
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(result));
  
  return NextResponse.json(result);
}
```



#### GET /api/admin/stations/:id/heatmap

**Purpose:** Get activity heatmap data (7 days x 24 hours)

**Authentication:** Admin only

**Query Parameters:**
- `days`: 7 | 14 | 30 (default: 7)
- `metric`: 'orderCount' | 'avgTime' | 'efficiency' (default: 'orderCount')

**Response:**
```typescript
{
  stationId: string;
  days: number;
  metric: string;
  data: Array<{
    day: string;          // 'Monday', 'Tuesday', etc.
    dayOfWeek: number;    // 0-6
    hour: number;         // 0-23
    orderCount: number;
    avgTime: number;
    efficiency: number;
    intensity: number;    // 0-100 (normalized)
  }>;
  maxValue: number;       // For normalization
  minValue: number;
}
```

**Implementation:**
```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '7');
  const metric = searchParams.get('metric') || 'orderCount';
  
  // Check cache (1 day TTL)
  const cacheKey = `heatmap:${params.id}:${days}:${metric}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }
  
  const station = await prisma.stations.findUnique({
    where: { id: params.id },
    select: { code: true }
  });
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Query hourly data
  const rawData = await prisma.$queryRaw`
    SELECT 
      TO_CHAR(hour_start, 'Day') as day_name,
      EXTRACT(DOW FROM hour_start) as day_of_week,
      EXTRACT(HOUR FROM hour_start) as hour,
      total_orders as order_count,
      avg_prep_time_minutes as avg_time,
      efficiency_percentage as efficiency
    FROM station_hourly_metrics
    WHERE station_code = ${station!.code}
      AND hour_start >= ${startDate}
    ORDER BY day_of_week, hour
  `;
  
  // Normalize intensity (0-100)
  const values = rawData.map(d => 
    metric === 'orderCount' ? d.order_count :
    metric === 'avgTime' ? d.avg_time :
    d.efficiency
  );
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  
  const data = rawData.map(d => ({
    day: d.day_name.trim(),
    dayOfWeek: d.day_of_week,
    hour: d.hour,
    orderCount: d.order_count,
    avgTime: d.avg_time,
    efficiency: d.efficiency,
    intensity: normalizeIntensity(
      metric === 'orderCount' ? d.order_count :
      metric === 'avgTime' ? d.avg_time :
      d.efficiency,
      minValue,
      maxValue
    )
  }));
  
  const result = {
    stationId: params.id,
    days,
    metric,
    data,
    maxValue,
    minValue
  };
  
  // Cache for 1 day
  await redis.setex(cacheKey, 86400, JSON.stringify(result));
  
  return NextResponse.json(result);
}

function normalizeIntensity(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.round(((value - min) / (max - min)) * 100);
}
```

#### GET /api/admin/stations/compare

**Purpose:** Compare metrics across multiple stations

**Authentication:** Admin only

**Query Parameters:**
- `stations`: Comma-separated station IDs (required, 2-5 stations)
- `period`: '7d' | '30d' (default: '7d')

**Response:**
```typescript
{
  period: string;
  stations: Array<{
    stationId: string;
    stationName: string;
    stationCode: string;
    metrics: {
      activeOrders: number;
      avgTime: number;
      efficiency: number;
      load: number;
      totalOrders: number;
    };
    rank: number;           // 1 = best overall
    bestAt: string[];       // Metrics where this station is best
  }>;
  summary: {
    totalOrders: number;
    avgEfficiency: number;
    bestStation: string;
    worstStation: string;
  };
}
```

### 5.3 Export Endpoints

#### POST /api/admin/stations/export/pdf

**Purpose:** Generate PDF report

**Authentication:** Admin only

**Request Body:**
```typescript
{
  stationIds: string[];
  dateRange: {
    start: string;  // ISO date
    end: string;    // ISO date
  };
  includeCharts: boolean;
  includeHeatmap: boolean;
  includeComparison: boolean;
}
```

**Response:** PDF file download (Content-Type: application/pdf)

**Implementation:**
```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function POST(request: Request) {
  const body = await request.json();
  const { stationIds, dateRange, includeCharts } = body;
  
  // Fetch all required data
  const stations = await fetchStationsData(stationIds, dateRange);
  const trends = includeCharts ? await fetchTrendsData(stationIds, dateRange) : null;
  
  // Generate PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Page 1: Executive Summary
  pdf.setFontSize(20);
  pdf.text('PARK POS - KDS Stations Report', 20, 20);
  pdf.setFontSize(12);
  pdf.text(`Period: ${dateRange.start} to ${dateRange.end}`, 20, 30);
  
  // Add summary statistics
  let y = 50;
  stations.forEach(station => {
    pdf.text(`${station.name}: ${station.metrics.totalOrders} orders`, 20, y);
    y += 10;
  });
  
  // Page 2+: Charts (if included)
  if (includeCharts && trends) {
    pdf.addPage();
    // Render charts to canvas and add to PDF
    // (Implementation details in export service)
  }
  
  // Return PDF as blob
  const pdfBlob = pdf.output('blob');
  return new Response(pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="kds-report-${Date.now()}.pdf"`
    }
  });
}
```

#### POST /api/admin/stations/export/excel

**Purpose:** Generate Excel report

**Authentication:** Admin only

**Request Body:** Same as PDF export

**Response:** Excel file download (Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)

**Implementation:**
```typescript
import ExcelJS from 'exceljs';

export async function POST(request: Request) {
  const body = await request.json();
  const { stationIds, dateRange } = body;
  
  // Fetch data
  const stations = await fetchStationsData(stationIds, dateRange);
  const orders = await fetchOrdersData(stationIds, dateRange);
  const alerts = await fetchAlertsData(stationIds, dateRange);
  
  // Create workbook
  const workbook = new ExcelJS.Workbook();
  
  // Sheet 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Station', key: 'station', width: 20 },
    { header: 'Total Orders', key: 'orders', width: 15 },
    { header: 'Avg Time (min)', key: 'avgTime', width: 15 },
    { header: 'Efficiency (%)', key: 'efficiency', width: 15 }
  ];
  
  stations.forEach(station => {
    summarySheet.addRow({
      station: station.name,
      orders: station.metrics.totalOrders,
      avgTime: station.metrics.avgTime,
      efficiency: station.metrics.efficiency
    });
  });
  
  // Sheet 2: Hourly Metrics
  const metricsSheet = workbook.addWorksheet('Hourly Metrics');
  // ... add hourly data
  
  // Sheet 3: Orders Detail
  const ordersSheet = workbook.addWorksheet('Orders');
  // ... add orders data
  
  // Sheet 4: Alerts
  const alertsSheet = workbook.addWorksheet('Alerts');
  // ... add alerts data
  
  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="kds-report-${Date.now()}.xlsx"`
    }
  });
}
```



---

## 6. WebSocket Protocol Design

### 6.1 WebSocket Server Setup

**Endpoint:** `ws://localhost:3000/api/stations/live`

**Technology:** `ws` library (Node.js WebSocket implementation)

**Server Implementation:**
```typescript
// src/app/api/stations/live/route.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

const wss = new WebSocketServer({ noServer: true });

// Connection manager
const connections = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
  console.log('New WebSocket connection');
  
  // Authenticate connection
  const token = new URL(request.url!, `http://${request.headers.host}`).searchParams.get('token');
  if (!verifyAdminToken(token)) {
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  // Handle messages
  ws.on('message', (data: string) => {
    try {
      const message = JSON.parse(data);
      handleClientMessage(ws, message);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    // Remove from all subscriptions
    connections.forEach(subs => subs.delete(ws));
  });
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected', 
    message: 'WebSocket connection established' 
  }));
});

function handleClientMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case 'subscribe':
      handleSubscribe(ws, message.stations);
      break;
    case 'unsubscribe':
      handleUnsubscribe(ws, message.stations);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function handleSubscribe(ws: WebSocket, stationIds: string[]) {
  stationIds.forEach(stationId => {
    if (!connections.has(stationId)) {
      connections.set(stationId, new Set());
    }
    connections.get(stationId)!.add(ws);
  });
  
  ws.send(JSON.stringify({ 
    type: 'subscribed', 
    stations: stationIds 
  }));
}

function handleUnsubscribe(ws: WebSocket, stationIds: string[]) {
  stationIds.forEach(stationId => {
    connections.get(stationId)?.delete(ws);
  });
  
  ws.send(JSON.stringify({ 
    type: 'unsubscribed', 
    stations: stationIds 
  }));
}

// Broadcast function (called when metrics change)
export function broadcastMetricsUpdate(stationId: string, metrics: any) {
  const subscribers = connections.get(stationId);
  if (!subscribers) return;
  
  const message = JSON.stringify({
    type: 'metrics_update',
    stationId,
    metrics,
    timestamp: new Date().toISOString()
  });
  
  subscribers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
```

### 6.2 Message Types

#### Client → Server Messages

**Subscribe to stations:**
```typescript
{
  type: 'subscribe',
  stations: ['station-id-1', 'station-id-2']
}
```

**Unsubscribe from stations:**
```typescript
{
  type: 'unsubscribe',
  stations: ['station-id-1']
}
```

**Ping (keep-alive):**
```typescript
{
  type: 'ping'
}
```

#### Server → Client Messages

**Connection established:**
```typescript
{
  type: 'connected',
  message: 'WebSocket connection established'
}
```

**Subscription confirmed:**
```typescript
{
  type: 'subscribed',
  stations: ['station-id-1', 'station-id-2']
}
```

**Metrics update:**
```typescript
{
  type: 'metrics_update',
  stationId: 'station-id-1',
  metrics: {
    activeOrders: 12,
    avgTime: 11.5,
    efficiency: 78,
    load: 80
  },
  timestamp: '2026-01-22T14:30:00Z'
}
```

**Order update:**
```typescript
{
  type: 'order_update',
  stationId: 'station-id-1',
  orderId: 'order-123',
  action: 'added' | 'updated' | 'completed',
  order: {
    orderId: 'order-123',
    tableNumber: 15,
    items: [...],
    waitTime: 8,
    status: 'COOKING'
  },
  timestamp: '2026-01-22T14:30:00Z'
}
```

**Alert created:**
```typescript
{
  type: 'alert_created',
  alert: {
    id: 'alert-456',
    stationId: 'station-id-1',
    message: 'Average time exceeds 15 minutes',
    severity: 'high',
    metricType: 'avg_time',
    metricValue: 16.2,
    thresholdValue: 15,
    createdAt: '2026-01-22T14:30:00Z'
  }
}
```

**Alert dismissed:**
```typescript
{
  type: 'alert_dismissed',
  alertId: 'alert-456',
  stationId: 'station-id-1',
  dismissedBy: 'employee-789',
  dismissedAt: '2026-01-22T14:35:00Z'
}
```

**Pong (keep-alive response):**
```typescript
{
  type: 'pong'
}
```

**Error:**
```typescript
{
  type: 'error',
  message: 'Error description',
  code: 'ERROR_CODE'
}
```

### 6.3 Client Implementation

**Custom Hook: useWebSocket**

```typescript
// src/app/admin/estaciones/hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(stationIds: string[]) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);
  
  useEffect(() => {
    if (isConnected && wsRef.current) {
      // Subscribe to stations
      send({
        type: 'subscribe',
        stations: stationIds
      });
    }
  }, [stationIds, isConnected]);
  
  function connect() {
    try {
      const token = localStorage.getItem('adminToken');
      const ws = new WebSocket(`ws://localhost:3000/api/stations/live?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        // Start keep-alive ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Every 30 seconds
        
        ws.addEventListener('close', () => {
          clearInterval(pingInterval);
        });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt reconnection with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`);
          connect();
        }, delay);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }
  
  function disconnect() {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }
  
  function send(message: any) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }
  
  return {
    isConnected,
    lastMessage,
    send
  };
}
```

**Usage in Component:**

```typescript
function StationsDashboard() {
  const [stations, setStations] = useState<Station[]>([]);
  const { isConnected, lastMessage } = useWebSocket(
    stations.map(s => s.id)
  );
  
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);
  
  function handleWebSocketMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'metrics_update':
        updateStationMetrics(message.stationId, message.metrics);
        break;
      case 'order_update':
        updateStationOrders(message.stationId, message.order);
        break;
      case 'alert_created':
        addAlert(message.alert);
        break;
      case 'alert_dismissed':
        removeAlert(message.alertId);
        break;
    }
  }
  
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
      </div>
      {/* ... rest of dashboard */}
    </div>
  );
}
```



---

## 7. State Management

### 7.1 State Architecture

We'll use React hooks and context for state management, avoiding external libraries for simplicity.

**State Layers:**
1. **Server State** - Data from API/WebSocket (cached with React Query pattern)
2. **UI State** - Local component state (filters, modals, selections)
3. **WebSocket State** - Connection status and real-time updates

### 7.2 Custom Hooks for Data Fetching

#### useStationMetrics

```typescript
// src/app/admin/estaciones/hooks/useStationMetrics.ts
import { useState, useEffect } from 'react';

interface StationMetrics {
  stationId: string;
  activeOrders: number;
  avgTime: number;
  efficiency: number;
  load: number;
  estimatedTime: number;
  lastUpdated: string;
}

export function useStationMetrics(stationId: string) {
  const [metrics, setMetrics] = useState<StationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [stationId]);
  
  // Poll every 30 seconds as fallback (WebSocket is primary)
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [stationId]);
  
  async function fetchMetrics() {
    try {
      const response = await fetch(`/api/admin/stations/${stationId}/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }
  
  function updateMetrics(newMetrics: Partial<StationMetrics>) {
    setMetrics(prev => prev ? { ...prev, ...newMetrics } : null);
  }
  
  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
    updateMetrics
  };
}
```

#### useStationTrends

```typescript
// src/app/admin/estaciones/hooks/useStationTrends.ts
import { useState, useEffect } from 'react';

interface TrendData {
  date: string;
  value: number;
}

interface TrendsResponse {
  stationId: string;
  metric: string;
  period: string;
  data: TrendData[];
  summary: {
    average: number;
    min: number;
    max: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}

export function useStationTrends(
  stationId: string,
  metric: 'avgTime' | 'efficiency' | 'orders',
  period: '7d' | '30d' | '90d'
) {
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetchTrends();
  }, [stationId, metric, period]);
  
  async function fetchTrends() {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/stations/${stationId}/trends?metric=${metric}&period=${period}`
      );
      if (!response.ok) throw new Error('Failed to fetch trends');
      const data = await response.json();
      setTrends(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }
  
  return {
    trends,
    loading,
    error,
    refetch: fetchTrends
  };
}
```

### 7.3 WebSocket Integration with State

**Pattern:** WebSocket updates trigger state updates in hooks

```typescript
// In StationsDashboard component
function StationsDashboard() {
  const [stations, setStations] = useState<Station[]>([]);
  const metricsHooks = stations.map(s => useStationMetrics(s.id));
  const { lastMessage } = useWebSocket(stations.map(s => s.id));
  
  useEffect(() => {
    if (lastMessage?.type === 'metrics_update') {
      const { stationId, metrics } = lastMessage;
      const hook = metricsHooks.find(h => h.metrics?.stationId === stationId);
      hook?.updateMetrics(metrics);
    }
  }, [lastMessage]);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stations.map((station, index) => (
        <StationCard
          key={station.id}
          station={station}
          metrics={metricsHooks[index].metrics}
          loading={metricsHooks[index].loading}
        />
      ))}
    </div>
  );
}
```

---

## 8. Error Handling & Fallback Mechanisms

### 8.1 Error Handling Strategy

**Layers of Error Handling:**
1. **API Level** - Catch and log errors, return appropriate HTTP status
2. **Hook Level** - Catch errors, set error state, provide retry mechanism
3. **Component Level** - Display user-friendly error messages
4. **WebSocket Level** - Auto-reconnect with exponential backoff

### 8.2 Fallback Mechanisms

#### WebSocket Fallback to Polling

```typescript
export function useStationMetrics(stationId: string) {
  const { isConnected } = useWebSocket([stationId]);
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  
  useEffect(() => {
    if (!isConnected) {
      // WebSocket disconnected, fall back to polling every 5 seconds
      setPollInterval(5000);
    } else {
      // WebSocket connected, stop polling
      setPollInterval(null);
    }
  }, [isConnected]);
  
  useEffect(() => {
    if (pollInterval) {
      const interval = setInterval(fetchMetrics, pollInterval);
      return () => clearInterval(interval);
    }
  }, [pollInterval]);
  
  // ... rest of hook
}
```

#### Cache Fallback for Analytics

```typescript
// If Redis is unavailable, fall back to direct database query
async function getTrendsData(stationId: string, metric: string, period: string) {
  try {
    // Try cache first
    const cached = await redis.get(`trends:${stationId}:${metric}:${period}`);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.warn('Redis unavailable, querying database directly');
  }
  
  // Fall back to database
  const data = await queryDatabase(stationId, metric, period);
  
  // Try to cache for next time (fail silently if Redis is down)
  try {
    await redis.setex(`trends:${stationId}:${metric}:${period}`, 3600, JSON.stringify(data));
  } catch (error) {
    // Ignore cache write errors
  }
  
  return data;
}
```

### 8.3 Error UI Components

```typescript
// Error boundary for charts
function ChartErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-800 rounded-lg">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-300 mb-2">Failed to load chart</p>
        <button
          onClick={() => setHasError(false)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return <>{children}</>;
}

// Loading skeleton
function MetricsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-gray-700 rounded w-2/3"></div>
    </div>
  );
}
```

### 8.4 Retry Logic

```typescript
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on 4xx errors (client errors)
      if (error instanceof Error && error.message.includes('HTTP 4')) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}
```



---

## 9. Performance Optimization

### 9.1 Database Query Optimization

**Indices Strategy:**
```sql
-- Covering index for metrics calculation
CREATE INDEX idx_sale_items_metrics_covering ON sale_items(
  station_code,
  status,
  created_at,
  completed_at
) INCLUDE (sale_id);

-- Partial index for active orders only
CREATE INDEX idx_sale_items_active ON sale_items(station_code, created_at)
WHERE status IN ('PENDING', 'COOKING');

-- Index for efficiency calculation
CREATE INDEX idx_sale_items_efficiency ON sale_items(
  station_code,
  completed_at,
  created_at
) WHERE status = 'READY' AND completed_at IS NOT NULL;
```

**Query Optimization:**
```typescript
// BAD: Multiple queries
const activeOrders = await prisma.sale_items.count({ where: { ... } });
const completedOrders = await prisma.sale_items.findMany({ where: { ... } });
const avgTime = calculateAverage(completedOrders);

// GOOD: Single aggregation query
const metrics = await prisma.$queryRaw`
  SELECT 
    COUNT(CASE WHEN status IN ('PENDING', 'COOKING') THEN 1 END) as active_orders,
    AVG(CASE 
      WHEN status = 'READY' AND completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 60
    END) as avg_time,
    COUNT(CASE WHEN status = 'READY' THEN 1 END) as completed_count
  FROM sale_items
  WHERE station_code = ${stationCode}
    AND created_at >= ${yesterday}
`;
```

### 9.2 Caching Strategy

**Cache Layers:**
1. **Redis** - Server-side cache (5 min - 1 day TTL)
2. **React Query** - Client-side cache (stale-while-revalidate)
3. **Materialized Views** - Pre-aggregated database cache

**Cache Invalidation:**
```typescript
// Invalidate cache on relevant events
async function handleItemCompleted(event: ItemCompletedEvent) {
  const stationCode = event.payload.stationCode;
  
  // Invalidate metrics cache
  await redis.del(`station:${stationCode}:metrics`);
  
  // Invalidate trends cache (if today's data changed)
  const today = format(new Date(), 'yyyy-MM-dd');
  await redis.del(`trends:${stationCode}:*:${today}`);
  
  // Broadcast update via WebSocket
  broadcastMetricsUpdate(stationCode, await calculateMetrics(stationCode));
}
```

### 9.3 Frontend Optimization

**Code Splitting:**
```typescript
// Lazy load heavy components
const TrendChart = lazy(() => import('./components/TrendChart'));
const ActivityHeatmap = lazy(() => import('./components/ActivityHeatmap'));
const ExportButtons = lazy(() => import('./components/ExportButtons'));

// Use Suspense for loading states
<Suspense fallback={<ChartSkeleton />}>
  <TrendChart stationId={stationId} metric="avgTime" period="7d" />
</Suspense>
```

**Memoization:**
```typescript
// Memoize expensive calculations
const chartData = useMemo(() => {
  return transformDataForChart(rawData);
}, [rawData]);

// Memoize components
const StationCard = memo(({ station, metrics }: StationCardProps) => {
  // ... component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for re-render optimization
  return prevProps.metrics?.lastUpdated === nextProps.metrics?.lastUpdated;
});
```

**Virtualization for Large Lists:**
```typescript
// Use react-window for large order lists
import { FixedSizeList } from 'react-window';

function OrdersList({ orders }: { orders: Order[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={orders.length}
      itemSize={80}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <OrderItem order={orders[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

### 9.4 Bundle Size Optimization

**Tree Shaking:**
```typescript
// Import only what you need from Recharts
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
// NOT: import * as Recharts from 'recharts';

// Import specific date-fns functions
import { format, subDays } from 'date-fns';
// NOT: import * as dateFns from 'date-fns';
```

**Dynamic Imports:**
```typescript
// Load PDF/Excel libraries only when needed
async function exportToPDF() {
  const { jsPDF } = await import('jspdf');
  const html2canvas = await import('html2canvas');
  // ... generate PDF
}

async function exportToExcel() {
  const ExcelJS = await import('exceljs');
  // ... generate Excel
}
```

---

## 10. Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I've identified the following testable properties. I've eliminated redundancy by:
- Combining similar validation checks into comprehensive properties
- Removing properties that are subsumed by others
- Focusing on unique validation value for each property

### 10.1 Metrics Calculation Properties

**Property 1: Active Orders Count Accuracy**  
*For any* station and point in time, the active orders count should equal the number of sale_items with status PENDING or COOKING and sale status not VOIDED.  
**Validates: Requirements 2.1.1, 2.5.2**

**Property 2: Average Time Calculation Correctness**  
*For any* set of completed orders, the average preparation time should equal the sum of (completed_at - created_at) divided by the count of completed orders.  
**Validates: Requirements 2.1.2, 2.5.3**

**Property 3: Efficiency Percentage Accuracy**  
*For any* station with completed orders, the efficiency percentage should equal (count of orders completed within estimated_time / total completed orders) * 100.  
**Validates: Requirements 2.1.3, 2.4.2, 2.5.4**

**Property 4: Load Percentage Calculation**  
*For any* station, the load percentage should equal (active orders / capacity) * 100, where capacity is 15.  
**Validates: Requirements 2.1.4**

### 10.2 Data Integrity Properties

**Property 5: Order Data Completeness**  
*For any* order displayed in the orders modal, it must include table number, items count, wait time, and status fields.  
**Validates: Requirements 2.2.2**

**Property 6: Order Status Consistency**  
*For any* order, its status should correctly reflect the aggregated status of its items (if any item is PENDING, order is PENDING; if all items are READY, order is READY).  
**Validates: Requirements 2.2.3**

**Property 7: Order Sorting Correctness**  
*For any* list of orders sorted by wait time, each order's wait time should be greater than or equal to the next order's wait time.  
**Validates: Requirements 2.2.4**

### 10.3 Alert Generation Properties

**Property 8: Alert Threshold Accuracy**  
*For any* station where avgTime > estimatedTime * 1.5, OR load > 80%, OR efficiency < 70%, an alert should be generated with the correct severity level.  
**Validates: Requirements 2.3.1, 2.3.2, 2.3.3, 2.3.4**

**Property 9: Alert Persistence Round-Trip**  
*For any* alert that is dismissed, marking it as dismissed and then querying it should show is_dismissed=true and dismissed_at timestamp set.  
**Validates: Requirements 2.3.5**

### 10.4 Configuration Properties

**Property 10: Estimated Time Persistence**  
*For any* station, updating its estimated_time and then querying it should return the updated value.  
**Validates: Requirements 2.4.1**

**Property 11: Estimated Time Validation**  
*For any* estimated_time value, values between 1-60 (inclusive) should be accepted, and values outside this range should be rejected.  
**Validates: Requirements 2.4.5**

### 10.5 Analytics Properties

**Property 12: Trend Data Date Range Accuracy**  
*For any* date range selection (7d, 30d, 90d), the returned trend data should only include dates within that range.  
**Validates: Requirements 7.1.5, 7.4.4**

**Property 13: Heatmap Structure Completeness**  
*For any* heatmap query for 7 days, the result should contain exactly 7 * 24 = 168 cells (one for each day-hour combination).  
**Validates: Requirements 7.2.1**

**Property 14: Color Intensity Normalization**  
*For any* two heatmap cells with the same order count, they should have the same color intensity value regardless of which station they belong to.  
**Validates: Requirements 7.2.2, 7.2.5**

**Property 15: Station Filtering Correctness**  
*For any* heatmap filtered by a specific station, all returned data should only include records for that station's code.  
**Validates: Requirements 7.2.4**

### 10.6 Comparison Properties

**Property 16: Comparison Data Completeness**  
*For any* comparison of N stations (2 ≤ N ≤ 5), the result should include all key metrics (activeOrders, avgTime, efficiency, load, totalOrders) for each station.  
**Validates: Requirements 7.4.1, 7.4.2**

**Property 17: Performance Ranking Correctness**  
*For any* two stations in a comparison, the station with higher efficiency should be ranked better (lower rank number).  
**Validates: Requirements 7.4.3**

### 10.7 Export Properties

**Property 18: PDF Content Completeness**  
*For any* generated PDF report, it should contain all specified sections: executive summary, metrics, and (if requested) charts and heatmap.  
**Validates: Requirements 7.3.1, 7.3.2**

**Property 19: Excel Structure Completeness**  
*For any* generated Excel file, it should contain exactly 4 sheets: Summary, Hourly Metrics, Orders, and Alerts.  
**Validates: Requirements 7.3.3, 7.3.4**

**Property 20: Export Metadata Inclusion**  
*For any* generated report (PDF or Excel), it should include the date range and generation timestamp in the metadata or header.  
**Validates: Requirements 7.3.5**

**Property 21: Export Date Filtering**  
*For any* export with a specified date range, all included data should have timestamps within that range.  
**Validates: Requirements 7.3.6, 7.4.4**

### 10.8 Global Statistics Properties

**Property 22: Active Stations Count Accuracy**  
*For any* query for active stations, the count should equal the number of stations with is_active=true.  
**Validates: Requirements 2.5.1**

**Property 23: Global Aggregation Consistency**  
*For any* set of stations, the sum of active orders across all stations should equal the global total active orders.  
**Validates: Requirements 2.5.2**



---

## 11. Testing Strategy

### 11.1 Testing Approach

We will use a **dual testing approach** combining unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both are complementary and necessary for comprehensive coverage

**Balance:**
- Unit tests focus on specific examples and integration points
- Property tests handle comprehensive input coverage through randomization
- Together they provide both concrete bug detection and general correctness verification

### 11.2 Property-Based Testing Configuration

**Library:** `fast-check` (for TypeScript/JavaScript)

**Installation:**
```bash
npm install --save-dev fast-check @types/fast-check
```

**Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: kds-stations-real-time-integration, Property {number}: {property_text}`

**Example Property Test:**
```typescript
// src/app/api/admin/stations/__tests__/metrics.property.test.ts
import fc from 'fast-check';
import { calculateStationMetrics } from '../metrics-service';

describe('Property Tests: Metrics Calculation', () => {
  test('Property 1: Active Orders Count Accuracy', async () => {
    // Feature: kds-stations-real-time-integration, Property 1: Active orders count accuracy
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          id: fc.uuid(),
          station_code: fc.constantFrom('PARRILLA', 'COCINA', 'BAR'),
          status: fc.constantFrom('PENDING', 'COOKING', 'READY'),
          sale_status: fc.constantFrom('OPEN', 'COMPLETED', 'VOIDED'),
          created_at: fc.date(),
          completed_at: fc.option(fc.date())
        })),
        async (saleItems) => {
          // Setup: Insert test data
          await setupTestData(saleItems);
          
          // Calculate metrics
          const metrics = await calculateStationMetrics('PARRILLA');
          
          // Expected: Count of PENDING + COOKING where sale not VOIDED
          const expected = saleItems.filter(item =>
            item.station_code === 'PARRILLA' &&
            (item.status === 'PENDING' || item.status === 'COOKING') &&
            item.sale_status !== 'VOIDED'
          ).length;
          
          // Assert
          expect(metrics.activeOrders).toBe(expected);
          
          // Cleanup
          await cleanupTestData();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  test('Property 3: Efficiency Percentage Accuracy', async () => {
    // Feature: kds-stations-real-time-integration, Property 3: Efficiency percentage accuracy
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          estimatedTime: fc.integer({ min: 1, max: 60 }),
          completedOrders: fc.array(
            fc.record({
              prepTime: fc.integer({ min: 1, max: 120 })
            }),
            { minLength: 1, maxLength: 50 }
          )
        }),
        async ({ estimatedTime, completedOrders }) => {
          // Setup station with estimated time
          await setupStation('TEST', estimatedTime);
          await setupCompletedOrders('TEST', completedOrders);
          
          // Calculate metrics
          const metrics = await calculateStationMetrics('TEST');
          
          // Expected efficiency
          const onTimeCount = completedOrders.filter(
            order => order.prepTime <= estimatedTime
          ).length;
          const expected = (onTimeCount / completedOrders.length) * 100;
          
          // Assert (with tolerance for floating point)
          expect(metrics.efficiency).toBeCloseTo(expected, 1);
          
          // Cleanup
          await cleanupTestData();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 11.3 Unit Testing Strategy

**Focus Areas:**
- Specific edge cases (empty data, null values, boundary conditions)
- Error handling (network failures, invalid inputs, database errors)
- Integration points (API endpoints, WebSocket messages, database queries)
- UI interactions (button clicks, form submissions, modal opens)

**Example Unit Tests:**
```typescript
// src/app/api/admin/stations/__tests__/metrics.test.ts
describe('Unit Tests: Metrics API', () => {
  test('should return 404 for non-existent station', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/stations/invalid-id/metrics'),
      { params: { id: 'invalid-id' } }
    );
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Station not found');
  });
  
  test('should handle empty completed orders gracefully', async () => {
    // Setup station with no completed orders
    await setupStation('TEST', 10);
    
    const metrics = await calculateStationMetrics('TEST');
    
    expect(metrics.avgTime).toBe(0);
    expect(metrics.efficiency).toBe(0);
  });
  
  test('should cache metrics for 5 minutes', async () => {
    const stationId = 'station-test';
    
    // First call - should hit database
    const response1 = await GET(
      new Request(`http://localhost/api/admin/stations/${stationId}/metrics`),
      { params: { id: stationId } }
    );
    
    // Second call - should hit cache
    const response2 = await GET(
      new Request(`http://localhost/api/admin/stations/${stationId}/metrics`),
      { params: { id: stationId } }
    );
    
    // Verify cache was used (check Redis mock)
    expect(redisMock.get).toHaveBeenCalledWith(`station:${stationId}:metrics`);
  });
});
```

### 11.4 Integration Testing

**WebSocket Integration:**
```typescript
// src/app/api/stations/__tests__/websocket.integration.test.ts
describe('Integration Tests: WebSocket', () => {
  test('should broadcast metrics update to subscribed clients', async () => {
    const ws1 = new WebSocket('ws://localhost:3000/api/stations/live?token=admin-token');
    const ws2 = new WebSocket('ws://localhost:3000/api/stations/live?token=admin-token');
    
    await waitForConnection(ws1);
    await waitForConnection(ws2);
    
    // Subscribe both clients to same station
    ws1.send(JSON.stringify({ type: 'subscribe', stations: ['station-1'] }));
    ws2.send(JSON.stringify({ type: 'subscribe', stations: ['station-1'] }));
    
    // Trigger metrics update
    await triggerItemCompleted('station-1');
    
    // Both clients should receive update
    const message1 = await waitForMessage(ws1);
    const message2 = await waitForMessage(ws2);
    
    expect(message1.type).toBe('metrics_update');
    expect(message2.type).toBe('metrics_update');
    expect(message1.stationId).toBe('station-1');
    expect(message2.stationId).toBe('station-1');
  });
  
  test('should reconnect after connection loss', async () => {
    const ws = new WebSocket('ws://localhost:3000/api/stations/live?token=admin-token');
    await waitForConnection(ws);
    
    // Simulate connection loss
    ws.close();
    
    // Wait for reconnection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Should be connected again
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });
});
```

### 11.5 E2E Testing with Playwright

**User Flows:**
```typescript
// e2e/kds-stations-real-time.spec.ts
import { test, expect } from '@playwright/test';

test.describe('KDS Stations Real-Time Integration', () => {
  test('should display real-time metrics updates', async ({ page }) => {
    // Navigate to stations page
    await page.goto('/admin/estaciones');
    
    // Wait for initial load
    await page.waitForSelector('[data-testid="station-card"]');
    
    // Get initial active orders count
    const initialCount = await page.textContent('[data-testid="active-orders"]');
    
    // Trigger order submission in another tab
    const kitchenPage = await page.context().newPage();
    await kitchenPage.goto('/kds/parrilla');
    await kitchenPage.click('[data-testid="mark-ready"]');
    
    // Wait for WebSocket update
    await page.waitForTimeout(1000);
    
    // Verify count updated
    const updatedCount = await page.textContent('[data-testid="active-orders"]');
    expect(updatedCount).not.toBe(initialCount);
  });
  
  test('should display trend charts', async ({ page }) => {
    await page.goto('/admin/estaciones');
    
    // Click on station to open details
    await page.click('[data-testid="station-card-parrilla"]');
    
    // Wait for charts to load
    await page.waitForSelector('[data-testid="trend-chart"]');
    
    // Verify chart is rendered
    const chart = await page.locator('[data-testid="trend-chart"] svg');
    expect(await chart.count()).toBeGreaterThan(0);
  });
  
  test('should export PDF report', async ({ page }) => {
    await page.goto('/admin/estaciones');
    
    // Click export button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-pdf"]')
    ]);
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/kds-report-.*\.pdf/);
    
    // Verify file size (should be > 0)
    const path = await download.path();
    const fs = require('fs');
    const stats = fs.statSync(path);
    expect(stats.size).toBeGreaterThan(0);
  });
});
```

### 11.6 Performance Testing

**Load Testing with k6:**
```javascript
// k6/load-test-metrics.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests < 200ms
  },
};

export default function () {
  const response = http.get('http://localhost:3000/api/admin/stations/station-parrilla/metrics');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has activeOrders': (r) => JSON.parse(r.body).activeOrders !== undefined,
  });
  
  sleep(1);
}
```

### 11.7 Test Coverage Goals

| Component | Unit Tests | Property Tests | Integration Tests | E2E Tests | Target Coverage |
|-----------|------------|----------------|-------------------|-----------|-----------------|
| Metrics Calculation | ✅ | ✅ | ✅ | - | 90%+ |
| API Endpoints | ✅ | ✅ | ✅ | ✅ | 85%+ |
| WebSocket | ✅ | - | ✅ | ✅ | 80%+ |
| Charts/Heatmap | ✅ | ✅ | - | ✅ | 75%+ |
| Export Services | ✅ | ✅ | ✅ | ✅ | 85%+ |
| Alert Generation | ✅ | ✅ | ✅ | - | 90%+ |

**Overall Target:** 85%+ code coverage across all components



---

## 12. Security Considerations

### 12.1 Authentication & Authorization

**Admin-Only Access:**
```typescript
// Middleware for admin routes
export async function requireAdmin(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const session = await verifyToken(token);
  
  if (!session || session.role !== 'ADMIN') {
    return new Response('Forbidden', { status: 403 });
  }
  
  return session;
}

// Usage in API routes
export async function GET(request: Request) {
  const session = await requireAdmin(request);
  if (session instanceof Response) return session;
  
  // ... proceed with admin logic
}
```

**WebSocket Authentication:**
```typescript
// Verify token on WebSocket connection
wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
  const token = new URL(request.url!, `http://${request.headers.host}`)
    .searchParams.get('token');
  
  const session = verifyToken(token);
  
  if (!session || session.role !== 'ADMIN') {
    ws.close(1008, 'Unauthorized');
    return;
  }
  
  // Store session with connection
  wsConnections.set(ws, session);
});
```

### 12.2 Data Access Control

**Tenant Isolation:**
```typescript
// Always filter by tenant_id
async function getStationMetrics(stationId: string, tenantId: string) {
  const station = await prisma.stations.findFirst({
    where: {
      id: stationId,
      tenant_id: tenantId  // CRITICAL: Prevent cross-tenant access
    }
  });
  
  if (!station) {
    throw new Error('Station not found or access denied');
  }
  
  // ... calculate metrics
}
```

**Row-Level Security (PostgreSQL):**
```sql
-- Enable RLS on sensitive tables
ALTER TABLE station_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see alerts for their tenant
CREATE POLICY tenant_isolation ON station_alerts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::text);
```

### 12.3 Input Validation

**API Input Validation:**
```typescript
import { z } from 'zod';

// Schema for updating estimated time
const updateStationSchema = z.object({
  estimated_time: z.number().int().min(1).max(60).optional(),
  is_active: z.boolean().optional()
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  
  // Validate input
  const result = updateStationSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: result.error.issues },
      { status: 400 }
    );
  }
  
  // ... proceed with update
}
```

**SQL Injection Prevention:**
```typescript
// GOOD: Use parameterized queries
const metrics = await prisma.$queryRaw`
  SELECT COUNT(*) as active_orders
  FROM sale_items
  WHERE station_code = ${stationCode}  -- Parameterized
    AND status IN ('PENDING', 'COOKING')
`;

// BAD: String concatenation (vulnerable to SQL injection)
// const query = `SELECT * FROM sale_items WHERE station_code = '${stationCode}'`;
```

### 12.4 Rate Limiting

**API Rate Limiting:**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
});

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Too many requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString()
      }
    });
  }
  
  // ... proceed with request
}
```

### 12.5 Data Sanitization

**XSS Prevention:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user-generated content
function sanitizeAlertMessage(message: string): string {
  return DOMPurify.sanitize(message, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []
  });
}

// Usage
const alert = await prisma.station_alerts.create({
  data: {
    message: sanitizeAlertMessage(userInput.message),
    // ... other fields
  }
});
```

---

## 13. Deployment & Operations

### 13.1 Environment Variables

```bash
# .env.production
DATABASE_URL="postgresql://user:pass@host:5432/parkpos"
REDIS_URL="redis://host:6379"
NEXT_PUBLIC_WS_URL="wss://api.parkpos.com/stations/live"
JWT_SECRET="your-secret-key"
ADMIN_PIN_SALT="your-salt"
```

### 13.2 Database Migrations

**Migration Script:**
```bash
#!/bin/bash
# scripts/migrate-fase3.sh

echo "Running FASE 3 migrations..."

# 1. Add estimated_time column
psql $DATABASE_URL -c "ALTER TABLE stations ADD COLUMN IF NOT EXISTS estimated_time INTEGER DEFAULT 10 NOT NULL;"

# 2. Create station_alerts table
psql $DATABASE_URL -f migrations/create_station_alerts.sql

# 3. Add indices
psql $DATABASE_URL -f migrations/add_metrics_indices.sql

# 4. Create materialized views
psql $DATABASE_URL -f migrations/create_materialized_views.sql

# 5. Refresh materialized views
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW station_hourly_metrics;"
psql $DATABASE_URL -c "REFRESH MATERIALIZED VIEW station_daily_summary;"

echo "Migrations complete!"
```

### 13.3 Monitoring & Observability

**Metrics to Monitor:**
```typescript
// src/core/observability/kds-metrics.ts
import { metrics } from '@/src/core/observability/metrics';

// Track API response times
metrics.histogram('kds_api_duration_ms', {
  endpoint: '/api/admin/stations/:id/metrics',
  method: 'GET'
}, responseTime);

// Track WebSocket connections
metrics.gauge('kds_websocket_connections', {
  status: 'active'
}, activeConnections);

// Track cache hit rate
metrics.counter('kds_cache_hits', {
  cache_type: 'redis',
  key_pattern: 'station:*:metrics'
});

// Track alert generation
metrics.counter('kds_alerts_generated', {
  severity: 'high',
  metric_type: 'avg_time'
});
```

**Health Check Endpoint:**
```typescript
// src/app/api/health/kds/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    websocket: await checkWebSocket(),
    materialized_views: await checkMaterializedViews()
  };
  
  const allHealthy = Object.values(checks).every(c => c.healthy);
  
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString()
    },
    { status: allHealthy ? 200 : 503 }
  );
}
```

### 13.4 Backup & Recovery

**Materialized View Refresh Schedule:**
```sql
-- Using pg_cron extension
SELECT cron.schedule(
  'refresh-station-hourly-metrics',
  '0 * * * *',  -- Every hour
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics$$
);

SELECT cron.schedule(
  'refresh-station-daily-summary',
  '0 0 * * *',  -- Daily at midnight
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary$$
);
```

**Cache Warming:**
```typescript
// Warm cache on deployment
async function warmCache() {
  const stations = await prisma.stations.findMany({
    where: { is_active: true }
  });
  
  for (const station of stations) {
    // Pre-calculate and cache metrics
    const metrics = await calculateStationMetrics(station.code);
    await redis.setex(
      `station:${station.id}:metrics`,
      300,
      JSON.stringify(metrics)
    );
  }
  
  console.log(`Cache warmed for ${stations.length} stations`);
}
```

---

## 14. Migration from FASE 2 to FASE 3

### 14.1 Data Migration

**No data migration needed** - FASE 3 adds new features without breaking existing data.

**New columns have defaults:**
- `stations.estimated_time` defaults to 10 minutes
- `station_alerts` is a new table (empty initially)

### 14.2 Code Migration

**Replace simulated data:**
```typescript
// BEFORE (FASE 2):
const metrics = {
  activeOrders: Math.floor(Math.random() * 15),
  avgTime: Math.floor(Math.random() * 20),
  efficiency: Math.floor(Math.random() * 100),
  load: Math.floor(Math.random() * 100)
};

// AFTER (FASE 3):
const metrics = await fetch(`/api/admin/stations/${stationId}/metrics`)
  .then(res => res.json());
```

**Add WebSocket integration:**
```typescript
// BEFORE (FASE 2):
useEffect(() => {
  const interval = setInterval(fetchMetrics, 5000);
  return () => clearInterval(interval);
}, []);

// AFTER (FASE 3):
const { lastMessage } = useWebSocket([stationId]);

useEffect(() => {
  if (lastMessage?.type === 'metrics_update') {
    updateMetrics(lastMessage.metrics);
  }
}, [lastMessage]);
```

### 14.3 Rollback Plan

**If issues occur:**
1. Revert code deployment
2. Keep database changes (they're additive, not breaking)
3. Materialized views can be dropped if needed:
   ```sql
   DROP MATERIALIZED VIEW IF EXISTS station_hourly_metrics;
   DROP MATERIALIZED VIEW IF EXISTS station_daily_summary;
   ```
4. New table can remain (won't affect FASE 2 functionality):
   ```sql
   -- Optional: Drop if needed
   DROP TABLE IF EXISTS station_alerts;
   ```

---

## 15. Future Enhancements (Post-FASE 3)

### 15.1 FASE 4: Notifications

- Push notifications to mobile devices
- SMS/WhatsApp alerts for critical issues
- Email reports scheduled daily/weekly
- Slack/Discord integration

### 15.2 FASE 5: Advanced Analytics

- Machine learning for demand prediction
- Anomaly detection for unusual patterns
- Capacity planning recommendations
- Staff scheduling optimization

### 15.3 FASE 6: Mobile App

- Native iOS/Android app for managers
- Real-time notifications
- Offline support
- Voice commands

---

## 16. Conclusion

This design document specifies a comprehensive real-time monitoring and analytics system for KDS stations. The architecture prioritizes:

1. **Real-time updates** via WebSocket with polling fallback
2. **Performance** through caching, materialized views, and optimized queries
3. **Reliability** with error handling, reconnection logic, and fallback mechanisms
4. **Security** with admin-only access, tenant isolation, and input validation
5. **Testability** with property-based tests and comprehensive test coverage

The system transforms the KDS Stations page from a visual prototype to a production-ready monitoring tool that provides restaurant managers with actionable insights for optimizing kitchen operations.

**Next Steps:**
1. Review and approve this design document
2. Create tasks.md with implementation plan
3. Begin Phase 1: Database updates and API implementation

---

**Document Version:** 1.0  
**Created:** 22 Enero 2026  
**Status:** Ready for Review  
**Estimated Implementation:** 13 days (2.5 weeks)

