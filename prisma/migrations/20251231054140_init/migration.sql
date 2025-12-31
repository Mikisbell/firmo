-- CreateTable
CREATE TABLE "tenant_settings" (
    "tenant_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "ruc" TEXT,
    "address_text" TEXT,
    "logo_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Lima',
    "currency" TEXT NOT NULL DEFAULT 'PEN',
    "receipt_footer_text" TEXT,
    "kds_audio_enabled" BOOLEAN NOT NULL DEFAULT true,
    "kds_audio_volume" INTEGER NOT NULL DEFAULT 80,
    "default_delivery_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "require_payment_verification" BOOLEAN NOT NULL DEFAULT false,
    "allow_cod" BOOLEAN NOT NULL DEFAULT true,
    "default_payment_expectation" TEXT NOT NULL DEFAULT 'PREPAID',
    "enable_tips" BOOLEAN NOT NULL DEFAULT true,
    "tips_on_invoice" BOOLEAN NOT NULL DEFAULT false,
    "allow_offline_coupon" BOOLEAN NOT NULL DEFAULT false,
    "max_offline_coupons_per_order" INTEGER NOT NULL DEFAULT 1,
    "require_manager_for_offline" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pin_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "station_id" UUID,
    "device_secret_hash" TEXT,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "price_cents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SIMPLE',
    "components" JSONB,
    "recipe" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_meta" (
    "tenant_id" UUID NOT NULL,
    "catalog_version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_meta_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_number" INTEGER NOT NULL,
    "order_type" TEXT NOT NULL,
    "order_status" TEXT NOT NULL DEFAULT 'OPEN',
    "fulfillment_status" TEXT NOT NULL DEFAULT 'COOKING',
    "handoff_status" TEXT NOT NULL DEFAULT 'WAITING',
    "stations_active" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unpaid_checks_count" INTEGER NOT NULL DEFAULT 0,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "promotion_id" UUID,
    "promotion_snapshot" JSONB,
    "coupon_code" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "terminal_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "items" JSONB NOT NULL DEFAULT '[]',
    "checks" JSONB NOT NULL DEFAULT '[]',
    "fulfillment" JSONB,
    "delivery" JSONB,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,
    "opened_by" UUID NOT NULL,
    "closed_by" UUID,
    "cash_opening_cents" INTEGER NOT NULL,
    "cash_expected_cents" INTEGER,
    "cash_counted_cents" INTEGER,
    "diff_cents" INTEGER,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "addresses" JSONB NOT NULL DEFAULT '[]',
    "birth_month" INTEGER,
    "birth_day" INTEGER,
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "check_id" TEXT NOT NULL,
    "invoice_type" TEXT NOT NULL,
    "series" TEXT,
    "invoice_number" TEXT,
    "customer_doc_type" TEXT,
    "customer_doc" TEXT,
    "total_cents" INTEGER NOT NULL,
    "payment_summary" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "void_reason" TEXT,
    "voided_by" UUID,
    "voided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "actor_id" UUID,
    "actor_role_snapshot" TEXT,
    "terminal_id" TEXT NOT NULL,
    "shift_id" UUID,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER,
    "rules" JSONB NOT NULL,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sales_summary" (
    "tenant_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "gross_sales_cents" INTEGER NOT NULL DEFAULT 0,
    "net_sales_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_cents" INTEGER NOT NULL DEFAULT 0,
    "tips_cents" INTEGER NOT NULL DEFAULT 0,
    "delivery_fee_cents" INTEGER NOT NULL DEFAULT 0,
    "voids_cents" INTEGER NOT NULL DEFAULT 0,
    "refunds_cents" INTEGER NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "checks_count" INTEGER NOT NULL DEFAULT 0,
    "payments_breakdown" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_sales_summary_pkey" PRIMARY KEY ("tenant_id","business_date")
);

-- CreateTable
CREATE TABLE "printers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "station_id" UUID,
    "station_code" TEXT NOT NULL,
    "connection_type" TEXT NOT NULL,
    "connection" JSONB NOT NULL,
    "paper_width" INTEGER NOT NULL DEFAULT 80,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "printer_id" UUID,
    "job_type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "order_id" UUID,
    "check_id" TEXT,
    "actor_id" UUID,
    "terminal_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "printed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profile" (
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMPTZ,
    "last_seen_at" TIMESTAMPTZ,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "invoices_count" INTEGER NOT NULL DEFAULT 0,
    "lifetime_value_cents" INTEGER NOT NULL DEFAULT 0,
    "avg_ticket_cents" INTEGER NOT NULL DEFAULT 0,
    "favorite_order_type" TEXT,
    "favorite_products" JSONB,
    "recency_days" INTEGER,
    "frequency_30d" INTEGER,
    "is_birthday" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_profile_pkey" PRIMARY KEY ("tenant_id","customer_id")
);

-- CreateTable
CREATE TABLE "marketing_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_members" (
    "tenant_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_members_pkey" PRIMARY KEY ("tenant_id","segment_id","customer_id")
);

-- CreateTable
CREATE TABLE "marketing_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "segment_id" UUID,
    "message_template_id" UUID,
    "offer" JSONB,
    "schedule" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es_PE',
    "template_key" TEXT,
    "content" TEXT NOT NULL,
    "variables_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_outbox" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "customer_id" UUID,
    "to_phone" TEXT NOT NULL,
    "campaign_id" UUID,
    "template_id" UUID,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "context" JSONB,
    "suggestion" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "promotion_id" UUID,
    "customer_id" UUID,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reserved_at" TIMESTAMPTZ,
    "reserved_by_terminal_id" TEXT,
    "redeemed_at" TIMESTAMPTZ,
    "redeemed_order_id" UUID,
    "redeemed_check_id" TEXT,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "order_id" UUID,
    "check_id" TEXT,
    "actor_id" UUID,
    "terminal_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_conflicts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "severity" TEXT NOT NULL DEFAULT 'WARN',
    "detected_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB NOT NULL,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ,
    "resolution" JSONB,

    CONSTRAINT "sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(10,3),
    "cost_cents" INTEGER,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "inventory_id" UUID NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "reference_id" UUID,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employees_tenant_id_is_active_idx" ON "employees"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "terminals_tenant_id_terminal_id_key" ON "terminals"("tenant_id", "terminal_id");

-- CreateIndex
CREATE UNIQUE INDEX "stations_tenant_id_code_key" ON "stations"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_idx" ON "products"("tenant_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "orders_tenant_id_order_status_idx" ON "orders"("tenant_id", "order_status");

-- CreateIndex
CREATE INDEX "orders_tenant_id_created_at_idx" ON "orders"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "shifts_tenant_id_status_idx" ON "shifts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenant_id_phone_key" ON "customers"("tenant_id", "phone");

-- CreateIndex
CREATE INDEX "drivers_tenant_id_is_active_idx" ON "drivers"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_created_at_idx" ON "invoices"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_order_id_check_id_key" ON "invoices"("tenant_id", "order_id", "check_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_series_invoice_number_key" ON "invoices"("tenant_id", "series", "invoice_number");

-- CreateIndex
CREATE INDEX "events_tenant_id_occurred_at_idx" ON "events"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "events_tenant_id_entity_id_idx" ON "events"("tenant_id", "entity_id");

-- CreateIndex
CREATE INDEX "promotions_tenant_id_is_active_idx" ON "promotions"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "printers_tenant_id_station_code_idx" ON "printers"("tenant_id", "station_code");

-- CreateIndex
CREATE INDEX "print_jobs_tenant_id_status_created_at_idx" ON "print_jobs"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profile_customer_id_key" ON "customer_profile"("customer_id");

-- CreateIndex
CREATE INDEX "marketing_segments_tenant_id_is_active_idx" ON "marketing_segments"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "marketing_campaigns_tenant_id_status_idx" ON "marketing_campaigns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "message_templates_tenant_id_channel_is_active_idx" ON "message_templates"("tenant_id", "channel", "is_active");

-- CreateIndex
CREATE INDEX "message_outbox_tenant_id_status_scheduled_at_idx" ON "message_outbox"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_tenant_id_status_idx" ON "ai_suggestions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_status_expires_at_idx" ON "coupons"("tenant_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "coupons_tenant_id_customer_id_status_idx" ON "coupons"("tenant_id", "customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_tenant_id_code_key" ON "coupons"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_tenant_id_coupon_id_occurred_at_idx" ON "coupon_redemptions"("tenant_id", "coupon_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "sync_conflicts_tenant_id_severity_idx" ON "sync_conflicts"("tenant_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_tenant_id_code_key" ON "inventory"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "inventory_log_tenant_id_inventory_id_created_at_idx" ON "inventory_log"("tenant_id", "inventory_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile" ADD CONSTRAINT "customer_profile_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_members" ADD CONSTRAINT "segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "marketing_segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "marketing_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_message_template_id_fkey" FOREIGN KEY ("message_template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_log" ADD CONSTRAINT "inventory_log_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
