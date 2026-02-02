-- Hybrid MAC Detection Model Migration
-- Supports both device binding (per employee) and terminal access audit (per terminal)
-- Special UUID: 00000000-0000-0000-0000-000000000000 = valid for any terminal

-- 1. Modify device_mac_addresses table to support hybrid model
-- Drop old table if exists (for fresh migration)
DROP TABLE IF EXISTS device_mac_addresses CASCADE;

-- Create new hybrid device_mac_addresses table
CREATE TABLE device_mac_addresses (
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  terminal_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',  -- Special UUID = any terminal
  
  tenant_id UUID NOT NULL,
  location_id UUID,
  
  trust_level VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',  -- TRUSTED, UNKNOWN, BLOCKED
  
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add composite primary key using constraint
ALTER TABLE device_mac_addresses 
ADD CONSTRAINT pk_device_mac_addresses PRIMARY KEY (mac_address, employee_id, terminal_id);

-- Indexes for fast lookups
CREATE INDEX idx_device_mac_tenant_employee 
  ON device_mac_addresses(tenant_id, employee_id);

CREATE INDEX idx_device_mac_terminal 
  ON device_mac_addresses(terminal_id) 
  WHERE terminal_id != '00000000-0000-0000-0000-000000000000';

CREATE INDEX idx_device_mac_employee_last_seen 
  ON device_mac_addresses(employee_id, last_seen DESC);

CREATE INDEX idx_device_mac_trust_level
  ON device_mac_addresses(trust_level);

CREATE INDEX idx_device_mac_mac_address
  ON device_mac_addresses(mac_address);

-- 2. Create terminal_mac_registry table for audit trail
CREATE TABLE terminal_mac_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  terminal_id UUID NOT NULL,
  mac_address VARCHAR(17) NOT NULL,
  employee_id UUID NOT NULL,
  
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_count INT NOT NULL DEFAULT 1,
  is_authorized BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for terminal access audit
CREATE INDEX idx_terminal_mac_registry_terminal
  ON terminal_mac_registry(terminal_id, mac_address);

CREATE INDEX idx_terminal_mac_registry_employee
  ON terminal_mac_registry(employee_id, terminal_id);

CREATE INDEX idx_terminal_mac_registry_unauthorized
  ON terminal_mac_registry(is_authorized) 
  WHERE is_authorized = FALSE;

CREATE INDEX idx_terminal_mac_registry_last_seen
  ON terminal_mac_registry(terminal_id, last_seen DESC);

-- 3. Update active_sessions to include terminal_id if not exists
ALTER TABLE active_sessions 
ADD COLUMN IF NOT EXISTS terminal_id UUID;

-- Add index for terminal_id
CREATE INDEX IF NOT EXISTS idx_active_sessions_terminal_id
  ON active_sessions(terminal_id);

-- 4. Add mac_address column to active_sessions if not exists
ALTER TABLE active_sessions 
ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17);

-- Add index for mac_address
CREATE INDEX IF NOT EXISTS idx_active_sessions_mac_address
  ON active_sessions(mac_address);

-- 5. Ensure session_alerts has mac_address column
ALTER TABLE session_alerts 
ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17);

-- Add index for mac_address in session_alerts
CREATE INDEX IF NOT EXISTS idx_session_alerts_mac_address
  ON session_alerts(mac_address);
