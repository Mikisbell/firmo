-- CRM Phase 2: RFM columns for customer_profile
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS monetary_30d INT;
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS rfm_segment TEXT;
ALTER TABLE customer_profile ADD COLUMN IF NOT EXISTS rfm_calculated_at TIMESTAMPTZ;
