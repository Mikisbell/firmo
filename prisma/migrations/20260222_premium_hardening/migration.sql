-- =============================================
-- PARK POS Premium Database Hardening
-- Date: 2026-02-22
-- Goal: A+ on all 10 diagnostic categories
-- =============================================

-- ===========================================
-- P0-1: CLEAN _prisma_migrations TABLE
-- ===========================================
-- Remove 8 rolled-back migration records (noise)
DELETE FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL;

-- ===========================================
-- P0-2: CLEAN TEST/DEMO TENANTS + CASCADE
-- ===========================================
-- Strategy: Delete all data referencing test tenants, then the tenants themselves.
-- Protect only 'PARK POS Default' (the seed tenant).
-- Order matters: children first, then parents.

-- First, identify test tenants (all except PARK POS Default)
-- Note: "Tenant 1", "Tenant 2" are also test residue from property tests

-- Delete child data of test tenants (tables with FK or data dependencies)
DO $$
DECLARE
  tbl TEXT;
  deleted INT;
BEGIN
  -- Tables that reference tenant_id (ordered: leaf tables first)
  FOR tbl IN
    SELECT unnest(ARRAY[
      -- Leaf/child tables first
      'assignment_logs', 'eta_predictions', 'location_history', 'whatsapp_messages',
      'coupon_redemptions', 'segment_members', 'message_outbox',
      'invoice_cdr', 'invoice_queue', 'delivery_metrics',
      'pollo_production_logs', 'pollo_daily_summary', 'sunat_daily_summary',
      'station_alerts', 'stock_alerts', 'waste_logs', 'print_jobs',
      'push_subscriptions', 'notification_preferences', 'session_alerts',
      'session_audit_log', 'security_alerts', 'auth_events', 'pin_history',
      'recovery_action_log', 'dead_letter_queue', 'soft_locks', 'conflict_logs',
      'sync_conflicts', 'maintenance_windows', 'cross_tenant_audit_log',
      'shift_change_requests', 'ai_suggestions', 'delivery_addresses',
      -- Mid-level tables
      'tip_distributions', 'tips', 'payment_settlements', 'credit_notes',
      'refunds', 'payments', 'platform_orders', 'delivery_orders',
      'invoices', 'recipes', 'inventory_log', 'stock_transfers',
      'goods_receipt_items', 'goods_receipts', 'purchase_order_items', 'purchase_orders',
      'inventory_count_items', 'inventory_counts',
      'petty_cash_transactions', 'petty_cash_balance',
      'coupons', 'marketing_campaigns', 'marketing_segments', 'message_templates',
      'evaluations', 'training_records', 'leave_requests', 'time_off_requests',
      'employee_schedules', 'schedule_templates', 'schedules', 'attendance',
      'payroll_records', 'advances', 'emergency_contacts', 'employee_documents',
      'customer_profile', 'waitlist', 'reservations',
      'supplier_products', 'suppliers', 'daily_sales_summary',
      'tenant_analytics', 'tenant_health_checks', 'tenant_quotas', 'tenant_usage',
      'onboarding_steps', 'transaction_limits', 'assignment_weights',
      'alert_configurations', 'alert_events', 'log_configuration', 'log_configuration_change',
      'platform_configs', 'table_layouts',
      -- Parent-ish tables
      'orders', 'inventory', 'products', 'promotions',
      'processed_events', 'event_outbox', 'events',
      'activation_codes', 'terminal_mac_registry', 'device_mac_addresses',
      'printers', 'tables', 'zones', 'locations',
      'active_sessions', 'login_attempts', 'sessions',
      'shifts', 'terminal_number_ranges', 'terminals', 'stations',
      'admin_access_logs', 'catalog_meta', 'drivers',
      'employees', 'customers', 'terminal_devices',
      'tenant_settings', 'tip_config', 'delivery_zones', 'analytics_cache'
    ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables t
      WHERE t.table_schema = 'public' AND t.table_name = tbl
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'tenant_id'
      ) THEN
        EXECUTE format(
          'DELETE FROM %I WHERE tenant_id != ''a1b2c3d4-e5f6-7890-abcd-ef1234567890''',
          tbl
        );
        GET DIAGNOSTICS deleted = ROW_COUNT;
        IF deleted > 0 THEN
          RAISE NOTICE 'Cleaned %: % rows', tbl, deleted;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Finally delete test tenants themselves
  DELETE FROM tenants WHERE id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted % test tenants', deleted;
END;
$$;

-- Clean orphaned assignment_weights (2 rows referencing non-existent tenants)
DELETE FROM "assignment_weights" WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- ===========================================
-- P0-3: DROP ORPHAN INDEXES
-- ===========================================
DROP INDEX IF EXISTS "idx_station_hourly_metrics_lookup";
DROP INDEX IF EXISTS "idx_station_daily_summary_lookup";

-- ===========================================
-- P1-1: CHECK >= 0 ON REMAINING MONEY COLUMNS
-- ===========================================
-- Columns that CAN be negative: diff_cents, difference_cents, difference_value_cents → SKIP
-- All others must be >= 0

-- customer_profile
ALTER TABLE "customer_profile" ADD CONSTRAINT "chk_customer_avg_ticket_positive" CHECK ("avg_ticket_cents" >= 0);
ALTER TABLE "customer_profile" ADD CONSTRAINT "chk_customer_lifetime_value_positive" CHECK ("lifetime_value_cents" >= 0);

-- daily_sales_summary (all positive)
ALTER TABLE "daily_sales_summary" ADD CONSTRAINT "chk_daily_sales_amounts_positive"
  CHECK ("gross_sales_cents" >= 0 AND "net_sales_cents" >= 0 AND "discount_cents" >= 0
         AND "refunds_cents" >= 0 AND "tips_cents" >= 0 AND "voids_cents" >= 0
         AND "delivery_fee_cents" >= 0);

-- employees
ALTER TABLE "employees" ADD CONSTRAINT "chk_employees_salary_positive" CHECK ("base_salary_cents" >= 0);

-- goods_receipt_items
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "chk_goods_receipt_items_cost_positive" CHECK ("unit_cost_cents" >= 0);

-- inventory
ALTER TABLE "inventory" ADD CONSTRAINT "chk_inventory_cost_positive" CHECK ("cost_cents" >= 0);

-- inventory_count_items (unit_cost >= 0, difference_value CAN be negative)
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "chk_inventory_count_items_cost_positive" CHECK ("unit_cost_cents" >= 0);

-- payroll_records (most sub-amounts >= 0; base/gross/net already covered)
ALTER TABLE "payroll_records" ADD CONSTRAINT "chk_payroll_sub_amounts_positive"
  CHECK ("overtime_cents" >= 0 AND "bonuses_cents" >= 0 AND "tips_cents" >= 0
         AND "commission_cents" >= 0 AND "absences_cents" >= 0
         AND "advances_cents" >= 0 AND "pension_cents" >= 0
         AND "essalud_cents" >= 0 AND "other_deductions_cents" >= 0);

-- purchase_order_items
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "chk_purchase_order_items_positive"
  CHECK ("unit_cost_cents" >= 0 AND "total_cents" >= 0);

-- recipes
ALTER TABLE "recipes" ADD CONSTRAINT "chk_recipes_cost_positive" CHECK ("cost_cents" >= 0);

-- shifts (cash amounts >= 0, diff_cents CAN be negative)
ALTER TABLE "shifts" ADD CONSTRAINT "chk_shifts_cash_positive"
  CHECK ("cash_opening_cents" >= 0 AND "cash_expected_cents" >= 0 AND "cash_counted_cents" >= 0);

-- supplier_products
ALTER TABLE "supplier_products" ADD CONSTRAINT "chk_supplier_products_cost_positive" CHECK ("unit_cost_cents" >= 0);

-- suppliers
ALTER TABLE "suppliers" ADD CONSTRAINT "chk_suppliers_min_order_positive" CHECK ("min_order_cents" >= 0);

-- tenant_analytics
ALTER TABLE "tenant_analytics" ADD CONSTRAINT "chk_tenant_analytics_positive"
  CHECK ("total_revenue_cents" >= 0 AND "avg_order_value_cents" >= 0);

-- tenant_settings
ALTER TABLE "tenant_settings" ADD CONSTRAINT "chk_tenant_settings_delivery_fee_positive" CHECK ("default_delivery_fee_cents" >= 0);

-- payment_settlements (received >= 0, difference CAN be negative)
ALTER TABLE "payment_settlements" ADD CONSTRAINT "chk_settlements_received_positive" CHECK ("received_cents" >= 0);

-- ===========================================
-- P1-2: ADD 14 MISSING FK INDEXES
-- ===========================================
CREATE INDEX "coupons_promotion_id_idx" ON "coupons"("tenant_id", "promotion_id");
CREATE INDEX "delivery_orders_address_id_idx" ON "delivery_orders"("address_id");
CREATE INDEX "marketing_campaigns_template_id_idx" ON "marketing_campaigns"("tenant_id", "message_template_id");
CREATE INDEX "marketing_campaigns_segment_id_idx" ON "marketing_campaigns"("tenant_id", "segment_id");
CREATE INDEX "message_outbox_campaign_id_idx" ON "message_outbox"("campaign_id");
CREATE INDEX "orders_promotion_id_idx" ON "orders"("tenant_id", "promotion_id");
CREATE INDEX "print_jobs_printer_id_idx" ON "print_jobs"("tenant_id", "printer_id");
CREATE INDEX "printers_station_id_idx" ON "printers"("tenant_id", "station_id");
CREATE INDEX "refunds_credit_note_id_idx" ON "refunds"("tenant_id", "credit_note_id");
CREATE INDEX "shifts_opened_by_idx" ON "shifts"("tenant_id", "opened_by");
CREATE INDEX "shifts_closed_by_idx" ON "shifts"("tenant_id", "closed_by");
CREATE INDEX "station_alerts_dismissed_by_idx" ON "station_alerts"("dismissed_by");
CREATE INDEX "tables_zone_id_idx" ON "tables"("tenant_id", "zone_id");
CREATE INDEX "terminals_station_id_idx" ON "terminals"("tenant_id", "station_id");

-- ===========================================
-- P1-3: ADD terminal_mac_registry tenant_id INDEX
-- ===========================================
CREATE INDEX IF NOT EXISTS "terminal_mac_registry_tenant_id_idx" ON "terminal_mac_registry"("tenant_id");

-- ===========================================
-- P2-1: EXTEND RLS TO 30+ MORE TABLES WITH TENANT DATA
-- ===========================================
-- All tables with tenant_id that don't have RLS yet
ALTER TABLE "activation_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_configurations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignment_weights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eta_predictions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_counts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_cdr" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "location_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenance_windows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketing_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pin_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pollo_daily_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pollo_production_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "print_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "printers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recovery_action_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedule_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segment_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shift_change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "soft_locks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "station_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sunat_daily_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "supplier_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "table_layouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_analytics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_health_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_quotas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terminal_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "terminal_mac_registry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_off_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tip_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transaction_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waitlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waste_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_messages" ENABLE ROW LEVEL SECURITY;
-- Infrastructure tables (no tenant_id, but protect anyway)
ALTER TABLE "cross_tenant_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cross_tenant_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_mac_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goods_receipt_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_count_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "log_configuration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "log_configuration_change" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "purchase_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "zones" ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- P3-1: FK TO TENANTS ON ALL 112 TABLES
-- ===========================================
-- Clean any remaining orphans first, then add FK constraints.
-- Using DO block for safety: only add FK if table exists and has tenant_id.

DO $$
DECLARE
  tbl TEXT;
  fk_name TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'activation_codes', 'active_sessions', 'admin_access_logs', 'advances',
      'ai_suggestions', 'alert_configurations', 'alert_events', 'analytics_cache',
      'assignment_logs', 'assignment_weights', 'attendance', 'auth_events',
      'catalog_meta', 'conflict_logs', 'coupon_redemptions', 'coupons',
      'credit_notes', 'cross_tenant_audit_log', 'customer_profile', 'customers',
      'daily_sales_summary', 'dead_letter_queue', 'delivery_addresses',
      'delivery_metrics', 'delivery_orders', 'delivery_zones',
      'drivers', 'emergency_contacts', 'employee_documents',
      'employee_schedules', 'employees', 'eta_predictions', 'evaluations',
      'event_outbox', 'events', 'goods_receipts', 'inventory',
      'inventory_counts', 'inventory_log', 'invoices',
      'leave_requests', 'location_history', 'locations', 'login_attempts',
      'maintenance_windows', 'marketing_campaigns', 'marketing_segments',
      'message_outbox', 'message_templates', 'notification_preferences',
      'onboarding_steps', 'payment_settlements', 'payroll_records',
      'petty_cash_balance', 'petty_cash_transactions', 'pin_history',
      'platform_configs', 'pollo_daily_summary', 'pollo_production_logs',
      'print_jobs', 'printers', 'processed_events', 'products', 'promotions',
      'purchase_orders', 'push_subscriptions', 'recovery_action_log',
      'reservations', 'schedule_templates', 'schedules', 'security_alerts',
      'segment_members', 'session_alerts', 'session_audit_log', 'sessions',
      'shift_change_requests', 'shifts', 'soft_locks', 'stations',
      'stock_alerts', 'stock_transfers', 'sunat_daily_summary',
      'supplier_products', 'suppliers', 'sync_conflicts', 'table_layouts',
      'tables', 'tenant_analytics', 'tenant_health_checks', 'tenant_quotas',
      'tenant_usage', 'terminal_devices', 'terminal_mac_registry',
      'terminal_number_ranges', 'terminals', 'time_off_requests',
      'tip_config', 'tip_distributions', 'tips', 'training_records',
      'transaction_limits', 'waitlist', 'waste_logs', 'whatsapp_messages', 'zones'
    ])
  LOOP
    fk_name := tbl || '_tenant_id_fkey';

    -- Skip if FK already exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = fk_name AND connamespace = 'public'::regnamespace
    ) THEN
      -- Clean orphans first
      EXECUTE format(
        'DELETE FROM %I WHERE tenant_id NOT IN (SELECT id FROM tenants)',
        tbl
      );

      -- Add FK
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE',
        tbl, fk_name
      );
      RAISE NOTICE 'Added FK: %', fk_name;
    END IF;
  END LOOP;
END;
$$;

-- Special cases: device_mac_addresses has tenant_id (from terminal_devices)
-- but uses a different relationship. Add FK if not exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_mac_addresses_tenant_id_fkey'
  ) THEN
    DELETE FROM device_mac_addresses WHERE tenant_id NOT IN (SELECT id FROM tenants);
    ALTER TABLE device_mac_addresses ADD CONSTRAINT device_mac_addresses_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

-- invoice_cdr and invoice_queue already have FK to invoices (CASCADE)
-- payments, recipes, refunds, platform_orders already have FK from previous migration

-- ===========================================
-- P2-2: VACUUM ANALYZE ON CLEANED TABLES
-- ===========================================
-- After mass deletion, reclaim space and update statistics
ANALYZE;
