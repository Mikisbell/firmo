-- Admin Notifications System
-- Tabla para notificaciones del panel de administración

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('OPERATIONAL', 'BUSINESS', 'INFO')),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  category VARCHAR(20) NOT NULL CHECK (category IN ('KDS', 'INVENTORY', 'TERMINAL', 'PAYMENT', 'EMPLOYEE', 'SYSTEM', 'DELIVERY')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  viewed BOOLEAN DEFAULT FALSE,
  actionable BOOLEAN DEFAULT FALSE,
  action_type VARCHAR(20) CHECK (action_type IN ('NAVIGATE', 'MODAL', 'API_CALL')),
  action_target VARCHAR(255),
  action_label VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_admin_notif_tenant_unread ON admin_notifications(tenant_id, read, created_at DESC);
CREATE INDEX idx_admin_notif_tenant_priority ON admin_notifications(tenant_id, priority, created_at DESC);
CREATE INDEX idx_admin_notif_expires ON admin_notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Comentarios
COMMENT ON TABLE admin_notifications IS 'Notificaciones para el panel de administración';
COMMENT ON COLUMN admin_notifications.type IS 'Tipo: OPERATIONAL (crítico), BUSINESS (negocio), INFO (informativo)';
COMMENT ON COLUMN admin_notifications.priority IS 'Prioridad: HIGH, MEDIUM, LOW';
COMMENT ON COLUMN admin_notifications.category IS 'Categoría: KDS, INVENTORY, TERMINAL, PAYMENT, EMPLOYEE, SYSTEM, DELIVERY';
COMMENT ON COLUMN admin_notifications.viewed IS 'Vista en dropdown (no necesariamente leída)';
COMMENT ON COLUMN admin_notifications.read IS 'Marcada como leída por el usuario';
