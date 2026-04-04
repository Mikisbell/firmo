-- Add tracking_code column for public delivery tracking
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;

-- Index for fast lookups by tracking code
CREATE INDEX IF NOT EXISTS idx_delivery_orders_tracking_code ON delivery_orders (tracking_code) WHERE tracking_code IS NOT NULL;
