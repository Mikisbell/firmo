-- Invoice ↔ Customer linking + Peru Identity API token
-- Links invoices to customer profiles and enables RENIEC/SUNAT lookups

-- 1. Add customer_id FK to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_id" UUID REFERENCES "customers"("id");
CREATE INDEX IF NOT EXISTS "idx_invoices_customer_id" ON "invoices"("tenant_id", "customer_id");

-- 2. Add Peru identity API token to tenant settings
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "peru_identity_api_token" TEXT;
