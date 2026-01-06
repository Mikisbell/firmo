-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "email" TEXT,
ADD COLUMN     "last_order_at" TIMESTAMPTZ,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "total_orders" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_spent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "ruc" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "payment_terms" INTEGER NOT NULL DEFAULT 0,
    "min_order_cents" INTEGER NOT NULL DEFAULT 0,
    "delivery_days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lead_time_days" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ingredients" JSONB NOT NULL,
    "yield_qty" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_alerts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "current_qty" DECIMAL(10,3) NOT NULL,
    "threshold_qty" DECIMAL(10,3) NOT NULL,
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "from_location_id" UUID NOT NULL,
    "to_location_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "items" JSONB NOT NULL,
    "transport_cost" INTEGER NOT NULL DEFAULT 0,
    "authorized_by" UUID NOT NULL,
    "received_by" UUID,
    "shipped_at" TIMESTAMPTZ,
    "received_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4CAF50',
    "bounds" JSONB,
    "is_smoking" BOOLEAN NOT NULL DEFAULT false,
    "is_outdoor" BOOLEAN NOT NULL DEFAULT false,
    "has_ac" BOOLEAN NOT NULL DEFAULT false,
    "assigned_waiter_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "zone_id" UUID,
    "number" TEXT NOT NULL,
    "display_name" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 60,
    "height" INTEGER NOT NULL DEFAULT 60,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "shape" TEXT NOT NULL DEFAULT 'SQUARE',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "current_order_id" UUID,
    "occupied_since" TIMESTAMPTZ,
    "is_merged" BOOLEAN NOT NULL DEFAULT false,
    "merged_table_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parent_table_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_layouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "canvas_width" INTEGER NOT NULL DEFAULT 800,
    "canvas_height" INTEGER NOT NULL DEFAULT 600,
    "background_image_url" TEXT,
    "background_opacity" INTEGER NOT NULL DEFAULT 50,
    "decorations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "table_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_id" UUID,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 90,
    "party_size" INTEGER NOT NULL,
    "table_id" UUID,
    "table_number" TEXT,
    "zone_preference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmation_sent" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "confirmed_via" TEXT,
    "deposit_required" BOOLEAN NOT NULL DEFAULT false,
    "deposit_amount" INTEGER,
    "deposit_paid_at" TIMESTAMPTZ,
    "deposit_payment_id" TEXT,
    "special_requests" TEXT,
    "internal_notes" TEXT,
    "arrived_at" TIMESTAMPTZ,
    "seated_at" TIMESTAMPTZ,
    "no_show_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "cancelled_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "preferred_time" TEXT NOT NULL,
    "party_size" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "notified_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ,
    "receipt_photo_url" TEXT,
    "receipt_number" TEXT,
    "supplier_name" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petty_cash_balance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "current_balance" INTEGER NOT NULL DEFAULT 0,
    "max_balance" INTEGER NOT NULL DEFAULT 50000,
    "min_balance" INTEGER NOT NULL DEFAULT 10000,
    "approval_threshold" INTEGER NOT NULL DEFAULT 5000,
    "last_reconciled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reconciled_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petty_cash_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_method" TEXT NOT NULL,
    "waiter_id" UUID NOT NULL,
    "zone_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "settled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_distributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "distribution_mode" TEXT NOT NULL,
    "total_tips" INTEGER NOT NULL,
    "participants" INTEGER NOT NULL,
    "distributions" JSONB NOT NULL,
    "distributed_by" UUID NOT NULL,
    "distributed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tip_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_config" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "distribution_mode" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "include_kitchen" BOOLEAN NOT NULL DEFAULT false,
    "kitchen_percentage" INTEGER NOT NULL DEFAULT 0,
    "card_tip_fee_percentage" INTEGER NOT NULL DEFAULT 0,
    "min_tip_to_record" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "tip_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 60,
    "zone_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "original_employee_id" UUID,
    "swap_approved_by" UUID,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "schedule_id" UUID,
    "date" DATE NOT NULL,
    "clock_in" TIMESTAMPTZ NOT NULL,
    "clock_out" TIMESTAMPTZ,
    "breaks" JSONB NOT NULL DEFAULT '[]',
    "scheduled_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "overtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_off_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_queue" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_attempt_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "invoice_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_cdr" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "response_code" TEXT NOT NULL,
    "response_message" TEXT NOT NULL,
    "hash" TEXT,
    "cdr_xml" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_cdr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sunat_daily_summary" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "summary_date" DATE NOT NULL,
    "summary_number" TEXT NOT NULL,
    "boletas_count" INTEGER NOT NULL DEFAULT 0,
    "boletas_total" INTEGER NOT NULL DEFAULT 0,
    "ticket_number" TEXT,
    "sunat_status" TEXT NOT NULL DEFAULT 'PENDING',
    "cdr_received" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sunat_daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "check_id" TEXT NOT NULL,
    "invoice_id" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason_code" TEXT NOT NULL,
    "reason_detail" TEXT,
    "requested_by" UUID NOT NULL,
    "authorized_by" UUID,
    "original_amount" INTEGER NOT NULL,
    "refund_amount" INTEGER NOT NULL,
    "refund_method" TEXT NOT NULL,
    "refund_reference" TEXT,
    "items" JSONB,
    "credit_note_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_at" TIMESTAMPTZ,
    "issued_at" TIMESTAMPTZ,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RADIUS',
    "center_lat" DECIMAL(10,7),
    "center_lng" DECIMAL(10,7),
    "radius_km" DECIMAL(5,2),
    "polygon" JSONB,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "min_order" INTEGER NOT NULL DEFAULT 0,
    "estimated_mins" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_addresses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" TEXT,
    "address_text" TEXT NOT NULL,
    "reference" TEXT,
    "district" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "zone_id" UUID,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "driver_id" UUID,
    "address_id" UUID,
    "address_text" TEXT NOT NULL,
    "address_reference" TEXT,
    "customer_phone" TEXT NOT NULL,
    "delivery_fee" INTEGER NOT NULL DEFAULT 0,
    "estimated_delivery_at" TIMESTAMPTZ,
    "assigned_at" TIMESTAMPTZ,
    "dispatched_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "delivery_time_mins" INTEGER,
    "signature_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_tenant_id_is_active_idx" ON "suppliers"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_tenant_id_product_id_key" ON "recipes"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_alerts_tenant_id_location_id_is_acknowledged_idx" ON "stock_alerts"("tenant_id", "location_id", "is_acknowledged");

-- CreateIndex
CREATE INDEX "stock_transfers_tenant_id_status_idx" ON "stock_transfers"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "zones_tenant_id_location_id_code_key" ON "zones"("tenant_id", "location_id", "code");

-- CreateIndex
CREATE INDEX "tables_tenant_id_location_id_status_idx" ON "tables"("tenant_id", "location_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tables_tenant_id_location_id_number_key" ON "tables"("tenant_id", "location_id", "number");

-- CreateIndex
CREATE INDEX "table_layouts_tenant_id_location_id_is_active_idx" ON "table_layouts"("tenant_id", "location_id", "is_active");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_location_id_date_status_idx" ON "reservations"("tenant_id", "location_id", "date", "status");

-- CreateIndex
CREATE INDEX "reservations_tenant_id_customer_phone_idx" ON "reservations"("tenant_id", "customer_phone");

-- CreateIndex
CREATE INDEX "waitlist_tenant_id_location_id_date_status_idx" ON "waitlist"("tenant_id", "location_id", "date", "status");

-- CreateIndex
CREATE INDEX "petty_cash_transactions_tenant_id_location_id_shift_id_idx" ON "petty_cash_transactions"("tenant_id", "location_id", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "petty_cash_balance_tenant_id_location_id_key" ON "petty_cash_balance"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "tips_tenant_id_shift_id_waiter_id_idx" ON "tips"("tenant_id", "shift_id", "waiter_id");

-- CreateIndex
CREATE INDEX "tip_distributions_tenant_id_shift_id_idx" ON "tip_distributions"("tenant_id", "shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "tip_config_tenant_id_location_id_key" ON "tip_config"("tenant_id", "location_id");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_location_id_date_idx" ON "schedules"("tenant_id", "location_id", "date");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_employee_id_date_idx" ON "schedules"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "attendance_tenant_id_employee_id_date_idx" ON "attendance"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "time_off_requests_tenant_id_employee_id_status_idx" ON "time_off_requests"("tenant_id", "employee_id", "status");

-- CreateIndex
CREATE INDEX "invoice_queue_tenant_id_status_scheduled_at_idx" ON "invoice_queue"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_cdr_tenant_id_invoice_id_key" ON "invoice_cdr"("tenant_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "sunat_daily_summary_tenant_id_location_id_summary_date_key" ON "sunat_daily_summary"("tenant_id", "location_id", "summary_date");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_order_id_idx" ON "refunds"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "refunds_tenant_id_status_idx" ON "refunds"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "delivery_zones_tenant_id_location_id_is_active_idx" ON "delivery_zones"("tenant_id", "location_id", "is_active");

-- CreateIndex
CREATE INDEX "delivery_addresses_tenant_id_customer_id_idx" ON "delivery_addresses"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "delivery_orders_tenant_id_status_idx" ON "delivery_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "delivery_orders_tenant_id_driver_id_status_idx" ON "delivery_orders"("tenant_id", "driver_id", "status");

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_addresses" ADD CONSTRAINT "delivery_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
