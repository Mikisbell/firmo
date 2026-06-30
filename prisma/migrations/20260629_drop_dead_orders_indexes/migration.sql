-- Limpieza de indices MUERTOS (certeros) en `orders` (la tabla mas escrita del sistema).
-- Solo los 2 inequivocos. Los redundantes-por-prefijo (orders_tenant_id_business_date_idx,
-- orders_tenant_id_shift_id_idx) NO se tocan aqui: requieren confirmacion con EXPLAIN en
-- prod (con volumen real) porque en la DB chica de test no se puede forzar el uso de indices.
--
-- Verificado 3 angulos (codigo + pg_stat + arqueologia de migraciones), 2026-06-29:
--
-- 1. idx_orders_items_gin  (mig 20260122_add_metrics_indices, GIN 48 kB — el mas pesado)
--    Nacio como (comentario textual): "GIN index for JSON items field to enable efficient
--    station filtering ... WHERE items @> '[{station: PARRILLA}]'".
--    Por que sobra: el KDS de estacion se implemento via orders.stations_active (columna
--    array), NO via items @> JSONB. Ninguna query usa operadores JSONB (@>, ?); solo iteran
--    con jsonb_array_elements(). Un GIN solo lo usan los operadores containment. MUERTO.
--
-- 2. idx_orders_unpaid  (mig 20260106060000_performance_indices)
--    Nacio como: "Indice parcial para checks sin pagar" -> WHERE unpaid_checks_count > 0.
--    Por que sobra: la query ">0" nunca se escribio. El unico lector filtra "= 0"
--    (data-sync/reports/route.ts:33). Un parcial WHERE >0 NO contiene las filas =0 -> jamas
--    cubre esa query. MUERTO (hecho de Postgres, no inferencia).

DROP INDEX IF EXISTS "idx_orders_items_gin";
DROP INDEX IF EXISTS "idx_orders_unpaid";
