-- =============================================
-- PARK POS Database Hardening Migration
-- Date: 2026-02-21
-- Covers: P0 Critical + P1 Security + P2 Performance
-- =============================================

-- ===========================================
-- P0-1: AUTO-UPDATE TRIGGER FOR updated_at
-- ===========================================
-- Prisma @default(now()) only sets on INSERT. This trigger auto-updates on UPDATE.

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all 37 tables with updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'attendance', 'catalog_meta', 'customer_profile', 'customers',
      'inventory', 'locations', 'marketing_campaigns', 'marketing_segments',
      'message_templates', 'orders', 'petty_cash_balance', 'products',
      'promotions', 'purchase_orders', 'recipes', 'pollo_daily_summary',
      'reservations', 'suppliers', 'table_layouts', 'tables',
      'tenant_settings', 'tenants', 'terminal_devices', 'notification_preferences',
      'assignment_weights', 'transaction_limits', 'cross_tenant_admins',
      'alert_configurations', 'alert_events', 'log_configuration',
      'onboarding_steps', 'tenant_quotas', 'tenant_usage',
      'schedules', 'schedule_templates', 'leave_requests', 'platform_configs'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
        tbl
      );
    END IF;
  END LOOP;
END;
$$;

-- ===========================================
-- P0-2: FIX employees.dni UNIQUE CONSTRAINT
-- ===========================================
-- Change from global @unique to per-tenant @@unique([tenant_id, dni])

ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_dni_key";
CREATE UNIQUE INDEX "employees_tenant_id_dni_key" ON "employees"("tenant_id", "dni");

-- ===========================================
-- P0-3: REMOVE DUPLICATE INDEXES
-- ===========================================
-- events: 3 duplicate pairs (without map: are duplicates of those with map:)

DROP INDEX IF EXISTS "events_tenant_id_entity_id_occurred_at_idx";
DROP INDEX IF EXISTS "events_tenant_id_type_occurred_at_idx";
DROP INDEX IF EXISTS "events_terminal_id_occurred_at_idx";

-- shifts: 2 duplicate pairs
DROP INDEX IF EXISTS "shifts_tenant_id_opened_at_idx";
DROP INDEX IF EXISTS "shifts_tenant_id_terminal_id_status_idx";

-- ===========================================
-- P0-4: CLEANUP ORPHANED TEST DATA
-- ===========================================
-- Delete records referencing non-existent tenants (test residue)

DELETE FROM "events" WHERE tenant_id NOT IN (SELECT id FROM tenants);
DELETE FROM "orders" WHERE tenant_id NOT IN (SELECT id FROM tenants);
DELETE FROM "products" WHERE tenant_id NOT IN (SELECT id FROM tenants);
DELETE FROM "employees" WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- Clean up test tenant settings without tenants
DELETE FROM "tenant_settings" WHERE tenant_id NOT IN (SELECT id FROM tenants);

-- ===========================================
-- P1-1: FIX station_alerts TIMEZONE
-- ===========================================

ALTER TABLE "station_alerts" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(6);
ALTER TABLE "station_alerts" ALTER COLUMN "dismissed_at" SET DATA TYPE TIMESTAMPTZ(6);

-- ===========================================
-- P1-2: ADD tenant_id TO 5 TABLES
-- ===========================================
-- These tables are empty, so NOT NULL is safe

ALTER TABLE "location_history" ADD COLUMN "tenant_id" UUID NOT NULL;
ALTER TABLE "whatsapp_messages" ADD COLUMN "tenant_id" UUID NOT NULL;
ALTER TABLE "assignment_logs" ADD COLUMN "tenant_id" UUID NOT NULL;
ALTER TABLE "eta_predictions" ADD COLUMN "tenant_id" UUID NOT NULL;

-- activation_codes has existing rows: add nullable, populate from terminal_devices, then set NOT NULL
ALTER TABLE "activation_codes" ADD COLUMN "tenant_id" UUID;
UPDATE "activation_codes" SET tenant_id = td.tenant_id
  FROM "terminal_devices" td WHERE "activation_codes".terminal_id = td.terminal_id;
ALTER TABLE "activation_codes" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Add indexes for tenant filtering
CREATE INDEX "location_history_tenant_id_idx" ON "location_history"("tenant_id");
CREATE INDEX "whatsapp_messages_tenant_id_idx" ON "whatsapp_messages"("tenant_id");
CREATE INDEX "assignment_logs_tenant_id_idx" ON "assignment_logs"("tenant_id");
CREATE INDEX "eta_predictions_tenant_id_idx" ON "eta_predictions"("tenant_id");
CREATE INDEX "activation_codes_tenant_id_idx" ON "activation_codes"("tenant_id");

-- ===========================================
-- P1-3: FOREIGN KEY CONSTRAINTS (7 critical)
-- ===========================================
-- Clean orphans first (done in P0-4), then add constraints

-- payments → orders
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- recipes → products
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- refunds → orders
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- invoice_cdr → invoices (cascade: CDR is integral to invoice)
ALTER TABLE "invoice_cdr" ADD CONSTRAINT "invoice_cdr_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- invoice_queue → invoices (cascade: queue entry meaningless without invoice)
ALTER TABLE "invoice_queue" ADD CONSTRAINT "invoice_queue_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- orders → tenants (critical for multi-tenant integrity)
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- platform_orders → orders (nullable FK, SET NULL on delete)
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- NOTE: Skipping events.shift_id FK intentionally - event store is append-only,
-- FK would block shift deletion and slow high-throughput inserts.

-- ===========================================
-- P1-4: ROW LEVEL SECURITY ON 20 SENSITIVE TABLES
-- ===========================================
-- Enable RLS. The postgres/service_role user bypasses RLS automatically.
-- This protects against direct access via anon key or leaked credentials.

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credit_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petty_cash_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "petty_cash_balance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "active_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emergency_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tip_distributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_orders" ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- P2-1: FK INDEXES (15 most important)
-- ===========================================
-- Indexes on foreign key columns to speed up JOINs and cascaded deletes

CREATE INDEX "delivery_orders_order_id_idx" ON "delivery_orders"("order_id");
CREATE INDEX "invoices_order_id_idx" ON "invoices"("tenant_id", "order_id");
CREATE INDEX "orders_customer_id_idx" ON "orders"("tenant_id", "customer_id");
CREATE INDEX "orders_table_id_idx" ON "orders"("tenant_id", "table_id");
CREATE INDEX "platform_orders_order_id_idx" ON "platform_orders"("order_id");
CREATE INDEX "refunds_invoice_id_idx" ON "refunds"("tenant_id", "invoice_id");
CREATE INDEX "sessions_terminal_id_idx" ON "sessions"("terminal_id");
CREATE INDEX "tips_order_id_idx" ON "tips"("tenant_id", "order_id");
CREATE INDEX "coupon_redemptions_order_id_idx" ON "coupon_redemptions"("order_id");
CREATE INDEX "invoice_queue_invoice_id_idx" ON "invoice_queue"("tenant_id", "invoice_id");
CREATE INDEX "message_outbox_customer_id_idx" ON "message_outbox"("customer_id");
CREATE INDEX "petty_cash_transactions_location_id_idx" ON "petty_cash_transactions"("tenant_id", "location_id");
CREATE INDEX "stock_transfers_from_location_idx" ON "stock_transfers"("tenant_id", "from_location_id");
CREATE INDEX "reservations_customer_id_idx" ON "reservations"("tenant_id", "customer_id");
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("tenant_id", "purchase_order_id");

-- ===========================================
-- P2-2: UNIQUE CONSTRAINTS (business rules)
-- ===========================================

-- One attendance per employee per day per tenant
DROP INDEX IF EXISTS "attendance_tenant_id_employee_id_date_idx";
CREATE UNIQUE INDEX "attendance_tenant_id_employee_id_date_key" ON "attendance"("tenant_id", "employee_id", "date");

-- One schedule per employee per day per tenant
DROP INDEX IF EXISTS "schedules_tenant_id_employee_id_date_idx";
CREATE UNIQUE INDEX "schedules_tenant_id_employee_id_date_key" ON "schedules"("tenant_id", "employee_id", "date");

-- One tip distribution per shift per tenant
DROP INDEX IF EXISTS "tip_distributions_tenant_id_shift_id_idx";
CREATE UNIQUE INDEX "tip_distributions_tenant_id_shift_id_key" ON "tip_distributions"("tenant_id", "shift_id");

-- One queue entry per invoice+action per tenant
CREATE UNIQUE INDEX "invoice_queue_tenant_id_invoice_id_action_key" ON "invoice_queue"("tenant_id", "invoice_id", "action");

-- Prevent double-booking: one reservation per table per date+time (only when table is assigned)
CREATE UNIQUE INDEX "reservations_no_double_booking" ON "reservations"("tenant_id", "table_id", "date", "time")
  WHERE "table_id" IS NOT NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW');

-- ===========================================
-- P2-3: CHECK CONSTRAINTS FOR MONEY >= 0
-- ===========================================

-- Orders
ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_subtotal_positive" CHECK ("subtotal_cents" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_total_positive" CHECK ("total_cents" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_discount_positive" CHECK ("discount_cents" >= 0);

-- Products
ALTER TABLE "products" ADD CONSTRAINT "chk_products_price_positive" CHECK ("price_cents" >= 0);

-- Payments
ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount_positive" CHECK ("amount_cents" >= 0);

-- Invoices
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoices_total_positive" CHECK ("total_cents" >= 0);

-- Refunds
ALTER TABLE "refunds" ADD CONSTRAINT "chk_refunds_amounts_positive" CHECK ("original_amount" >= 0 AND "refund_amount" >= 0);

-- Payroll
ALTER TABLE "payroll_records" ADD CONSTRAINT "chk_payroll_salary_positive" CHECK ("base_salary_cents" >= 0 AND "gross_salary_cents" >= 0 AND "net_salary_cents" >= 0);

-- Petty cash
ALTER TABLE "petty_cash_transactions" ADD CONSTRAINT "chk_petty_cash_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "petty_cash_balance" ADD CONSTRAINT "chk_petty_cash_balance_positive" CHECK ("current_balance" >= 0 AND "max_balance" >= 0);

-- Tips
ALTER TABLE "tips" ADD CONSTRAINT "chk_tips_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "tip_distributions" ADD CONSTRAINT "chk_tip_dist_total_positive" CHECK ("total_tips" >= 0);

-- Platform orders
ALTER TABLE "platform_orders" ADD CONSTRAINT "chk_platform_orders_amounts_positive"
  CHECK ("platform_total_cents" >= 0 AND "restaurant_total_cents" >= 0 AND "commission_cents" >= 0);

-- Purchase orders
ALTER TABLE "purchase_orders" ADD CONSTRAINT "chk_purchase_orders_amounts_positive"
  CHECK ("subtotal_cents" >= 0 AND "tax_cents" >= 0 AND "total_cents" >= 0);

-- Advances
ALTER TABLE "advances" ADD CONSTRAINT "chk_advances_amount_positive" CHECK ("amount_cents" >= 0);

-- Credit notes
ALTER TABLE "credit_notes" ADD CONSTRAINT "chk_credit_notes_total_positive" CHECK ("total_cents" >= 0);

-- Payment settlements (expected >= 0, difference can be negative)
ALTER TABLE "payment_settlements" ADD CONSTRAINT "chk_settlements_expected_positive" CHECK ("expected_cents" >= 0);

-- Waste logs
ALTER TABLE "waste_logs" ADD CONSTRAINT "chk_waste_cost_positive" CHECK ("cost_cents" >= 0);

-- ===========================================
-- P2-4: DEPRECATE time_off_requests
-- ===========================================
-- Mark as deprecated via comment. Use leave_requests (HR module) instead.
COMMENT ON TABLE "time_off_requests" IS 'DEPRECATED: Use leave_requests instead. This table will be removed in a future migration.';
