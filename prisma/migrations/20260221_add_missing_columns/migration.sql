-- Add missing columns for Yape/Plin QR payments and tenant slugs
-- These columns were added to schema.prisma but not migrated to production DB

-- Tenant slug for public menu URLs (/menu/:slug/:tableId)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "slug" TEXT UNIQUE;

-- Yape/Plin merchant configuration
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "yape_merchant_phone" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "yape_merchant_name" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "plin_merchant_phone" TEXT;
ALTER TABLE "tenant_settings" ADD COLUMN IF NOT EXISTS "plin_merchant_name" TEXT;
