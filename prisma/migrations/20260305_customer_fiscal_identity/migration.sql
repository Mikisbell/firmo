-- Customer Fiscal Identity
-- Adds doc_type (RUC/DNI/CE/PASSPORT) and doc_number to customers table
-- Adds customer_name snapshot to invoices table

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "doc_type" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "doc_number" TEXT;

-- Partial unique index: one doc_number per tenant (only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS "customers_tenant_id_doc_number_key"
  ON "customers" ("tenant_id", "doc_number")
  WHERE "doc_number" IS NOT NULL;

-- Lookup index for searching customers by doc_number within a tenant
CREATE INDEX IF NOT EXISTS "customers_tenant_id_doc_type_idx"
  ON "customers" ("tenant_id", "doc_type")
  WHERE "doc_type" IS NOT NULL;

-- Snapshot customer name at invoice emission time (for SUNAT queue worker)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_name" TEXT;
