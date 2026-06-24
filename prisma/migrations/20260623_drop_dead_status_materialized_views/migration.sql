-- Migration: DROP de vistas materializadas MUERTAS que leen status del JSON orders.items[]
-- Created: 23 Junio 2026
-- Change: remove-item-status-from-write-model (Phase 6 / D7 del design #2186, council #2179)
--
-- POR QUÉ SE DROPEAN:
--   Estas 3 vistas materializadas expanden el JSON `orders.items[]` y leen
--   `item->>'status'` (el snapshot CONGELADO en la creación de la orden). Tras el
--   corte global del writer (P4), el snapshot ya NO contiene `status`: el status
--   VIVO de cada item se resuelve EXCLUSIVAMENTE desde la proyección
--   `order_item_projections` (read-model único src/core/projections/order-items.read.ts).
--
--   Mantener vivas estas vistas contradice el invariante "proyección única dueña
--   del status" y son el ÚNICO lector de status-en-JSON fuera de TypeScript (el
--   test de arquitectura src/__tests__/architecture/no-json-status-read.test.ts
--   no las cubre por ser SQL). Además están MUERTAS: 0 consumers en el código
--   (verificado en el change — ningún service/route/job hace SELECT contra ellas
--   ni llama a sus funciones de refresh).
--
-- IDEMPOTENTE: `DROP ... IF EXISTS` — segura de aplicar aunque la vista no exista
--   en algún entorno (p.ej. DBs creadas solo vía `prisma migrate` sin el sql/004
--   manual). No se reescribe historia: esta migración ADITIVA neutraliza
--   20260122_create_materialized_views y el sql/004_kds_materialized_view.sql.
--
-- NOTA: las funciones de refresh y los índices se eliminan en cascada con la
--   vista; aun así se dropean explícitamente las funciones huérfanas por claridad.

-- ============================================================================
-- 1. KDS pending items (sql/004_kds_materialized_view.sql)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS kds_pending_items CASCADE;
DROP FUNCTION IF EXISTS refresh_kds_pending_items() CASCADE;

-- ============================================================================
-- 2. Station analytics (prisma/migrations/20260122_create_materialized_views)
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS station_hourly_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS station_daily_summary CASCADE;
