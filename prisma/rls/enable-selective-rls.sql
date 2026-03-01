-- ============================================================================
-- PARK POS — Selective Row-Level Security (RLS)
-- ============================================================================
-- Applies RLS to sensitive tables as defense-in-depth.
-- Application code still filters by tenant_id via middleware,
-- but RLS catches any missed WHERE clauses.
--
-- PREREQUISITE: Set app.current_tenant_id at connection start:
--   SET LOCAL app.current_tenant_id = '<tenant_uuid>';
--
-- Execute in Supabase SQL Editor or via: npx prisma db execute --file prisma/rls/enable-selective-rls.sql
--
-- Date: Mar 1, 2026 | ADR-009 update
-- ============================================================================

-- 1. Enable RLS on sensitive tables (does NOT affect existing queries until policies created)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_events ENABLE ROW LEVEL SECURITY;

-- 2. Create tenant isolation policies
-- These use current_setting('app.current_tenant_id') which must be SET per connection.

-- Events: most critical — all event data scoped to tenant
CREATE POLICY tenant_isolation_events ON events
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Orders: financial data
CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Employees: PII (names, PINs, roles)
CREATE POLICY tenant_isolation_employees ON employees
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Payments: financial transactions
CREATE POLICY tenant_isolation_payments ON payments
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Active sessions: security-sensitive
CREATE POLICY tenant_isolation_sessions ON active_sessions
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Archived events: historical data
CREATE POLICY tenant_isolation_archived ON archived_events
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Pending events: out-of-order queue
CREATE POLICY tenant_isolation_pending ON pending_events
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- 3. Service role bypass (Supabase service_role can access all data)
-- This is necessary for cross-tenant admin operations and migrations.
-- The service_role key should NEVER be exposed to the client.

-- Supabase automatically grants the service_role bypass when using
-- supabase.auth.admin or the service_role key. If using raw SQL connections
-- (like Prisma with connection string), the role is typically 'postgres'
-- which bypasses RLS by default as a superuser.

-- 4. Verify RLS is enabled (run after applying)
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('events', 'orders', 'employees', 'payments',
--                   'active_sessions', 'archived_events', 'pending_events');
