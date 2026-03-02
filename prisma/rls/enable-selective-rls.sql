-- ============================================================================
-- PARK POS — P3.5 Guardrail Row-Level Security (RLS)
-- ============================================================================
-- Version: 2.0 | Date: Mar 2, 2026 | ADR-009 implementation
--
-- Enables RLS on 7 sensitive tables as defense-in-depth.
-- Application code still filters by tenant_id via middleware;
-- RLS catches any access path that bypasses middleware (Dashboard,
-- Supabase client libraries, ad-hoc SQL with non-superuser roles).
--
-- IMPORTANT:
--   - Prisma connects as `postgres` (superuser) which BYPASSES RLS.
--     This script has ZERO impact on the running application.
--   - Non-superuser connections must SET LOCAL app.current_tenant_id
--     before querying these tables, or they will see 0 rows.
--   - This script is IDEMPOTENT: safe to run multiple times.
--
-- EXECUTION:
--   Option A: Supabase Dashboard > SQL Editor > paste & run
--   Option B: npx prisma db execute --file prisma/rls/enable-selective-rls.sql
--
-- ROLLBACK:
--   Execute prisma/rls/rollback-rls.sql
--
-- VERIFICATION:
--   npx tsx scripts/check-rls-status.ts
-- ============================================================================

-- ============================================================================
-- 1. EVENTS — all event-sourced data, most critical table
-- ============================================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_events ON events;
CREATE POLICY tenant_isolation_events ON events
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 2. ORDERS — financial data (order totals, items, status)
-- ============================================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
CREATE POLICY tenant_isolation_orders ON orders
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 3. EMPLOYEES — PII (names, PINs, roles, phone numbers)
-- ============================================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
CREATE POLICY tenant_isolation_employees ON employees
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 4. PAYMENTS — financial transactions
-- ============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
CREATE POLICY tenant_isolation_payments ON payments
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 5. ACTIVE_SESSIONS — security-sensitive (auth sessions, terminals)
-- ============================================================================
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sessions ON active_sessions;
CREATE POLICY tenant_isolation_sessions ON active_sessions
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 6. ARCHIVED_EVENTS — historical event data
-- ============================================================================
ALTER TABLE archived_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_archived ON archived_events;
CREATE POLICY tenant_isolation_archived ON archived_events
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- 7. PENDING_EVENTS — out-of-order event queue
-- ============================================================================
ALTER TABLE pending_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_pending ON pending_events;
CREATE POLICY tenant_isolation_pending ON pending_events
  FOR ALL
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ============================================================================
-- VERIFICATION QUERY — run after applying to confirm RLS is active
-- ============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--   'events', 'orders', 'employees', 'payments',
--   'active_sessions', 'archived_events', 'pending_events'
-- )
-- ORDER BY tablename;
--
-- Expected: all 7 rows should show rowsecurity = true
-- ============================================================================
