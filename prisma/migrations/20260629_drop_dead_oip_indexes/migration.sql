-- Limpieza de indices muertos/duplicados en order_item_projections.
-- Tabla write-heavy (cada ORDER_ITEM_* hace INSERT/DELETE en el ingest); cada indice
-- de mas penaliza ese write caliente. Estos 3 no aportan a ninguna lectura.
--
-- VERIFICADO (3 angulos, 2026-06-29):
--   1. Codigo: 0 queries filtran order_item_projections por station o table_number
--      (grep exhaustivo + subagente 67 tool_uses). El KDS de estacion
--      (api/admin/stations/[id]/orders) filtra por orders.stations_active y en memoria.
--   2. pg_stat_user_indexes: idx_scan = 0 para station_status y table_number_status.
--   3. Datos: table_number NULL en 92% de las filas (delivery/takeaway no tienen mesa).
--
--   idx_oip_order_line: DUPLICADO exacto del unique (order_id, line_id) — btree identico.
--     El _unique se conserva (da el indice + la garantia para el ON CONFLICT del upsert).
--
-- Re-agregables si vuelve la feature waiter-por-estacion/mesa. El de table_number deberia
-- entonces ser PARCIAL: CREATE INDEX ... WHERE table_number IS NOT NULL.

DROP INDEX IF EXISTS "idx_oip_order_line";
DROP INDEX IF EXISTS "order_item_projections_tenant_id_station_status_idx";
DROP INDEX IF EXISTS "order_item_projections_tenant_id_table_number_status_idx";
