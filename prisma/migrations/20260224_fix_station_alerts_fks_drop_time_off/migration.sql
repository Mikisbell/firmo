-- Fix station_alerts FK constraints: NoAction → proper CASCADE/SET NULL
-- Drop deprecated time_off_requests table (replaced by leave_requests)

-- ============================================================================
-- 1. Fix station_alerts FK: dismissed_by → employees (NoAction → SetNull)
-- ============================================================================

-- Drop the old FK
ALTER TABLE "station_alerts" DROP CONSTRAINT IF EXISTS "station_alerts_dismissed_by_fkey";

-- Recreate with SET NULL ON DELETE, CASCADE ON UPDATE
ALTER TABLE "station_alerts"
  ADD CONSTRAINT "station_alerts_dismissed_by_fkey"
  FOREIGN KEY ("dismissed_by") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 2. Fix station_alerts FK: tenant_id → tenants (NoAction → Cascade)
-- ============================================================================

-- Drop the old FK
ALTER TABLE "station_alerts" DROP CONSTRAINT IF EXISTS "station_alerts_tenant_id_fkey";

-- Recreate with CASCADE ON DELETE, CASCADE ON UPDATE
ALTER TABLE "station_alerts"
  ADD CONSTRAINT "station_alerts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 3. Fix station_alerts FK: station_id → stations (NoAction ON UPDATE → Cascade)
-- ============================================================================

-- Drop the old FK
ALTER TABLE "station_alerts" DROP CONSTRAINT IF EXISTS "station_alerts_station_id_fkey";

-- Recreate with CASCADE ON DELETE and CASCADE ON UPDATE
ALTER TABLE "station_alerts"
  ADD CONSTRAINT "station_alerts_station_id_fkey"
  FOREIGN KEY ("station_id") REFERENCES "stations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 4. Drop deprecated time_off_requests table
-- ============================================================================

-- Disable RLS first (if enabled)
ALTER TABLE IF EXISTS "time_off_requests" DISABLE ROW LEVEL SECURITY;

-- Drop policies
DROP POLICY IF EXISTS "tenant_isolation" ON "time_off_requests";

-- Drop the table
DROP TABLE IF EXISTS "time_off_requests";
