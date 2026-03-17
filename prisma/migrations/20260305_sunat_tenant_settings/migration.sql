-- Add SUNAT electronic invoicing columns to tenant_settings
-- These columns were added to the Prisma schema during P4.1 SUNAT implementation
-- but never migrated to the database.

ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_provider" TEXT DEFAULT 'NONE';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_mode" TEXT DEFAULT 'DISABLED';
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_sol_user" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_sol_password" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_certificate_pem" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_private_key_pem" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "sunat_cert_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "nubefact_token" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "nubefact_url" TEXT;
