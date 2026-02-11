-- Migración: Agregar tablas de configuración de logs
-- Fecha: 11 Febrero 2026
-- Propósito: Soportar configuración dinámica de niveles de log por módulo

-- Tabla de configuración de niveles de log
CREATE TABLE IF NOT EXISTS log_configuration (
  module TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- Tabla de historial de cambios (audit trail)
CREATE TABLE IF NOT EXISTS log_configuration_change (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  module TEXT NOT NULL,
  previous_level TEXT NOT NULL,
  new_level TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason TEXT,
  
  -- Índice para búsquedas por módulo y fecha
  CONSTRAINT log_configuration_change_module_idx 
    CHECK (module IN ('auth', 'sync', 'events', 'orders', 'global'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_log_config_change_module 
  ON log_configuration_change(module);

CREATE INDEX IF NOT EXISTS idx_log_config_change_changed_at 
  ON log_configuration_change(changed_at DESC);

-- Comentarios para documentación
COMMENT ON TABLE log_configuration IS 
  'Configuración actual de niveles de log por módulo';

COMMENT ON TABLE log_configuration_change IS 
  'Historial de cambios de configuración de logs (audit trail)';

COMMENT ON COLUMN log_configuration.module IS 
  'Módulo del sistema (auth, sync, events, orders, global)';

COMMENT ON COLUMN log_configuration.level IS 
  'Nivel de log (DEBUG, INFO, WARN, ERROR, FATAL)';

COMMENT ON COLUMN log_configuration_change.changed_by IS 
  'Usuario que realizó el cambio (user_id o "system")';

COMMENT ON COLUMN log_configuration_change.reason IS 
  'Razón del cambio (opcional, para troubleshooting)';
