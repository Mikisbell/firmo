-- Seed default location for the main tenant if none exists.
-- Uses the TENANT_ID and LOCATION_ID values set in env (a1b2c3d4... / 9bc7e15f...).
-- ON CONFLICT DO NOTHING = safe to run multiple times.

INSERT INTO locations (id, tenant_id, code, name, timezone, is_active, created_at, updated_at)
VALUES (
  '9bc7e15f-ca13-43aa-a647-b1e4d46529fd',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'MAIN',
  'Local Principal',
  'America/Lima',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
