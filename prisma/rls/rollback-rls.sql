-- ============================================================================
-- PARK POS — Rollback Row-Level Security (RLS)
-- ============================================================================
-- Version: 1.0 | Date: Mar 2, 2026
--
-- Removes all RLS policies and disables RLS on the 7 tables protected
-- by enable-selective-rls.sql. Use this to revert to pre-RLS state.
--
-- This script is IDEMPOTENT: safe to run multiple times.
-- Running this when RLS is already disabled has no effect.
--
-- EXECUTION:
--   Option A: Supabase Dashboard > SQL Editor > paste & run
--   Option B: npx prisma db execute --file prisma/rls/rollback-rls.sql
--
-- IMPACT:
--   - Zero downtime — ALTER TABLE ... DISABLE ROW LEVEL SECURITY is instant
--   - Zero application changes needed — Prisma as superuser was already
--     bypassing RLS, so disabling it changes nothing for the app
--   - Non-superuser connections will regain full access to all rows
-- ============================================================================

-- ============================================================================
-- 1. EVENTS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_events ON events;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. ORDERS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. EMPLOYEES
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. PAYMENTS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_payments ON payments;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. ACTIVE_SESSIONS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_sessions ON active_sessions;
ALTER TABLE active_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. ARCHIVED_EVENTS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_archived ON archived_events;
ALTER TABLE archived_events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. PENDING_EVENTS
-- ============================================================================
DROP POLICY IF EXISTS tenant_isolation_pending ON pending_events;
ALTER TABLE pending_events DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFICATION QUERY — run after rollback to confirm RLS is disabled
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
-- Expected: all 7 rows should show rowsecurity = false
-- ============================================================================
