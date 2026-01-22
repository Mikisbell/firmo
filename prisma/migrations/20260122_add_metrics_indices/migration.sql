-- Migration: Add performance indices for KDS metrics
-- Created: 22 Enero 2026
-- Purpose: Optimize queries for real-time metrics calculation

-- Note: This system uses JSON fields for items in the orders table
-- We'll create indices on the orders table to optimize metrics queries

-- Optimize active orders queries (PENDING, COOKING status)
CREATE INDEX idx_orders_fulfillment_status_created ON orders(
  tenant_id,
  fulfillment_status,
  created_at DESC
) WHERE fulfillment_status IN ('COOKING', 'READY');

-- Optimize completed orders queries for average time calculation
CREATE INDEX idx_orders_completed_updated ON orders(
  tenant_id,
  fulfillment_status,
  updated_at DESC
) WHERE fulfillment_status = 'DELIVERED';

-- Optimize business date queries for daily metrics
CREATE INDEX idx_orders_business_date_status ON orders(
  tenant_id,
  business_date DESC,
  fulfillment_status
) WHERE business_date IS NOT NULL;

-- Optimize shift-based queries
CREATE INDEX idx_orders_shift_status ON orders(
  tenant_id,
  shift_id,
  fulfillment_status,
  created_at DESC
) WHERE shift_id IS NOT NULL;

-- Add GIN index for JSON items field to enable efficient station filtering
-- This allows queries like: WHERE items @> '[{"station": "PARRILLA"}]'
CREATE INDEX idx_orders_items_gin ON orders USING GIN (items jsonb_path_ops);

-- Comments
COMMENT ON INDEX idx_orders_fulfillment_status_created IS 'Optimizes active orders queries for KDS metrics';
COMMENT ON INDEX idx_orders_completed_updated IS 'Optimizes average time calculations for completed orders';
COMMENT ON INDEX idx_orders_business_date_status IS 'Optimizes daily metrics aggregation';
COMMENT ON INDEX idx_orders_items_gin IS 'Enables efficient station-based filtering on JSON items field';
