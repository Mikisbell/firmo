-- ============================================================================
-- PARK POS - KDS Materialized View
-- Version: 004
-- Description: Vista materializada para queries eficientes del KDS
-- ============================================================================
--
-- ⚠️ OBSOLETO — NO APLICAR (change remove-item-status-from-write-model, Phase 6 / D7)
--
-- Esta vista lee `item->>'status'` del JSON `orders.items[]` (el snapshot CONGELADO).
-- Tras el corte global del writer (P4), ese JSON ya NO contiene `status`: el status
-- VIVO de los items se resuelve SOLO desde la proyección `order_item_projections`
-- (read-model único src/core/projections/order-items.read.ts).
--
-- La vista está MUERTA (0 consumers) y se DROPEA en la migración versionada:
--   prisma/migrations/20260623_drop_dead_status_materialized_views/migration.sql
--
-- Se conserva este archivo solo como registro histórico. NO lo ejecutes.
-- ============================================================================

-- ============================================================================
-- VISTA MATERIALIZADA: Items pendientes por estación
-- ============================================================================

-- Primero eliminamos si existe
DROP MATERIALIZED VIEW IF EXISTS kds_pending_items;

-- Crear vista materializada con items expandidos del JSON
CREATE MATERIALIZED VIEW kds_pending_items AS
SELECT 
    o.id AS order_id,
    o.tenant_id,
    o.order_number,
    o.order_type,
    o.terminal_id,
    o.created_at AS order_created_at,
    (item->>'line_id')::text AS line_id,
    (item->>'product_id')::text AS product_id,
    (item->>'name')::text AS item_name,
    (item->>'station')::text AS station,
    (item->>'status')::text AS item_status,
    (item->>'qty')::int AS qty,
    (item->>'unit_price_cents')::int AS unit_price_cents
FROM orders o,
     jsonb_array_elements(o.items) AS item
WHERE o.order_status IN ('OPEN', 'IN_PROGRESS')
  AND (item->>'status')::text IN ('PENDING', 'COOKING', 'READY');

-- ============================================================================
-- ÍNDICES para la vista materializada
-- ============================================================================

-- Índice principal para filtrar por estación y estado
CREATE UNIQUE INDEX idx_kds_pending_pk 
ON kds_pending_items (order_id, line_id);

CREATE INDEX idx_kds_pending_station 
ON kds_pending_items (tenant_id, station, item_status);

CREATE INDEX idx_kds_pending_order 
ON kds_pending_items (tenant_id, order_number);

CREATE INDEX idx_kds_pending_created 
ON kds_pending_items (tenant_id, station, order_created_at DESC);

-- ============================================================================
-- FUNCIÓN para refrescar la vista
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_kds_pending_items()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY kds_pending_items;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER para refrescar automáticamente (opcional - puede ser costoso)
-- Alternativa: Llamar refresh_kds_pending_items() desde el backend cada N segundos
-- ============================================================================

-- Comentado por defecto - descomentar si se quiere refresh automático
-- CREATE OR REPLACE FUNCTION trigger_refresh_kds()
-- RETURNS trigger AS $$
-- BEGIN
--     PERFORM refresh_kds_pending_items();
--     RETURN NULL;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER trg_orders_refresh_kds
-- AFTER INSERT OR UPDATE ON orders
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION trigger_refresh_kds();

-- ============================================================================
-- QUERY DE EJEMPLO para KDS
-- ============================================================================

-- Para obtener items de PARRILLA:
-- SELECT * FROM kds_pending_items 
-- WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   AND station = 'PARRILLA'
--   AND item_status IN ('PENDING', 'COOKING')
-- ORDER BY order_created_at ASC;

-- Para obtener items de COCINA (múltiples estaciones):
-- SELECT * FROM kds_pending_items 
-- WHERE tenant_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
--   AND station IN ('COCINA', 'FRIOS', 'POSTRES', 'FREIDORA')
--   AND item_status IN ('PENDING', 'COOKING')
-- ORDER BY order_created_at ASC;

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW kds_pending_items IS 
'Vista materializada para queries eficientes del KDS. Expande items del JSON de orders.';

COMMENT ON FUNCTION refresh_kds_pending_items() IS 
'Refresca la vista materializada kds_pending_items. Llamar periódicamente o después de cambios en orders.';
