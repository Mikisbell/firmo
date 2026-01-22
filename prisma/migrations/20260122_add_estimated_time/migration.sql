-- Migration: Add estimated_time column to stations table
-- Created: 22 Enero 2026
-- Purpose: Enable efficiency calculations and alert thresholds for KDS stations

-- Add estimated_time column with default value of 10 minutes
ALTER TABLE stations 
ADD COLUMN estimated_time INTEGER DEFAULT 10 NOT NULL;

-- Add check constraint to ensure valid range (1-60 minutes)
ALTER TABLE stations
ADD CONSTRAINT stations_estimated_time_range 
CHECK (estimated_time >= 1 AND estimated_time <= 60);

-- Add comment explaining the column's purpose
COMMENT ON COLUMN stations.estimated_time IS 
'Estimated preparation time in minutes (1-60). Used for efficiency calculations and alert thresholds. Default is 10 minutes.';
