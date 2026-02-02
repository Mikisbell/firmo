-- CreateTable active_sessions
CREATE TABLE "active_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "device_id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT,
    "location_lat" DECIMAL(10,7),
    "location_lng" DECIMAL(10,7),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_suspicious" BOOLEAN NOT NULL DEFAULT false,
    "blocked_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable session_alerts
CREATE TABLE "session_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "alert_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ip_address" TEXT,
    "location_lat" DECIMAL(10,7),
    "location_lng" DECIMAL(10,7),
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable transaction_limits
CREATE TABLE "transaction_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "max_transactions_per_hour" INTEGER NOT NULL DEFAULT 100,
    "max_transactions_per_day" INTEGER NOT NULL DEFAULT 500,
    "max_amount_per_transaction" INTEGER NOT NULL DEFAULT 100000,
    "max_price_changes_per_hour" INTEGER NOT NULL DEFAULT 20,
    "max_refunds_per_day" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable session_audit_log
CREATE TABLE "session_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "ip_address" TEXT,
    "session_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_sessions_session_token_key" ON "active_sessions"("session_token");

-- CreateIndex
CREATE INDEX "active_sessions_tenant_employee_active" ON "active_sessions"("tenant_id", "employee_id", "is_active");

-- CreateIndex
CREATE INDEX "active_sessions_terminal_active" ON "active_sessions"("terminal_id", "is_active");

-- CreateIndex
CREATE INDEX "active_sessions_ip_address" ON "active_sessions"("ip_address");

-- CreateIndex
CREATE INDEX "session_alerts_tenant_type_resolved" ON "session_alerts"("tenant_id", "alert_type", "is_resolved");

-- CreateIndex
CREATE INDEX "session_alerts_employee_created" ON "session_alerts"("employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "session_alerts_created" ON "session_alerts"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_limits_tenant_employee_key" ON "transaction_limits"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "session_audit_log_tenant_employee_created" ON "session_audit_log"("tenant_id", "employee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "session_audit_log_action_created" ON "session_audit_log"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "session_audit_log_created" ON "session_audit_log"("created_at" DESC);
