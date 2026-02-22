-- AlterTable (split: RENAME CONSTRAINT cannot combine with ALTER COLUMN in PostgreSQL)
ALTER TABLE "device_mac_addresses" RENAME CONSTRAINT "pk_device_mac_addresses" TO "device_mac_addresses_pkey";

ALTER TABLE "device_mac_addresses"
ALTER COLUMN "terminal_id" SET DEFAULT '00000000-0000-0000-0000-000000000000',
ALTER COLUMN "trust_level" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "emergency_contacts" DROP COLUMN "phone_secondary",
DROP COLUMN "updated_at",
ALTER COLUMN "is_primary" SET NOT NULL;

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "pin_changed_at",
ALTER COLUMN "has_health_insurance" SET NOT NULL;

-- AlterTable
ALTER TABLE "log_configuration" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "log_configuration_change" DROP CONSTRAINT "log_configuration_change_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "log_configuration_change_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "maintenance_windows" ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "alert_types" SET DATA TYPE TEXT[];

-- AlterTable
ALTER TABLE "onboarding_steps" ALTER COLUMN "is_required" SET NOT NULL,
ALTER COLUMN "is_completed" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "pin_history" ALTER COLUMN "changed_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_available" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "category" TEXT,
ADD COLUMN     "conversion_factor" DECIMAL(5,3) NOT NULL DEFAULT 1.0,
ADD COLUMN     "cost_cents" INTEGER,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "last_cost_at" TIMESTAMPTZ(6),
ADD COLUMN     "name" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "preparation_time_minutes" INTEGER,
ADD COLUMN     "updated_by" UUID,
ADD COLUMN     "yield_unit" TEXT NOT NULL DEFAULT 'UNIDADES';

-- AlterTable
ALTER TABLE "recovery_action_log" ALTER COLUMN "timestamp" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenant_settings" ALTER COLUMN "onboarding_status" SET NOT NULL;

-- CreateTable
CREATE TABLE "pollo_production_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "shift_id" UUID,
    "batch_number" INTEGER NOT NULL,
    "raw_units" DECIMAL(10,3) NOT NULL,
    "raw_weight_kg" DECIMAL(10,3) NOT NULL,
    "cooked_units" DECIMAL(10,3),
    "cooked_weight_kg" DECIMAL(10,3),
    "yield_percent" DECIMAL(5,2),
    "waste_units" DECIMAL(10,3),
    "waste_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CRUDO',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "recorded_by" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pollo_production_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pollo_daily_summary" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "total_raw_units" DECIMAL(10,3) NOT NULL,
    "total_cooked_units" DECIMAL(10,3) NOT NULL,
    "total_sold_units" DECIMAL(10,3) NOT NULL,
    "total_waste_units" DECIMAL(10,3) NOT NULL,
    "unaccounted_units" DECIMAL(10,3) NOT NULL,
    "avg_yield_percent" DECIMAL(5,2) NOT NULL,
    "aderezo_liters_used" DECIMAL(10,3),
    "aderezo_chicken_ratio" DECIMAL(10,3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pollo_daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_tenant_admins" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_tenant_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_tenant_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_tenant_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_quotas" (
    "tenant_id" UUID NOT NULL,
    "max_terminals" INTEGER NOT NULL DEFAULT 20,
    "max_employees" INTEGER NOT NULL DEFAULT 50,
    "max_products" INTEGER NOT NULL DEFAULT 500,
    "max_daily_orders" INTEGER NOT NULL DEFAULT 1000,
    "max_storage_mb" INTEGER NOT NULL DEFAULT 1000,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_usage" (
    "tenant_id" UUID NOT NULL,
    "current_terminals" INTEGER NOT NULL DEFAULT 0,
    "current_employees" INTEGER NOT NULL DEFAULT 0,
    "current_products" INTEGER NOT NULL DEFAULT 0,
    "daily_orders" INTEGER NOT NULL DEFAULT 0,
    "storage_mb" INTEGER NOT NULL DEFAULT 0,
    "last_reset_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_usage_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "tenant_analytics" (
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "active_terminals" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "total_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "avg_order_value_cents" INTEGER NOT NULL DEFAULT 0,
    "peak_orders_per_hour" INTEGER NOT NULL DEFAULT 0,
    "sync_errors" INTEGER NOT NULL DEFAULT 0,
    "api_errors" INTEGER NOT NULL DEFAULT 0,
    "storage_mb" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tenant_analytics_pkey" PRIMARY KEY ("tenant_id","date")
);

-- CreateTable
CREATE TABLE "tenant_health_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "check_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "details" JSONB,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "api_key" TEXT,
    "store_id" TEXT,
    "webhook_secret" TEXT,
    "commission_rate" DECIMAL(5,2) NOT NULL,
    "markup_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.20,
    "auto_accept" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_order_id" TEXT NOT NULL,
    "order_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "raw_payload" JSONB NOT NULL,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "delivery_address" TEXT,
    "platform_total_cents" INTEGER NOT NULL,
    "restaurant_total_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL DEFAULT 0,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "estimated_pickup" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_settlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "payment_method" TEXT NOT NULL,
    "expected_cents" INTEGER NOT NULL,
    "received_cents" INTEGER,
    "difference_cents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "reconciled_by" UUID,
    "reconciled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pollo_production_logs_tenant_id_location_id_created_at_idx" ON "pollo_production_logs"("tenant_id", "location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "pollo_production_logs_tenant_id_shift_id_idx" ON "pollo_production_logs"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "pollo_production_logs_tenant_id_status_idx" ON "pollo_production_logs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "pollo_daily_summary_tenant_id_business_date_idx" ON "pollo_daily_summary"("tenant_id", "business_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pollo_daily_summary_tenant_id_location_id_business_date_key" ON "pollo_daily_summary"("tenant_id", "location_id", "business_date");

-- CreateIndex
CREATE INDEX "cross_tenant_admins_is_active_idx" ON "cross_tenant_admins"("is_active");

-- CreateIndex
CREATE INDEX "cross_tenant_admins_expires_at_idx" ON "cross_tenant_admins"("expires_at");

-- CreateIndex
CREATE INDEX "cross_tenant_admins_granted_at_idx" ON "cross_tenant_admins"("granted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cross_tenant_admins_employee_id_key" ON "cross_tenant_admins"("employee_id");

-- CreateIndex
CREATE INDEX "cross_tenant_audit_log_admin_id_created_at_idx" ON "cross_tenant_audit_log"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cross_tenant_audit_log_tenant_id_created_at_idx" ON "cross_tenant_audit_log"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cross_tenant_audit_log_action_created_at_idx" ON "cross_tenant_audit_log"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenant_analytics_tenant_id_date_idx" ON "tenant_analytics"("tenant_id", "date" DESC);

-- CreateIndex
CREATE INDEX "tenant_health_checks_tenant_id_checked_at_idx" ON "tenant_health_checks"("tenant_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "tenant_health_checks_tenant_id_check_type_checked_at_idx" ON "tenant_health_checks"("tenant_id", "check_type", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "platform_configs_tenant_id_is_active_idx" ON "platform_configs"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "platform_configs_tenant_id_platform_key" ON "platform_configs"("tenant_id", "platform");

-- CreateIndex
CREATE INDEX "platform_orders_tenant_id_status_idx" ON "platform_orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "platform_orders_tenant_id_created_at_idx" ON "platform_orders"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_tenant_id_platform_platform_order_id_key" ON "platform_orders"("tenant_id", "platform", "platform_order_id");

-- CreateIndex
CREATE INDEX "payment_settlements_tenant_id_status_idx" ON "payment_settlements"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_settlements_tenant_id_period_start_period_end_payme_key" ON "payment_settlements"("tenant_id", "period_start", "period_end", "payment_method");

-- CreateIndex
CREATE INDEX "daily_sales_summary_tenant_id_business_date_idx" ON "daily_sales_summary"("tenant_id", "business_date" DESC);

-- CreateIndex
CREATE INDEX "dead_letter_queue_tenant_id_idx" ON "dead_letter_queue"("tenant_id");

-- CreateIndex
CREATE INDEX "dead_letter_queue_event_id_idx" ON "dead_letter_queue"("event_id");

-- CreateIndex
CREATE INDEX "dead_letter_queue_aggregate_id_idx" ON "dead_letter_queue"("aggregate_id");

-- CreateIndex
CREATE INDEX "dead_letter_queue_expired_at_idx" ON "dead_letter_queue"("expired_at" DESC);

-- CreateIndex
CREATE INDEX "dead_letter_queue_tenant_id_expired_at_idx" ON "dead_letter_queue"("tenant_id", "expired_at" DESC);

-- CreateIndex
CREATE INDEX "device_mac_addresses_terminal_id_idx" ON "device_mac_addresses"("terminal_id");

-- CreateIndex
CREATE INDEX "inventory_log_inventory_id_idx" ON "inventory_log"("inventory_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_is_available_idx" ON "products"("tenant_id", "is_available");

-- CreateIndex
CREATE INDEX "recipes_tenant_id_category_idx" ON "recipes"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "recipes_tenant_id_is_active_idx" ON "recipes"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_employee_id_date_idx" ON "schedules"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "schedules_tenant_id_location_id_date_idx" ON "schedules"("tenant_id", "location_id", "date");

-- CreateIndex
CREATE INDEX "terminal_mac_registry_is_authorized_idx" ON "terminal_mac_registry"("is_authorized");

-- AddForeignKey
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant_settings"("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "alert_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_schedules" ADD CONSTRAINT "employee_schedules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "schedule_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advances" ADD CONSTRAINT "advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_advances_employee" RENAME TO "advances_tenant_id_employee_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_advances_status" RENAME TO "advances_tenant_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_alert_configurations_enabled" RENAME TO "alert_configurations_tenant_id_enabled_idx";

-- RenameIndex
ALTER INDEX "idx_alert_configurations_tenant" RENAME TO "alert_configurations_tenant_id_idx";

-- RenameIndex
ALTER INDEX "idx_alert_configurations_type" RENAME TO "alert_configurations_tenant_id_alert_type_idx";

-- RenameIndex
ALTER INDEX "idx_alert_events_config" RENAME TO "alert_events_configuration_id_idx";

-- RenameIndex
ALTER INDEX "idx_alert_events_created" RENAME TO "alert_events_tenant_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_alert_events_status" RENAME TO "alert_events_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_alert_events_tenant" RENAME TO "alert_events_tenant_id_idx";

-- RenameIndex
ALTER INDEX "idx_alert_events_type" RENAME TO "alert_events_tenant_id_alert_type_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_device_mac_employee_last_seen" RENAME TO "device_mac_addresses_employee_id_last_seen_idx";

-- RenameIndex
ALTER INDEX "idx_device_mac_mac_address" RENAME TO "device_mac_addresses_mac_address_idx";

-- RenameIndex
ALTER INDEX "idx_device_mac_tenant_employee" RENAME TO "device_mac_addresses_tenant_id_employee_id_idx";

-- RenameIndex
ALTER INDEX "idx_device_mac_trust_level" RENAME TO "device_mac_addresses_trust_level_idx";

-- RenameIndex
ALTER INDEX "idx_emergency_contacts_employee" RENAME TO "emergency_contacts_tenant_id_employee_id_idx";

-- RenameIndex
ALTER INDEX "idx_employee_documents_employee" RENAME TO "employee_documents_tenant_id_employee_id_idx";

-- RenameIndex
ALTER INDEX "idx_employee_documents_expiry" RENAME TO "employee_documents_tenant_id_expiry_date_idx";

-- RenameIndex
ALTER INDEX "idx_employee_schedules_employee" RENAME TO "employee_schedules_tenant_id_employee_id_is_active_idx";

-- RenameIndex
ALTER INDEX "idx_employee_schedules_template" RENAME TO "employee_schedules_tenant_id_template_id_idx";

-- RenameIndex
ALTER INDEX "idx_employees_dni" RENAME TO "employees_tenant_id_dni_idx";

-- RenameIndex
ALTER INDEX "idx_employees_location" RENAME TO "employees_tenant_id_location_id_idx";

-- RenameIndex
ALTER INDEX "idx_evaluations_employee" RENAME TO "evaluations_tenant_id_employee_id_period_end_idx";

-- RenameIndex
ALTER INDEX "idx_evaluations_status" RENAME TO "evaluations_tenant_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_leave_requests_employee" RENAME TO "leave_requests_tenant_id_employee_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_leave_requests_status" RENAME TO "leave_requests_tenant_id_status_start_date_idx";

-- RenameIndex
ALTER INDEX "idx_log_config_change_changed_at" RENAME TO "log_configuration_change_changed_at_idx";

-- RenameIndex
ALTER INDEX "idx_log_config_change_module" RENAME TO "log_configuration_change_module_idx";

-- RenameIndex
ALTER INDEX "idx_maintenance_windows_tenant" RENAME TO "maintenance_windows_tenant_id_idx";

-- RenameIndex
ALTER INDEX "idx_maintenance_windows_time" RENAME TO "maintenance_windows_tenant_id_start_time_end_time_idx";

-- RenameIndex
ALTER INDEX "idx_onboarding_steps_status" RENAME TO "onboarding_steps_tenant_id_is_completed_idx";

-- RenameIndex
ALTER INDEX "idx_onboarding_steps_tenant" RENAME TO "onboarding_steps_tenant_id_step_number_idx";

-- RenameIndex
ALTER INDEX "idx_onboarding_steps_unique" RENAME TO "onboarding_steps_tenant_id_step_key_key";

-- RenameIndex
ALTER INDEX "idx_payroll_records_employee" RENAME TO "payroll_records_tenant_id_employee_id_period_month_idx";

-- RenameIndex
ALTER INDEX "idx_payroll_records_period" RENAME TO "payroll_records_tenant_id_period_month_idx";

-- RenameIndex
ALTER INDEX "idx_pin_history_employee" RENAME TO "pin_history_employee_id_changed_at_idx";

-- RenameIndex
ALTER INDEX "idx_pin_history_tenant" RENAME TO "pin_history_tenant_id_changed_at_idx";

-- RenameIndex
ALTER INDEX "idx_recovery_action_log_action_type" RENAME TO "recovery_action_log_action_type_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_recovery_action_log_success" RENAME TO "recovery_action_log_success_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_recovery_action_log_tenant" RENAME TO "recovery_action_log_tenant_id_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_recovery_action_log_user" RENAME TO "recovery_action_log_user_id_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_schedule_templates_location" RENAME TO "schedule_templates_tenant_id_location_id_is_active_idx";

-- RenameIndex
ALTER INDEX "idx_shift_change_requests_requester" RENAME TO "shift_change_requests_tenant_id_requester_id_status_idx";

-- RenameIndex
ALTER INDEX "idx_shift_change_requests_status" RENAME TO "shift_change_requests_tenant_id_status_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_terminal_mac_registry_employee" RENAME TO "terminal_mac_registry_employee_id_terminal_id_idx";

-- RenameIndex
ALTER INDEX "idx_terminal_mac_registry_last_seen" RENAME TO "terminal_mac_registry_terminal_id_last_seen_idx";

-- RenameIndex
ALTER INDEX "idx_terminal_mac_registry_terminal" RENAME TO "terminal_mac_registry_terminal_id_mac_address_idx";

-- RenameIndex
ALTER INDEX "idx_training_records_employee" RENAME TO "training_records_tenant_id_employee_id_completion_date_idx";

-- RenameIndex
ALTER INDEX "idx_training_records_type" RENAME TO "training_records_tenant_id_training_type_idx";

