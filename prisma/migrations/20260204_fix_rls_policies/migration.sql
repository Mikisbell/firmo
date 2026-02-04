-- Fix RLS policies - skip order_items table which doesn't exist
-- This migration enables RLS on all existing tenant-scoped tables

-- ============================================================================
-- STEP 1: Enable RLS on all existing tenant-scoped tables (excluding order_items)
-- ============================================================================

ALTER TABLE admin_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminal_number_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS policies for SELECT operations
-- ============================================================================

-- admin_access_logs
CREATE POLICY admin_access_logs_tenant_select ON admin_access_logs
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- ai_suggestions
CREATE POLICY ai_suggestions_tenant_select ON ai_suggestions
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- attendance
CREATE POLICY attendance_tenant_select ON attendance
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- catalog_meta
CREATE POLICY catalog_meta_tenant_select ON catalog_meta
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- conflict_logs
CREATE POLICY conflict_logs_tenant_select ON conflict_logs
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- coupon_redemptions
CREATE POLICY coupon_redemptions_tenant_select ON coupon_redemptions
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- coupons
CREATE POLICY coupons_tenant_select ON coupons
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- customers
CREATE POLICY customers_tenant_select ON customers
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- daily_sales_summary
CREATE POLICY daily_sales_summary_tenant_select ON daily_sales_summary
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- delivery_orders
CREATE POLICY delivery_orders_tenant_select ON delivery_orders
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- drivers
CREATE POLICY drivers_tenant_select ON drivers
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- employees
CREATE POLICY employees_tenant_select ON employees
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- event_outbox
CREATE POLICY event_outbox_tenant_select ON event_outbox
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- events
CREATE POLICY events_tenant_select ON events
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- goods_receipts
CREATE POLICY goods_receipts_tenant_select ON goods_receipts
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- inventory
CREATE POLICY inventory_tenant_select ON inventory
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- invoices
CREATE POLICY invoices_tenant_select ON invoices
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- orders
CREATE POLICY orders_tenant_select ON orders
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- processed_events
CREATE POLICY processed_events_tenant_select ON processed_events
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- products
CREATE POLICY products_tenant_select ON products
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- promotions
CREATE POLICY promotions_tenant_select ON promotions
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- purchase_orders
CREATE POLICY purchase_orders_tenant_select ON purchase_orders
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- shifts
CREATE POLICY shifts_tenant_select ON shifts
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- stations
CREATE POLICY stations_tenant_select ON stations
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- sync_conflicts
CREATE POLICY sync_conflicts_tenant_select ON sync_conflicts
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- terminal_number_ranges
CREATE POLICY terminal_number_ranges_tenant_select ON terminal_number_ranges
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- terminals
CREATE POLICY terminals_tenant_select ON terminals
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- zones
CREATE POLICY zones_tenant_select ON zones
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid
    OR current_setting('app.is_cross_tenant_admin')::boolean = true);

-- ============================================================================
-- STEP 3: Create RLS policies for INSERT operations
-- ============================================================================

-- admin_access_logs
CREATE POLICY admin_access_logs_tenant_insert ON admin_access_logs
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ai_suggestions
CREATE POLICY ai_suggestions_tenant_insert ON ai_suggestions
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- attendance
CREATE POLICY attendance_tenant_insert ON attendance
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- catalog_meta
CREATE POLICY catalog_meta_tenant_insert ON catalog_meta
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- conflict_logs
CREATE POLICY conflict_logs_tenant_insert ON conflict_logs
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupon_redemptions
CREATE POLICY coupon_redemptions_tenant_insert ON coupon_redemptions
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupons
CREATE POLICY coupons_tenant_insert ON coupons
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- customers
CREATE POLICY customers_tenant_insert ON customers
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- daily_sales_summary
CREATE POLICY daily_sales_summary_tenant_insert ON daily_sales_summary
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- delivery_orders
CREATE POLICY delivery_orders_tenant_insert ON delivery_orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- drivers
CREATE POLICY drivers_tenant_insert ON drivers
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- employees
CREATE POLICY employees_tenant_insert ON employees
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- event_outbox
CREATE POLICY event_outbox_tenant_insert ON event_outbox
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- events
CREATE POLICY events_tenant_insert ON events
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- goods_receipts
CREATE POLICY goods_receipts_tenant_insert ON goods_receipts
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- inventory
CREATE POLICY inventory_tenant_insert ON inventory
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- invoices
CREATE POLICY invoices_tenant_insert ON invoices
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- orders
CREATE POLICY orders_tenant_insert ON orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- processed_events
CREATE POLICY processed_events_tenant_insert ON processed_events
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- products
CREATE POLICY products_tenant_insert ON products
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- promotions
CREATE POLICY promotions_tenant_insert ON promotions
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- purchase_orders
CREATE POLICY purchase_orders_tenant_insert ON purchase_orders
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- shifts
CREATE POLICY shifts_tenant_insert ON shifts
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- stations
CREATE POLICY stations_tenant_insert ON stations
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- sync_conflicts
CREATE POLICY sync_conflicts_tenant_insert ON sync_conflicts
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminal_number_ranges
CREATE POLICY terminal_number_ranges_tenant_insert ON terminal_number_ranges
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminals
CREATE POLICY terminals_tenant_insert ON terminals
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- zones
CREATE POLICY zones_tenant_insert ON zones
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- STEP 4: Create RLS policies for UPDATE operations
-- ============================================================================

-- admin_access_logs
CREATE POLICY admin_access_logs_tenant_update ON admin_access_logs
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ai_suggestions
CREATE POLICY ai_suggestions_tenant_update ON ai_suggestions
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- attendance
CREATE POLICY attendance_tenant_update ON attendance
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- catalog_meta
CREATE POLICY catalog_meta_tenant_update ON catalog_meta
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- conflict_logs
CREATE POLICY conflict_logs_tenant_update ON conflict_logs
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupon_redemptions
CREATE POLICY coupon_redemptions_tenant_update ON coupon_redemptions
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupons
CREATE POLICY coupons_tenant_update ON coupons
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- customers
CREATE POLICY customers_tenant_update ON customers
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- daily_sales_summary
CREATE POLICY daily_sales_summary_tenant_update ON daily_sales_summary
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- delivery_orders
CREATE POLICY delivery_orders_tenant_update ON delivery_orders
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- drivers
CREATE POLICY drivers_tenant_update ON drivers
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- employees
CREATE POLICY employees_tenant_update ON employees
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- event_outbox
CREATE POLICY event_outbox_tenant_update ON event_outbox
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- events
CREATE POLICY events_tenant_update ON events
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- goods_receipts
CREATE POLICY goods_receipts_tenant_update ON goods_receipts
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- inventory
CREATE POLICY inventory_tenant_update ON inventory
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- invoices
CREATE POLICY invoices_tenant_update ON invoices
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- orders
CREATE POLICY orders_tenant_update ON orders
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- processed_events
CREATE POLICY processed_events_tenant_update ON processed_events
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- products
CREATE POLICY products_tenant_update ON products
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- promotions
CREATE POLICY promotions_tenant_update ON promotions
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- purchase_orders
CREATE POLICY purchase_orders_tenant_update ON purchase_orders
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- shifts
CREATE POLICY shifts_tenant_update ON shifts
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- stations
CREATE POLICY stations_tenant_update ON stations
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- sync_conflicts
CREATE POLICY sync_conflicts_tenant_update ON sync_conflicts
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminal_number_ranges
CREATE POLICY terminal_number_ranges_tenant_update ON terminal_number_ranges
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminals
CREATE POLICY terminals_tenant_update ON terminals
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- zones
CREATE POLICY zones_tenant_update ON zones
  FOR UPDATE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- STEP 5: Create RLS policies for DELETE operations
-- ============================================================================

-- admin_access_logs
CREATE POLICY admin_access_logs_tenant_delete ON admin_access_logs
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ai_suggestions
CREATE POLICY ai_suggestions_tenant_delete ON ai_suggestions
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- attendance
CREATE POLICY attendance_tenant_delete ON attendance
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- catalog_meta
CREATE POLICY catalog_meta_tenant_delete ON catalog_meta
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- conflict_logs
CREATE POLICY conflict_logs_tenant_delete ON conflict_logs
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupon_redemptions
CREATE POLICY coupon_redemptions_tenant_delete ON coupon_redemptions
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- coupons
CREATE POLICY coupons_tenant_delete ON coupons
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- customers
CREATE POLICY customers_tenant_delete ON customers
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- daily_sales_summary
CREATE POLICY daily_sales_summary_tenant_delete ON daily_sales_summary
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- delivery_orders
CREATE POLICY delivery_orders_tenant_delete ON delivery_orders
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- drivers
CREATE POLICY drivers_tenant_delete ON drivers
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- employees
CREATE POLICY employees_tenant_delete ON employees
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- event_outbox
CREATE POLICY event_outbox_tenant_delete ON event_outbox
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- events
CREATE POLICY events_tenant_delete ON events
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- goods_receipts
CREATE POLICY goods_receipts_tenant_delete ON goods_receipts
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- inventory
CREATE POLICY inventory_tenant_delete ON inventory
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- invoices
CREATE POLICY invoices_tenant_delete ON invoices
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- orders
CREATE POLICY orders_tenant_delete ON orders
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- processed_events
CREATE POLICY processed_events_tenant_delete ON processed_events
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- products
CREATE POLICY products_tenant_delete ON products
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- promotions
CREATE POLICY promotions_tenant_delete ON promotions
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- purchase_orders
CREATE POLICY purchase_orders_tenant_delete ON purchase_orders
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- shifts
CREATE POLICY shifts_tenant_delete ON shifts
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- stations
CREATE POLICY stations_tenant_delete ON stations
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- sync_conflicts
CREATE POLICY sync_conflicts_tenant_delete ON sync_conflicts
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminal_number_ranges
CREATE POLICY terminal_number_ranges_tenant_delete ON terminal_number_ranges
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- terminals
CREATE POLICY terminals_tenant_delete ON terminals
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- zones
CREATE POLICY zones_tenant_delete ON zones
  FOR DELETE
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
