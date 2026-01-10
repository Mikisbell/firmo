/*
  Warnings:

  - You are about to drop the column `delivery` on the `orders` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_daily_sales_range";

-- DropIndex
DROP INDEX "idx_events_terminal_sequence";

-- DropIndex
DROP INDEX "idx_invoices_daily";

-- DropIndex
DROP INDEX "idx_orders_stations_gin";

-- DropIndex
DROP INDEX "idx_processed_events_cleanup";

-- DropIndex
DROP INDEX "terminal_number_ranges_tenant_id_range_start_key";

-- AlterTable
ALTER TABLE "event_outbox" ADD COLUMN     "aggregate_id" UUID,
ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "max_attempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "next_retry" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "last_count_at" TIMESTAMPTZ(6),
ADD COLUMN     "location_id" UUID,
ADD COLUMN     "lot_number" TEXT,
ADD COLUMN     "theoretical_stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "delivery",
ADD COLUMN     "business_date" DATE,
ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "location_id" UUID,
ADD COLUMN     "shift_id" UUID,
ADD COLUMN     "table_id" UUID,
ADD COLUMN     "waiter_id" UUID,
ALTER COLUMN "revision" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "processed_events" ADD COLUMN     "aggregate_id" UUID,
ADD COLUMN     "event_type" TEXT,
ADD COLUMN     "processor" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "updated_by" UUID;

-- AlterTable
ALTER TABLE "terminal_number_ranges" ADD COLUMN     "allocated_at" TIMESTAMPTZ(6),
ADD COLUMN     "exhausted_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_access_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "terminal_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "conflict_type" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "expected_revision" INTEGER NOT NULL,
    "actual_revision" INTEGER NOT NULL,
    "local_state" JSONB,
    "server_state" JSONB,
    "merged_state" JSONB,
    "terminal_id" TEXT NOT NULL,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sunat_status" TEXT NOT NULL DEFAULT 'PENDING',
    "sunat_ticket" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "voided_at" TIMESTAMPTZ(6),
    "voided_by" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "inventory_code" TEXT NOT NULL,
    "quantity_ordered" DECIMAL(10,3) NOT NULL,
    "quantity_received" DECIMAL(10,3) NOT NULL,
    "quantity_rejected" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "rejection_reason" TEXT,
    "unit_cost_cents" INTEGER NOT NULL,
    "lot_number" TEXT,
    "expiry_date" DATE,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "purchase_order_id" UUID,
    "receipt_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "received_by" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" UUID NOT NULL,
    "inventory_count_id" UUID NOT NULL,
    "inventory_code" TEXT NOT NULL,
    "expected_qty" DECIMAL(10,3) NOT NULL,
    "counted_qty" DECIMAL(10,3) NOT NULL,
    "difference_qty" DECIMAL(10,3) NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "difference_value_cents" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "count_date" DATE NOT NULL,
    "count_type" TEXT NOT NULL DEFAULT 'FULL',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "counted_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID,
    "pin_hash" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "terminal_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "inventory_code" TEXT NOT NULL,
    "quantity_ordered" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_cost_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "order_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "expected_delivery_date" DATE,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "terminal_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_active" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soft_locks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "locked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "soft_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "inventory_code" TEXT NOT NULL,
    "supplier_sku" TEXT,
    "unit_cost_cents" INTEGER NOT NULL,
    "min_order_qty" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "shift_id" UUID,
    "inventory_code" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_detail" TEXT,
    "cost_cents" INTEGER NOT NULL,
    "reported_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "photo_url" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "device_info" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "items_ready" BOOLEAN NOT NULL DEFAULT true,
    "request_check" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("tenant_id","employee_id")
);

-- CreateTable
CREATE TABLE "analytics_cache" (
    "tenant_id" UUID NOT NULL,
    "cache_key" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "analytics_cache_pkey" PRIMARY KEY ("tenant_id","cache_key")
);

-- CreateIndex
CREATE INDEX "admin_access_logs_tenant_id_action_created_at_idx" ON "admin_access_logs"("tenant_id", "action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_access_logs_tenant_id_employee_id_created_at_idx" ON "admin_access_logs"("tenant_id", "employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "conflict_logs_tenant_id_aggregate_id_resolved_at_idx" ON "conflict_logs"("tenant_id", "aggregate_id", "resolved_at" DESC);

-- CreateIndex
CREATE INDEX "conflict_logs_tenant_id_conflict_type_idx" ON "conflict_logs"("tenant_id", "conflict_type");

-- CreateIndex
CREATE INDEX "credit_notes_tenant_id_invoice_id_idx" ON "credit_notes"("tenant_id", "invoice_id");

-- CreateIndex
CREATE INDEX "credit_notes_tenant_id_sunat_status_idx" ON "credit_notes"("tenant_id", "sunat_status");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_tenant_id_series_number_key" ON "credit_notes"("tenant_id", "series", "number");

-- CreateIndex
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items"("goods_receipt_id");

-- CreateIndex
CREATE INDEX "goods_receipts_tenant_id_location_id_received_at_idx" ON "goods_receipts"("tenant_id", "location_id", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_tenant_id_location_id_receipt_number_key" ON "goods_receipts"("tenant_id", "location_id", "receipt_number");

-- CreateIndex
CREATE INDEX "inventory_count_items_inventory_count_id_idx" ON "inventory_count_items"("inventory_count_id");

-- CreateIndex
CREATE INDEX "inventory_counts_tenant_id_location_id_count_date_idx" ON "inventory_counts"("tenant_id", "location_id", "count_date" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_tenant_id_employee_id_created_at_idx" ON "login_attempts"("tenant_id", "employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "login_attempts_tenant_id_pin_hash_created_at_idx" ON "login_attempts"("tenant_id", "pin_hash", "created_at" DESC);

-- CreateIndex
CREATE INDEX "locations_tenant_id_is_active_idx" ON "locations"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenant_id_code_key" ON "locations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_location_id_status_idx" ON "purchase_orders"("tenant_id", "location_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_supplier_id_idx" ON "purchase_orders"("tenant_id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_location_id_order_number_key" ON "purchase_orders"("tenant_id", "location_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_employee_id_idx" ON "sessions"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "soft_locks_expires_at_idx" ON "soft_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "soft_locks_tenant_id_aggregate_type_aggregate_id_key" ON "soft_locks"("tenant_id", "aggregate_type", "aggregate_id");

-- CreateIndex
CREATE INDEX "supplier_products_tenant_id_supplier_id_is_active_idx" ON "supplier_products"("tenant_id", "supplier_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_tenant_id_supplier_id_inventory_code_key" ON "supplier_products"("tenant_id", "supplier_id", "inventory_code");

-- CreateIndex
CREATE INDEX "waste_logs_tenant_id_location_id_created_at_idx" ON "waste_logs"("tenant_id", "location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "waste_logs_tenant_id_reason_code_idx" ON "waste_logs"("tenant_id", "reason_code");

-- CreateIndex
CREATE INDEX "push_subscriptions_tenant_id_employee_id_idx" ON "push_subscriptions"("tenant_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_tenant_id_employee_id_endpoint_key" ON "push_subscriptions"("tenant_id", "employee_id", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_employee_id_key" ON "notification_preferences"("employee_id");

-- CreateIndex
CREATE INDEX "analytics_cache_expires_at_idx" ON "analytics_cache"("expires_at");

-- CreateIndex
CREATE INDEX "events_tenant_id_entity_id_occurred_at_idx" ON "events"("tenant_id", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "events_tenant_id_type_occurred_at_idx" ON "events"("tenant_id", "type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "events_terminal_id_occurred_at_idx" ON "events"("terminal_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_events_by_terminal" ON "events"("terminal_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_events_by_type" ON "events"("tenant_id", "type", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "idx_events_replay" ON "events"("tenant_id", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_tenant_id_expiry_date_idx" ON "inventory"("tenant_id", "expiry_date");

-- CreateIndex
CREATE INDEX "inventory_tenant_id_location_id_code_idx" ON "inventory"("tenant_id", "location_id", "code");

-- CreateIndex
CREATE INDEX "idx_orders_fulfillment" ON "orders"("tenant_id", "fulfillment_status");

-- CreateIndex
CREATE INDEX "idx_orders_number" ON "orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "idx_orders_terminal" ON "orders"("tenant_id", "terminal_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "orders_tenant_id_business_date_idx" ON "orders"("tenant_id", "business_date");

-- CreateIndex
CREATE INDEX "orders_tenant_id_shift_id_idx" ON "orders"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_waiter_id_idx" ON "orders"("tenant_id", "waiter_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_location_id_idx" ON "orders"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "idx_shifts_history" ON "shifts"("tenant_id", "opened_at" DESC);

-- CreateIndex
CREATE INDEX "idx_shifts_terminal_status" ON "shifts"("tenant_id", "terminal_id", "status");

-- CreateIndex
CREATE INDEX "shifts_tenant_id_opened_at_idx" ON "shifts"("tenant_id", "opened_at" DESC);

-- CreateIndex
CREATE INDEX "shifts_tenant_id_terminal_id_status_idx" ON "shifts"("tenant_id", "terminal_id", "status");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "delivery_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventory_count_id_fkey" FOREIGN KEY ("inventory_count_id") REFERENCES "inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Insert default tenant before adding FK constraint
INSERT INTO "tenants" ("id", "name", "is_active", "created_at", "updated_at")
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'PARK POS Default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_waiter_id_fkey" FOREIGN KEY ("waiter_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "processed_events_tenant_id_processed_at_idx" RENAME TO "idx_processed_cleanup";
