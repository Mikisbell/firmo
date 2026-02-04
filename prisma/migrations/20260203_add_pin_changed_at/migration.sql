-- Add pin_changed_at field to employees table for PIN expiry tracking
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pin_changed_at TIMESTAMPTZ;

-- Create index for PIN expiry lookups
CREATE INDEX IF NOT EXISTS idx_employees_pin_changed_at ON employees(tenant_id, pin_changed_at DESC);
