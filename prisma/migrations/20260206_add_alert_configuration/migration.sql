-- Migración para sistema de configuración de alertas
-- Fecha: 2026-02-06
-- Descripción: Agrega tablas para configuración de alertas y registro de eventos de alertas

-- Tabla de configuración de alertas
CREATE TABLE alert_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'ERROR_RATE', 'RESPONSE_TIME', 'UPTIME', 'CACHE_HIT_RATE', 'DB_POOL'
  threshold_value DECIMAL(10, 2) NOT NULL,
  threshold_unit VARCHAR(20) NOT NULL, -- 'PERCENTAGE', 'MILLISECONDS', 'COUNT'
  comparison_operator VARCHAR(10) NOT NULL, -- 'GT', 'LT', 'GTE', 'LTE', 'EQ'
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB NOT NULL DEFAULT '[]', -- ['email', 'slack', 'webhook']
  notification_config JSONB, -- Configuración específica por canal
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Índices para configuración de alertas
CREATE INDEX idx_alert_configurations_tenant ON alert_configurations(tenant_id);
CREATE INDEX idx_alert_configurations_type ON alert_configurations(tenant_id, alert_type);
CREATE INDEX idx_alert_configurations_enabled ON alert_configurations(tenant_id, enabled);

-- Tabla de eventos de alertas
CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  configuration_id UUID NOT NULL REFERENCES alert_configurations(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL, -- 'INFO', 'WARNING', 'CRITICAL'
  current_value DECIMAL(10, 2) NOT NULL,
  threshold_value DECIMAL(10, 2) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'SNOOZED'
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  snoozed_until TIMESTAMPTZ,
  escalated BOOLEAN NOT NULL DEFAULT false,
  escalated_at TIMESTAMPTZ,
  notifications_sent JSONB DEFAULT '[]', -- Array de notificaciones enviadas
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para eventos de alertas
CREATE INDEX idx_alert_events_tenant ON alert_events(tenant_id);
CREATE INDEX idx_alert_events_config ON alert_events(configuration_id);
CREATE INDEX idx_alert_events_status ON alert_events(tenant_id, status);
CREATE INDEX idx_alert_events_created ON alert_events(tenant_id, created_at DESC);
CREATE INDEX idx_alert_events_type ON alert_events(tenant_id, alert_type, created_at DESC);
CREATE INDEX idx_alert_events_active ON alert_events(tenant_id, status) WHERE status = 'ACTIVE';

-- Tabla de ventanas de mantenimiento (para snoozing)
CREATE TABLE maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  alert_types VARCHAR(50)[], -- Tipos de alertas a silenciar
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

-- Índices para ventanas de mantenimiento
CREATE INDEX idx_maintenance_windows_tenant ON maintenance_windows(tenant_id);
CREATE INDEX idx_maintenance_windows_active ON maintenance_windows(tenant_id, start_time, end_time) 
  WHERE start_time <= NOW() AND end_time >= NOW();

-- Comentarios para documentación
COMMENT ON TABLE alert_configurations IS 'Configuración de umbrales y canales de notificación para alertas del sistema';
COMMENT ON TABLE alert_events IS 'Registro de eventos de alertas disparadas, con estado y seguimiento';
COMMENT ON TABLE maintenance_windows IS 'Ventanas de mantenimiento programadas para silenciar alertas';

COMMENT ON COLUMN alert_configurations.alert_type IS 'Tipo de alerta: ERROR_RATE, RESPONSE_TIME, UPTIME, CACHE_HIT_RATE, DB_POOL';
COMMENT ON COLUMN alert_configurations.threshold_value IS 'Valor umbral que dispara la alerta';
COMMENT ON COLUMN alert_configurations.comparison_operator IS 'Operador de comparación: GT (>), LT (<), GTE (>=), LTE (<=), EQ (=)';
COMMENT ON COLUMN alert_configurations.notification_channels IS 'Canales de notificación habilitados: email, slack, webhook';

COMMENT ON COLUMN alert_events.severity IS 'Severidad del evento: INFO, WARNING, CRITICAL';
COMMENT ON COLUMN alert_events.status IS 'Estado del evento: ACTIVE, ACKNOWLEDGED, RESOLVED, SNOOZED';
COMMENT ON COLUMN alert_events.escalated IS 'Indica si la alerta fue escalada por falta de reconocimiento';
