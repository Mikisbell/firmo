-- Cleanup: deactivate locations that have no active tables
-- Safe to run multiple times (idempotent).
-- Run this in Supabase SQL Editor.
--
-- What it does:
--   Finds locations where no active table has that location_id,
--   and marks them is_active = false.
--   Affects only locations that are currently active AND empty.

UPDATE locations
SET
  is_active   = false,
  updated_at  = now()
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM   tables t
    WHERE  t.location_id = locations.id
      AND  t.is_active   = true
  );

-- Verify result
SELECT id, code, name, is_active, created_at
FROM   locations
ORDER  BY created_at ASC;
