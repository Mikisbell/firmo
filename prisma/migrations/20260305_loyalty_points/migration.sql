-- Loyalty Points System - Phase 1
-- Adds loyalty_ledger table and loyalty fields to customer_profile + tenant_settings

-- 1. loyalty_ledger: auditable point transaction history
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  type VARCHAR(20) NOT NULL,
  points INT NOT NULL,
  balance_after INT NOT NULL,
  reference_type VARCHAR(20),
  reference_id UUID,
  description TEXT,
  multiplier NUMERIC(3,1) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_tenant_customer
  ON loyalty_ledger(tenant_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_reference
  ON loyalty_ledger(tenant_id, reference_type, reference_id);

-- 2. customer_profile: loyalty fields
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS loyalty_points_balance INT DEFAULT 0;
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS loyalty_lifetime_points INT DEFAULT 0;
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(20) DEFAULT 'BRONCE';
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS loyalty_tier_updated_at TIMESTAMPTZ;

-- 3. tenant_settings: loyalty config
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_points_per_sol INT DEFAULT 1;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_redemption_rate INT DEFAULT 100;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_tiers JSON DEFAULT
  '[{"name":"BRONCE","minPoints":0,"multiplier":1.0},{"name":"PLATA","minPoints":500,"multiplier":1.2},{"name":"ORO","minPoints":2000,"multiplier":1.5},{"name":"PLATINO","minPoints":5000,"multiplier":2.0}]';
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS loyalty_min_redemption_points INT DEFAULT 100;
