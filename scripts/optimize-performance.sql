/**
 * Performance Optimization Schema Updates
 * 
 * Adds critical indexes for high-traffic tables
 * Adds missing database constraints
 * Optimizes query performance
 */

-- Indexes for Orders table (most critical performance bottleneck)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_tenant_status_priority 
ON orders (tenant_id, order_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_business_date_tenant 
ON orders (tenant_id, business_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_terminal_created 
ON orders (tenant_id, terminal_id, created_at DESC);

-- Indexes for Events table (high write volume)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tenant_type_date 
ON events (tenant_id, type, occurred_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_entity_performance 
ON events (tenant_id, entity_id, occurred_at DESC);

-- Indexes for Inventory (frequently queried)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_location_tenant 
ON inventory (tenant_id, location_id, code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_expiry_alerts 
ON inventory (tenant_id, expiry_date, is_active) 
WHERE expiry_date IS NOT NULL;

-- Indexes for Sessions (authentication performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_active 
ON sessions (expires_at, revoked_at) 
WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_tenant_employee 
ON sessions (tenant_id, employee_id, last_active DESC);

-- Indexes for Login Attempts (security queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_login_attempts_security 
ON login_attempts (tenant_id, employee_id, success, created_at DESC);

-- Indexes for Products (catalog performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active 
ON products (tenant_id, category, is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_station_active 
ON products (tenant_id, station, is_active);

-- Indexes for Payments/Delivery (2026 features)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_orders_status_driver 
ON delivery_orders (tenant_id, status, driver_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_zones_location_active 
ON delivery_zones (tenant_id, location_id, is_active);

-- Add missing constraints for data integrity
ALTER TABLE orders 
ADD CONSTRAINT IF NOT EXISTS check_total_positive 
CHECK (total_cents >= 0);

ALTER TABLE products 
ADD CONSTRAINT IF NOT EXISTS check_price_positive 
CHECK (price_cents >= 0);

ALTER TABLE inventory 
ADD CONSTRAINT IF NOT EXISTS check_stock_positive 
CHECK (stock >= 0);

-- Create partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active 
ON orders (tenant_id, created_at DESC) 
WHERE order_status NOT IN ('CANCELLED', 'COMPLETED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock 
ON inventory (tenant_id, location_id, stock, min_stock) 
WHERE min_stock IS NOT NULL AND stock <= min_stock;

-- Statistics maintenance query (optimizes dashboard loading)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_summary_stats AS
SELECT 
    tenant_id,
    business_date,
    COUNT(*) as total_orders,
    SUM(total_cents) as total_sales,
    AVG(total_cents) as avg_ticket,
    COUNT(DISTINCT customer_id) as unique_customers
FROM orders 
WHERE order_status = 'COMPLETED'
GROUP BY tenant_id, business_date;

-- Index for materialized view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mv_daily_summary 
ON mv_daily_summary_stats (tenant_id, business_date DESC);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_daily_summary_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_summary_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (if using pg_cron or similar)
-- This would typically be set up via pg_cron or external scheduler