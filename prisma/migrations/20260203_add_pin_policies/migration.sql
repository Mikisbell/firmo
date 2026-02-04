-- Add PIN policy configuration to tenant_settings
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_min_length INT DEFAULT 4;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_max_length INT DEFAULT 6;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_require_digits BOOLEAN DEFAULT true;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_require_special BOOLEAN DEFAULT false;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_expiry_days INT DEFAULT 0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_history_count INT DEFAULT 0;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_lockout_attempts INT DEFAULT 3;
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS pin_lockout_duration_minutes INT DEFAULT 15;

-- Create index for PIN policy lookups
CREATE INDEX IF NOT EXISTS idx_tenant_settings_pin_policies ON tenant_settings(tenant_id);
