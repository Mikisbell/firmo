-- ============================================================================
-- PARK POS - Safe Indices Migration (Sin cambios destructivos)
-- Version: 005
-- Description: Solo índices nuevos, sin modificar constraints existentes
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
-- SHIFTS: Índices adicionales
-- ============================================================================

-- Índice para buscar turno activo por terminal
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

CREATE INDEX IF NOT EXISTS idx_orders_items_gin 
ON orders USING GIN (items jsonb_path_ops);

-- ============================================================================
-- PARTIAL INDEX para órdenes activas (más eficiente para KDS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders (tenant_id, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- ============================================================================
-- Agregar columnas opcionales a event_outbox (si no existen)
-- ============================================================================

DO $$ 
BEGIN
    -- event_type con default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'event_type') THEN
        ALTER TABLE event_outbox ADD COLUMN event_type VARCHAR(100) DEFAULT 'UNKNOWN';
    END IF;
    
    -- aggregate_id opcional
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'aggregate_id') THEN
        ALTER TABLE event_outbox ADD COLUMN aggregate_id UUID;
    END IF;
    
    -- max_attempts con default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'max_attempts') THEN
        ALTER TABLE event_outbox ADD COLUMN max_attempts INT DEFAULT 5;
    END IF;
    
    -- next_retry opcional
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'next_retry') THEN
        ALTER TABLE event_outbox ADD COLUMN next_retry TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- Agregar columnas opcionales a processed_events (si no existen)
-- ============================================================================

DO $$ 
BEGIN
    -- event_type con default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'event_type') THEN
        ALTER TABLE processed_events ADD COLUMN event_type VARCHAR(100) DEFAULT 'UNKNOWN';
    END IF;
    
    -- aggregate_id opcional
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'aggregate_id') THEN
        ALTER TABLE processed_events ADD COLUMN aggregate_id UUID;
    END IF;
    
    -- processor con default
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'processor') THEN
        ALTER TABLE processed_events ADD COLUMN processor VARCHAR(50) DEFAULT 'projection';
    END IF;
END $$;

-- ============================================================================
-- Índices adicionales para las nuevas columnas
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_outbox_retry 
ON event_outbox (published, next_retry) 
WHERE published = false;

CREATE INDEX IF NOT EXISTS idx_outbox_type 
ON event_outbox (event_type, published);

CREATE INDEX IF NOT EXISTS idx_processed_aggregate 
ON processed_events (tenant_id, aggregate_id);

-- ============================================================================
-- Verificación
-- ============================================================================

SELECT 'Índices creados exitosamente' AS status;
