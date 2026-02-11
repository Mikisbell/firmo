-- Migración: Tabla de registro de acciones de recuperación
-- Fecha: 11 Febrero 2026
-- Propósito: Registrar todas las acciones de recuperación manual y automática

-- Crear tabla recovery_action_log
CREATE TABLE IF NOT EXISTS recovery_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  tenant_id UUID,
  user_id UUID,
  reason TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  message TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata JSONB,
  details JSONB,
  rollback_available BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_recovery_action_log_tenant ON recovery_action_log(tenant_id, timestamp DESC);
CREATE INDEX idx_recovery_action_log_action_type ON recovery_action_log(action_type, timestamp DESC);
CREATE INDEX idx_recovery_action_log_user ON recovery_action_log(user_id, timestamp DESC);
CREATE INDEX idx_recovery_action_log_success ON recovery_action_log(success, timestamp DESC);

-- Comentarios
COMMENT ON TABLE recovery_action_log IS 'Registro de auditoría de acciones de recuperación manual y automática';
COMMENT ON COLUMN recovery_action_log.action_type IS 'Tipo de acción: CLEAR_CACHE, RESET_SYNC, REBUILD_PROJECTIONS, RESTART_SERVICE, PURGE_QUEUE';
COMMENT ON COLUMN recovery_action_log.tenant_id IS 'ID del tenant afectado (opcional)';
COMMENT ON COLUMN recovery_action_log.user_id IS 'ID del usuario que ejecutó la acción (opcional para acciones automáticas)';
COMMENT ON COLUMN recovery_action_log.reason IS 'Razón de la acción de recuperación';
COMMENT ON COLUMN recovery_action_log.success IS 'Indica si la acción fue exitosa';
COMMENT ON COLUMN recovery_action_log.message IS 'Mensaje descriptivo del resultado';
COMMENT ON COLUMN recovery_action_log.duration_ms IS 'Duración de la acción en milisegundos';
COMMENT ON COLUMN recovery_action_log.metadata IS 'Metadatos adicionales de la acción';
COMMENT ON COLUMN recovery_action_log.details IS 'Detalles del resultado de la acción';
COMMENT ON COLUMN recovery_action_log.rollback_available IS 'Indica si la acción puede ser revertida';
COMMENT ON COLUMN recovery_action_log.timestamp IS 'Timestamp de la acción';
