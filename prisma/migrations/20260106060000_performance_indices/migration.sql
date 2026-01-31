-- Performance Indices Migration
-- PARK POS - Enero 2026
-- Optimiza queries críticos para producción

-- ============================================================================
-- EVENTOS: Índices para sync y replay
-- ============================================================================

-- Índice para buscar eventos por terminal y secuencia (sync)
CREATE INDEX IF NOT EXISTS idx_events_terminal_sequence 
ON events(terminal_id, payload_version);

-- Índice parcial para eventos pendientes de outbox (solo no publicados)
CREATE INDEX IF NOT EXISTS idx_outbox_pending 
ON event_outbox(tenant_id, created_at) 
WHERE published = false;

-- ============================================================================
-- ÓRDENES: Índices para KDS y operaciones
-- ============================================================================

-- Índice GIN para búsqueda en stations_active (KDS)
CREATE INDEX IF NOT EXISTS idx_orders_stations_gin 
ON orders USING GIN(stations_active);

-- Índice parcial para órdenes activas (las más consultadas)
CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders(tenant_id, order_status, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- Índice parcial para checks sin pagar
CREATE INDEX IF NOT EXISTS idx_orders_unpaid 
ON orders(tenant_id, unpaid_checks_count) 
WHERE unpaid_checks_count > 0;

-- ============================================================================
-- SHIFTS: Índices para turnos abiertos
-- ============================================================================

-- Índice parcial para turnos abiertos
CREATE INDEX IF NOT EXISTS idx_shifts_open 
ON shifts(tenant_id, terminal_id, opened_at DESC) 
WHERE status = 'OPEN';

-- ============================================================================
-- PRODUCTOS: Índice para búsqueda por estación (KDS)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_station 
ON products(tenant_id, station, is_active) 
WHERE is_active = true;

-- ============================================================================
-- PROCESSED EVENTS: Índice para cleanup (sin función NOW())
-- ============================================================================

-- Índice simple para cleanup por fecha
CREATE INDEX IF NOT EXISTS idx_processed_events_cleanup 
ON processed_events(processed_at);

-- ============================================================================
-- INVOICES: Índice para reportes diarios
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_invoices_daily 
ON invoices(tenant_id, status, created_at);

-- ============================================================================
-- DAILY SALES: Índice para reportes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_daily_sales_range 
ON daily_sales_summary(tenant_id, business_date DESC);

-- ============================================================================
-- ANALYZE: Actualizar estadísticas
-- ============================================================================

ANALYZE events;
ANALYZE orders;
ANALYZE shifts;
ANALYZE products;
ANALYZE invoices;
ANALYZE event_outbox;
ANALYZE processed_events;
