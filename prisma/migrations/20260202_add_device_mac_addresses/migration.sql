-- CreateTable device_mac_addresses
CREATE TABLE "device_mac_addresses" (
    "mac_address" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_mac_addresses_pkey" PRIMARY KEY ("mac_address")
);

-- CreateIndex
CREATE INDEX "device_mac_addresses_tenant_id_employee_id_idx" ON "device_mac_addresses"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "device_mac_addresses_employee_id_last_seen_idx" ON "device_mac_addresses"("employee_id", "last_seen" DESC);

-- Modify active_sessions table to add mac_address column
ALTER TABLE "active_sessions" ADD COLUMN "mac_address" TEXT;

-- Update existing sessions to have a placeholder MAC (for backward compatibility)
UPDATE "active_sessions" SET "mac_address" = 'UNKNOWN:' || id WHERE "mac_address" IS NULL;

-- Make mac_address NOT NULL
ALTER TABLE "active_sessions" ALTER COLUMN "mac_address" SET NOT NULL;

-- Create index on mac_address
CREATE INDEX "active_sessions_mac_address_idx" ON "active_sessions"("mac_address");

-- Modify audit_log table to add mac_address column
ALTER TABLE "session_audit_log" ADD COLUMN "mac_address" TEXT;

-- Create index on mac_address in audit_log
CREATE INDEX "session_audit_log_mac_address_idx" ON "session_audit_log"("mac_address");

-- Modify security_alerts table to add mac_address column (if not already present)
ALTER TABLE "security_alerts" ADD COLUMN "mac_address" TEXT;

-- Create index on mac_address in security_alerts
CREATE INDEX "security_alerts_mac_address_idx" ON "security_alerts"("mac_address");
