-- Create PIN history table for tracking PIN changes
CREATE TABLE IF NOT EXISTS pin_history (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    pin_hash TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by UUID,
    reason TEXT
);

-- Create indexes for PIN history lookups
CREATE INDEX IF NOT EXISTS idx_pin_history_employee ON pin_history(employee_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_history_tenant ON pin_history(tenant_id, changed_at DESC);
