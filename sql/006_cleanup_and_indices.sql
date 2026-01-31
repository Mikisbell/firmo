-- ============================================================================
-- PARK POS - Limpieza de Datos Huérfanos + Índices
-- Version: 006
-- Description: Limpia FK violations y aplica índices de performance
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Diagnóstico - Ver datos huérfanos
-- ============================================================================

-- Delivery addresses sin customer válido
SELECT 'delivery_addresses huérfanas:' AS check_type, COUNT(*) AS count
FROM delivery_addresses da
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = da.customer_id);

-- Coupons sin customer válido
SELECT 'coupons sin customer:' AS check_type, COUNT(*) AS count
FROM coupons cp
WHERE cp.customer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = cp.customer_id);

-- Coupons sin promotion válida
SELECT 'coupons sin promotion:' AS check_type, COUNT(*) AS count
FROM coupons cp
WHERE cp.promotion_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = cp.promotion_id);

-- Invoices sin order válida
SELECT 'invoices sin order:' AS check_type, COUNT(*) AS count
FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = i.order_id);

-- Orders sin promotion válida
SELECT 'orders sin promotion:' AS check_type, COUNT(*) AS count
FROM orders o
WHERE o.promotion_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = o.promotion_id);

-- Shifts sin employee opener
SELECT 'shifts sin opener:' AS check_type, COUNT(*) AS count
FROM shifts s
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = s.opened_by);

-- ============================================================================
-- PASO 2: Limpieza de datos huérfanos
-- ============================================================================

-- 2.1 Eliminar delivery_addresses huérfanas
DELETE FROM delivery_addresses da
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = da.customer_id);

-- 2.2 Limpiar coupons con customer_id inválido (set NULL en vez de delete)
UPDATE coupons SET customer_id = NULL
WHERE customer_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = coupons.customer_id);

-- 2.3 Limpiar coupons con promotion_id inválido
UPDATE coupons SET promotion_id = NULL
WHERE promotion_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = coupons.promotion_id);

-- 2.4 Eliminar invoices huérfanas (sin order)
DELETE FROM invoices i
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.id = i.order_id);

-- 2.5 Limpiar orders con promotion_id inválido
UPDATE orders SET promotion_id = NULL
WHERE promotion_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM promotions p WHERE p.id = orders.promotion_id);

-- 2.6 Para shifts sin opener, necesitamos crear un employee dummy o eliminar
-- Opción: Eliminar shifts huérfanos (solo si no hay datos importantes)
DELETE FROM shifts s
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.id = s.opened_by);

-- ============================================================================
-- PASO 3: Verificar limpieza
-- ============================================================================

SELECT 'Limpieza completada' AS status;

SELECT 'delivery_addresses restantes:' AS check_type, COUNT(*) AS count FROM delivery_addresses;
SELECT 'coupons restantes:' AS check_type, COUNT(*) AS count FROM coupons;
SELECT 'invoices restantes:' AS check_type, COUNT(*) AS count FROM invoices;
SELECT 'shifts restantes:' AS check_type, COUNT(*) AS count FROM shifts;

COMMIT;

-- ============================================================================
-- PASO 4: Crear índices de performance
-- ============================================================================

-- EVENTS: Índices para replay y sync
CREATE INDEX IF NOT EXISTS idx_events_replay 
ON events (tenant_id, entity_id, occurred_at ASC);

CREATE INDEX IF NOT EXISTS idx_events_by_type 
ON events (tenant_id, type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_by_terminal 
ON events (terminal_id, occurred_at DESC);

-- SHIFTS: Índices adicionales
CREATE INDEX IF NOT EXISTS idx_shifts_terminal_status 
ON shifts (tenant_id, terminal_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_history 
ON shifts (tenant_id, opened_at DESC);

-- ORDERS: Índices para KDS y búsquedas
CREATE INDEX IF NOT EXISTS idx_orders_number 
ON orders (tenant_id, order_number);

CREATE INDEX IF NOT EXISTS idx_orders_terminal 
ON orders (tenant_id, terminal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment 
ON orders (tenant_id, fulfillment_status);

-- PRODUCTS: Índice para búsqueda por estación
CREATE INDEX IF NOT EXISTS idx_products_station 
ON products (tenant_id, station, is_active);

-- EVENT_OUTBOX: Índice para worker de publicación
CREATE INDEX IF NOT EXISTS idx_outbox_pending 
ON event_outbox (published, created_at) 
WHERE published = false;

-- PROCESSED_EVENTS: Índice para limpieza
CREATE INDEX IF NOT EXISTS idx_processed_cleanup 
ON processed_events (tenant_id, processed_at);

-- GIN INDEX para búsqueda en JSONB de items (para KDS)
CREATE INDEX IF NOT EXISTS idx_orders_items_gin 
ON orders USING GIN (items jsonb_path_ops);

-- PARTIAL INDEX para órdenes activas (más eficiente para KDS)
CREATE INDEX IF NOT EXISTS idx_orders_active 
ON orders (tenant_id, created_at DESC) 
WHERE order_status IN ('OPEN', 'IN_PROGRESS');

-- ============================================================================
-- PASO 5: Agregar columnas opcionales (si no existen)
-- ============================================================================

DO $$ 
BEGIN
    -- event_outbox: event_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'event_type') THEN
        ALTER TABLE event_outbox ADD COLUMN event_type VARCHAR(100);
    END IF;
    
    -- event_outbox: aggregate_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'aggregate_id') THEN
        ALTER TABLE event_outbox ADD COLUMN aggregate_id UUID;
    END IF;
    
    -- event_outbox: max_attempts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'max_attempts') THEN
        ALTER TABLE event_outbox ADD COLUMN max_attempts INT DEFAULT 5;
    END IF;
    
    -- event_outbox: next_retry
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'event_outbox' AND column_name = 'next_retry') THEN
        ALTER TABLE event_outbox ADD COLUMN next_retry TIMESTAMPTZ;
    END IF;

    -- processed_events: event_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'event_type') THEN
        ALTER TABLE processed_events ADD COLUMN event_type VARCHAR(100);
    END IF;
    
    -- processed_events: aggregate_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'aggregate_id') THEN
        ALTER TABLE processed_events ADD COLUMN aggregate_id UUID;
    END IF;
    
    -- processed_events: processor
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'processed_events' AND column_name = 'processor') THEN
        ALTER TABLE processed_events ADD COLUMN processor VARCHAR(50);
    END IF;

    -- terminal_number_ranges: allocated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'terminal_number_ranges' AND column_name = 'allocated_at') THEN
        ALTER TABLE terminal_number_ranges ADD COLUMN allocated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- terminal_number_ranges: exhausted_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'terminal_number_ranges' AND column_name = 'exhausted_at') THEN
        ALTER TABLE terminal_number_ranges ADD COLUMN exhausted_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================================================
-- PASO 6: Índices adicionales para nuevas columnas
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_outbox_retry 
ON event_outbox (published, next_retry) 
WHERE published = false AND next_retry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_processed_aggregate 
ON processed_events (tenant_id, aggregate_id)
WHERE aggregate_id IS NOT NULL;

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

SELECT 'Migración completada exitosamente' AS status;

-- Mostrar índices creados
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
