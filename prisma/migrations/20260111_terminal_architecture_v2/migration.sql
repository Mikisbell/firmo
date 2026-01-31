-- Terminal Architecture v2 - Device Binding & Security
-- Migration: 20260111_terminal_architecture_v2

-- CreateTable: terminal_devices
CREATE TABLE IF NOT EXISTS "terminal_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "terminal_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "fingerprint_hash" TEXT,
    "fingerprint_salt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bound_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_fingerprint_check" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drift_score" INTEGER NOT NULL DEFAULT 0,
    "location_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminal_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: activation_codes
CREATE TABLE IF NOT EXISTS "activation_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "terminal_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: auth_events
CREATE TABLE IF NOT EXISTS "auth_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "employee_id" UUID,
    "event_type" TEXT NOT NULL,
    "risk_score" INTEGER,
    "fingerprint_match" INTEGER,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: security_alerts
CREATE TABLE IF NOT EXISTS "security_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: terminal_devices
CREATE UNIQUE INDEX IF NOT EXISTS "terminal_devices_terminal_id_key" ON "terminal_devices"("terminal_id");
CREATE INDEX IF NOT EXISTS "terminal_devices_tenant_id_idx" ON "terminal_devices"("tenant_id");
CREATE INDEX IF NOT EXISTS "terminal_devices_status_idx" ON "terminal_devices"("status");
CREATE INDEX IF NOT EXISTS "terminal_devices_tenant_id_status_idx" ON "terminal_devices"("tenant_id", "status");

-- CreateIndex: activation_codes
CREATE INDEX IF NOT EXISTS "activation_codes_code_idx" ON "activation_codes"("code");
CREATE INDEX IF NOT EXISTS "activation_codes_terminal_id_idx" ON "activation_codes"("terminal_id");
CREATE INDEX IF NOT EXISTS "activation_codes_expires_at_idx" ON "activation_codes"("expires_at");

-- CreateIndex: auth_events
CREATE INDEX IF NOT EXISTS "auth_events_tenant_id_created_at_idx" ON "auth_events"("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_events_terminal_id_idx" ON "auth_events"("terminal_id");
CREATE INDEX IF NOT EXISTS "auth_events_event_type_idx" ON "auth_events"("event_type");
CREATE INDEX IF NOT EXISTS "auth_events_tenant_id_event_type_created_at_idx" ON "auth_events"("tenant_id", "event_type", "created_at" DESC);

-- CreateIndex: security_alerts
CREATE INDEX IF NOT EXISTS "security_alerts_tenant_id_acknowledged_idx" ON "security_alerts"("tenant_id", "acknowledged");
CREATE INDEX IF NOT EXISTS "security_alerts_severity_idx" ON "security_alerts"("severity");
CREATE INDEX IF NOT EXISTS "security_alerts_tenant_id_severity_acknowledged_idx" ON "security_alerts"("tenant_id", "severity", "acknowledged");

-- AddForeignKey: activation_codes -> terminal_devices
ALTER TABLE "activation_codes" ADD CONSTRAINT "activation_codes_terminal_id_fkey" 
    FOREIGN KEY ("terminal_id") REFERENCES "terminal_devices"("terminal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: auth_events -> terminal_devices
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_terminal_id_fkey" 
    FOREIGN KEY ("terminal_id") REFERENCES "terminal_devices"("terminal_id") ON DELETE RESTRICT ON UPDATE CASCADE;
