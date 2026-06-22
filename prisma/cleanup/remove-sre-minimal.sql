-- ============================================================================
-- LIMPIEZA MINIMA del experimento SRE (RECHAZADO)
-- ============================================================================
-- Detiene el dano ACTIVO sin tocar NINGUN dato:
--   - elimina el trigger pg_net (disparaba a un tunel muerto en cada evento)
--   - desprograma los demonios pg_cron (corrian cada minuto a lo tonto)
--   - elimina las funciones del experimento
-- CONSERVA: global_sequence, las columnas last_processed_sequence, y TODAS las filas.
-- Idempotente (IF EXISTS). Cero DROP COLUMN, cero DROP TABLE.
-- ============================================================================

-- 1. Trigger + funcion del webhook (pg_net -> /api/webhooks/projector)
DROP TRIGGER IF EXISTS on_event_inserted ON public.events;
DROP FUNCTION IF EXISTS public.trigger_projector_webhook();

-- 2. Desprogramar los jobs pg_cron del Scavenger/Fast-Tracker
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sre-fast-tracker') THEN
    PERFORM cron.unschedule('sre-fast-tracker');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sre-scavenger') THEN
    PERFORM cron.unschedule('sre-scavenger');
  END IF;
END $$;

-- 3. Funciones PL/pgSQL del experimento
DROP FUNCTION IF EXISTS public.sre_fast_tracker();
DROP FUNCTION IF EXISTS public.sre_scavenger();
