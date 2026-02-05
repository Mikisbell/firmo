-- Migration: Add Performance Indexes
-- Date: 2026-02-05
-- Purpose: Add database indexes for common query patterns to improve performance
-- Requirements: 9.4, 9.5 from system-consolidation-phase1 spec

-- Analysis of required indexes from spec vs existing indexes:
-- 
-- SPEC REQUIREMENT: orders(tenant_id, created_at DESC)
-- STATUS: ✅ ALREADY EXISTS - @@index([tenant_id, created_at(sort: Desc)])
--
-- SPEC REQUIREMENT: orders(status)
-- STATUS: ✅ ALREADY EXISTS - @@index([tenant_id, order_status])
-- NOTE: Column is named 'order_status' not 'status'
--
-- SPEC REQUIREMENT: order_items(order_id)
-- STATUS: ✅ NOT APPLICABLE - No separate order_items table
-- NOTE: Items stored as JSONB in orders.items with GIN index already present
--
-- SPEC REQUIREMENT: events(tenant_id, event_type, created_at DESC)
-- STATUS: ✅ ALREADY EXISTS - @@index([tenant_id, type, occurred_at(sort: Desc)])
-- NOTE: Column is named 'type' not 'event_type', 'occurred_at' not 'created_at'
--
-- SPEC REQUIREMENT: events(aggregate_id, version)
-- STATUS: ⚠️ PARTIAL - Need to add composite index on (entity_id, occurred_at)
-- NOTE: Schema uses 'entity_id' as aggregate_id, no version column (using occurred_at for ordering)
--
-- SPEC REQUIREMENT: products(tenant_id, is_active)
-- STATUS: ❌ MISSING - Need to add this index
--
-- SPEC REQUIREMENT: employees(tenant_id, is_active)
-- STATUS: ✅ ALREADY EXISTS - @@index([tenant_id, is_active])

-- Index 1: events(entity_id, occurred_at) for event sourcing replay
-- Improves queries like: SELECT * FROM events WHERE entity_id = ? ORDER BY occurred_at
-- This supports aggregate reconstruction and event replay patterns
CREATE INDEX IF NOT EXISTS "idx_events_aggregate_replay" ON "events"("entity_id", "occurred_at");

-- Index 2: products(tenant_id, is_active) for active product queries
-- Improves queries like: SELECT * FROM products WHERE tenant_id = ? AND is_active = true
-- This is critical for product catalog queries in POS terminals
CREATE INDEX IF NOT EXISTS "idx_products_tenant_active" ON "products"("tenant_id", "is_active");

-- Summary:
-- ✅ 2 new indexes added
-- ✅ 5 indexes already exist (no action needed)
-- ✅ 1 requirement not applicable (order_items table doesn't exist)
