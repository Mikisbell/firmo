-- Fix login_attempts table schema
-- Rename created_at to attempted_at to match schema.prisma

-- Step 1: Add new attempted_at column with default
ALTER TABLE login_attempts ADD COLUMN attempted_at TIMESTAMPTZ(6) DEFAULT now();

-- Step 2: Copy data from created_at to attempted_at (if created_at exists)
ALTER TABLE login_attempts DROP CONSTRAINT IF EXISTS login_attempts_pkey CASCADE;

-- Step 3: Drop old created_at column
ALTER TABLE login_attempts DROP COLUMN IF EXISTS created_at;

-- Step 4: Make attempted_at NOT NULL
ALTER TABLE login_attempts ALTER COLUMN attempted_at SET NOT NULL;

-- Step 5: Recreate primary key
ALTER TABLE login_attempts ADD PRIMARY KEY (id);

-- Step 6: Recreate indices
CREATE INDEX IF NOT EXISTS "login_attempts_tenant_id_employee_id_attempted_at_idx" ON login_attempts(tenant_id, employee_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS "login_attempts_tenant_id_pin_hash_attempted_at_idx" ON login_attempts(tenant_id, pin_hash, attempted_at DESC);

-- Step 7: Clean up tenant_settings table (remove PIN policy columns)
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_expiry_days;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_history_count;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_lockout_attempts;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_lockout_duration_minutes;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_max_length;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_min_length;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_require_digits;
ALTER TABLE tenant_settings DROP COLUMN IF EXISTS pin_require_special;
