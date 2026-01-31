-- ============================================================================
-- PARK POS - Performance Indices Migration
-- Version: 003
-- Description: Índices adicionales para mejorar performance de Event Sourcing y KDS
-- ============================================================================

-- ============================================================================
-- EVENTS: Índices para replay y sync
-- ============================================================================

-- Índice para replay de eventos por aggregate (entity_id)
CREATE INDEX IF NOT EXISTS idx_events_replay 
ON events (tenant_id, entity_id, occurred_at ASC);

-- Índice para filtrar por tipo de evento
CREATE INDEX IF NOT EXISTS idx_events_by_type 
ON events (tenant_id, type, occurred_at DESC);

-- Índice para sync por terminal
CREATE INDEX IF NOT EXISTS idx_events_by_terminal 
ON events (terminal_id, occurred_at DESC);

-- ============================================================================
-- SHIFTS: Índice para buscar turno activo por terminal
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shifts_terminal_status 
ON shifts (tenant_id, terminal_id, status);

-- Índice para historial de turnos
CREATE INDEX IF NOT EXISTS idx_shifts_history 
ON shifts (tenant_id, opened_at DESC);

-- ============================================================================
-- ORDERS: Índices para KDS y búsquedas
-- ============================================================================

-- Índice para buscar por número de orden
CREATE INDEX IF NOT EXISTS idx_orders_number 
ON orders (tenant_id, order_number);

-- Índice para órdenes por terminal
CREATE INDEX IF NOT EXISTS idx_orders_terminal 
ON orders (tenant_id, terminal_id, created_at DESC);

-- Índice para KDS queries (fulfillment_status)
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment 
ON orders (tenant_id, fulfillment_status);

-- ============================================================================
-- PRODUCTS: Índice para búsqueda por estación
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_station 
ON products (tenant_id, station, is_active);

-- ============================================================================
-- EVENT_OUTBOX: Índice para worker de publicación
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_outbox_pending 
ON event_outbox (published, created_at) 
WHERE published = false;

-- ============================================================================
-- PROCESSED_EVENTS: Índice para limpieza
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_processed_cleanup 
ON processed_events (tenant_id, processed_at);

-- ============================================================================
-- GIN INDEX para búsqueda en JSONB de items (para KDS)
-- ============================================================================

-- Índice GIN para buscar items por station dentro del JSON
CREATE INDEX IF NOT EXISTS idx_orders_items_gin 
ON orders USING GIN (items jsonb_path_ops);

-- ============================================================================
-- PARTIAL INDEX para órdenes activas (más eficiente para KDS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders (tenant_id, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON INDEX idx_events_replay IS 'Optimiza replay de eventos por aggregate para Event Sourcing';
COMMENT ON INDEX idx_events_by_type IS 'Optimiza filtrado de eventos por tipo';
COMMENT ON INDEX idx_shifts_terminal_status IS 'Optimiza búsqueda de turno activo por terminal';
COMMENT ON INDEX idx_orders_fulfillment IS 'Optimiza queries de KDS por estado de preparación';
COMMENT ON INDEX idx_orders_items_gin IS 'Permite búsqueda eficiente dentro del JSON de items';
COMMENT ON INDEX idx_orders_active IS 'Partial index para órdenes activas - más eficiente para KDS';
