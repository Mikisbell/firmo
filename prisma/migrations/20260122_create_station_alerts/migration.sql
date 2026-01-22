-- Migration: Create station_alerts table
-- Created: 22 Enero 2026
-- Purpose: Store performance alerts for KDS stations

-- Create station_alerts table
CREATE TABLE station_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('avg_time', 'load', 'efficiency')),
  metric_value DECIMAL(10, 2) NOT NULL,
  threshold_value DECIMAL(10, 2) NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  dismissed_at TIMESTAMP,
  dismissed_by UUID REFERENCES employees(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Ensure dismissed_at is set when is_dismissed is true
  CONSTRAINT dismissed_at_required CHECK (
    (is_dismissed = FALSE AND dismissed_at IS NULL) OR
    (is_dismissed = TRUE AND dismissed_at IS NOT NULL)
  )
);

-- Create indices for performance
CREATE INDEX idx_station_alerts_station_id ON station_alerts(station_id);
CREATE INDEX idx_station_alerts_is_dismissed ON station_alerts(is_dismissed) WHERE is_dismissed = FALSE;
CREATE INDEX idx_station_alerts_created_at ON station_alerts(created_at DESC);
CREATE INDEX idx_station_alerts_severity ON station_alerts(severity) WHERE is_dismissed = FALSE;
CREATE INDEX idx_station_alerts_tenant_id ON station_alerts(tenant_id);

-- Add comments
COMMENT ON TABLE station_alerts IS 'Stores performance alerts for KDS stations';
COMMENT ON COLUMN station_alerts.metric_type IS 'Type of metric that triggered the alert (avg_time, load, efficiency)';
COMMENT ON COLUMN station_alerts.metric_value IS 'Actual value of the metric when alert was generated';
COMMENT ON COLUMN station_alerts.threshold_value IS 'Threshold value that was exceeded';
COMMENT ON COLUMN station_alerts.severity IS 'Alert severity level: high (critical), medium (warning), low (info)';
COMMENT ON COLUMN station_alerts.is_dismissed IS 'Whether the alert has been acknowledged and dismissed by an admin';
