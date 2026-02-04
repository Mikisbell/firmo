-- Add onboarding_status to tenant_settings
ALTER TABLE tenant_settings ADD COLUMN onboarding_status TEXT DEFAULT 'IN_PROGRESS';

-- Create onboarding_steps table
CREATE TABLE onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    step_number INT NOT NULL,
    step_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for onboarding_steps
CREATE INDEX idx_onboarding_steps_tenant ON onboarding_steps(tenant_id, step_number);
CREATE INDEX idx_onboarding_steps_status ON onboarding_steps(tenant_id, is_completed);
CREATE UNIQUE INDEX idx_onboarding_steps_unique ON onboarding_steps(tenant_id, step_key);
