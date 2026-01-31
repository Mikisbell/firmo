-- Migration: Create materialized views for KDS analytics
-- Created: 22 Enero 2026
-- Purpose: Pre-aggregate metrics data for fast historical analytics

-- Note: This system uses JSON items in orders table
-- We'll extract station data from JSON and aggregate by hour/day

-- ============================================================================
-- Hourly Metrics View (refreshed every hour)
-- ============================================================================

CREATE MATERIALIZED VIEW station_hourly_metrics AS
WITH item_data AS (
  SELECT 
    o.tenant_id,
    o.id as order_id,
    o.created_at,
    o.updated_at,
    o.fulfillment_status,
    jsonb_array_elements(o.items::jsonb) as item,
    s.code as station_code,
    s.estimated_time,
    CASE 
      WHEN o.fulfillment_status = 'DELIVERED' AND o.updated_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60
    END as prep_time_minutes
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) as item_elem
  JOIN stations s ON s.tenant_id = o.tenant_id 
    AND s.code = (item_elem->>'station')::text
  WHERE o.created_at >= NOW() - INTERVAL '90 days'
    AND o.order_status != 'CANCELLED'
),
hourly_agg AS (
  SELECT 
    tenant_id,
    station_code,
    DATE_TRUNC('hour', created_at) as hour_start,
    COUNT(DISTINCT order_id) as total_orders,
    COUNT(CASE WHEN fulfillment_status = 'DELIVERED' THEN 1 END) as completed_orders,
    AVG(prep_time_minutes) as avg_prep_time_minutes,
    MAX(estimated_time) as estimated_time
  FROM item_data
  GROUP BY tenant_id, station_code, DATE_TRUNC('hour', created_at)
)
SELECT 
  ha.tenant_id,
  ha.station_code,
  ha.hour_start,
  ha.total_orders,
  ha.completed_orders,
  ha.avg_prep_time_minutes,
  ha.estimated_time,
  COALESCE(
    (SELECT COUNT(*) * 100.0 / NULLIF(ha.completed_orders, 0)
     FROM item_data id
     WHERE id.tenant_id = ha.tenant_id
       AND id.station_code = ha.station_code
       AND DATE_TRUNC('hour', id.created_at) = ha.hour_start
       AND id.fulfillment_status = 'DELIVERED'
       AND id.prep_time_minutes IS NOT NULL
       AND id.prep_time_minutes <= ha.estimated_time
    ),
    0
  ) as efficiency_percentage
FROM hourly_agg ha;

-- Index for fast lookups
CREATE INDEX idx_station_hourly_metrics_lookup ON station_hourly_metrics(
  tenant_id,
  station_code,
  hour_start DESC
);

-- Comments
COMMENT ON MATERIALIZED VIEW station_hourly_metrics IS 
'Pre-aggregated hourly metrics for KDS stations. Refresh every hour with: REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics;';

-- ============================================================================
-- Daily Summary View (refreshed daily at midnight)
-- ============================================================================

CREATE MATERIALIZED VIEW station_daily_summary AS
WITH item_data AS (
  SELECT 
    o.tenant_id,
    o.id as order_id,
    o.created_at,
    o.updated_at,
    o.fulfillment_status,
    o.business_date,
    jsonb_array_elements(o.items::jsonb) as item,
    s.code as station_code,
    s.estimated_time,
    CASE 
      WHEN o.fulfillment_status = 'DELIVERED' AND o.updated_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60
    END as prep_time_minutes
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.items::jsonb) as item_elem
  JOIN stations s ON s.tenant_id = o.tenant_id 
    AND s.code = (item_elem->>'station')::text
  WHERE o.created_at >= NOW() - INTERVAL '90 days'
    AND o.order_status != 'CANCELLED'
    AND o.business_date IS NOT NULL
),
daily_agg AS (
  SELECT 
    tenant_id,
    station_code,
    business_date as date,
    COUNT(DISTINCT order_id) as total_orders,
    COUNT(CASE WHEN fulfillment_status = 'DELIVERED' THEN 1 END) as completed_orders,
    AVG(prep_time_minutes) as avg_prep_time_minutes,
    MIN(prep_time_minutes) as min_prep_time_minutes,
    MAX(prep_time_minutes) as max_prep_time_minutes,
    MAX(estimated_time) as estimated_time
  FROM item_data
  GROUP BY tenant_id, station_code, business_date
)
SELECT 
  da.tenant_id,
  da.station_code,
  da.date,
  da.total_orders,
  da.completed_orders,
  da.avg_prep_time_minutes,
  da.min_prep_time_minutes,
  da.max_prep_time_minutes,
  da.estimated_time,
  COALESCE(
    (SELECT COUNT(*) * 100.0 / NULLIF(da.completed_orders, 0)
     FROM item_data id
     WHERE id.tenant_id = da.tenant_id
       AND id.station_code = da.station_code
       AND id.business_date = da.date
       AND id.fulfillment_status = 'DELIVERED'
       AND id.prep_time_minutes IS NOT NULL
       AND id.prep_time_minutes <= da.estimated_time
    ),
    0
  ) as efficiency_percentage
FROM daily_agg da;

-- Index for fast lookups
CREATE INDEX idx_station_daily_summary_lookup ON station_daily_summary(
  tenant_id,
  station_code,
  date DESC
);

-- Comments
COMMENT ON MATERIALIZED VIEW station_daily_summary IS 
'Pre-aggregated daily metrics for KDS stations. Refresh daily with: REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary;';

-- ============================================================================
-- Refresh Schedule Instructions
-- ============================================================================

-- To refresh hourly (run via cron or pg_cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics;

-- To refresh daily at midnight (run via cron or pg_cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary;

-- Example pg_cron setup:
-- SELECT cron.schedule('refresh-hourly-metrics', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY station_hourly_metrics');
-- SELECT cron.schedule('refresh-daily-summary', '0 0 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY station_daily_summary');
