-- ============================================================================
-- LIMPIEZA: eliminar artefactos del experimento "SRE-native" (RECHAZADO)
-- ============================================================================
-- Contexto: el 16-17 Jun 2026 se experimento con proyeccion asincrona via
-- webhook (pg_net) + Scavenger/Hole-Tracker (pg_cron). Se DESCARTO por
-- sobre-ingenieria. PARK vuelve a proyeccion in-process (Node).
--
-- Estado REAL verificado en la DB (inspect-sre-state.ts, 18 Jun 2026):
--   - trigger on_event_inserted .......... EXISTE (disparando a tunel muerto)
--   - funciones sre_fast_tracker/scavenger/trigger_projector_webhook .. EXISTEN
--   - pg_cron ............................ INSTALADO (demonios corriendo)
--   - last_processed_sequence en: invoices, order_item_projections,
--                                  orders, payments, tables
--   - events.global_sequence ............. EXISTE
--   - NO registrado en _prisma_migrations (se aplico via db execute)
--
-- Es IDEMPOTENTE (IF EXISTS) -- seguro de correr aunque algo ya no exista.
--
-- ATENCION:
--   1. ROTA primero el password de la DB (credenciales estaban en git).
--   2. Toma BACKUP antes de correr esto.
--   3. Usa la conexion DIRECTA (puerto 5432), NO el pooler (6543): es DDL.
--      npx prisma db execute --schema prisma/schema.prisma --file prisma/cleanup/remove-sre-artifacts.sql
-- ============================================================================

-- 1. Trigger + funcion del webhook (pg_net -> /api/webhooks/projector)
DROP TRIGGER IF EXISTS on_event_inserted ON public.events;
DROP FUNCTION IF EXISTS public.trigger_projector_webhook();

-- 2. Demonios pg_cron del Scavenger/Fast-Tracker (pg_cron CONFIRMADO instalado)
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

-- 4. Tablas auxiliares creadas a mano (sin modelo Prisma) -- por si existen
DROP TABLE IF EXISTS public.missing_sequences;
DROP TABLE IF EXISTS public.projection_checkpoints;

-- 5. Columnas que contaminaron tablas de negocio (lista REAL verificada en DB)
ALTER TABLE public.invoices                DROP COLUMN IF EXISTS last_processed_sequence;
ALTER TABLE public.order_item_projections  DROP COLUMN IF EXISTS last_processed_sequence;
ALTER TABLE public.orders                  DROP COLUMN IF EXISTS last_processed_sequence;
ALTER TABLE public.payments                DROP COLUMN IF EXISTS last_processed_sequence;
ALTER TABLE public.tables                  DROP COLUMN IF EXISTS last_processed_sequence;

-- 6. Columna global_sequence en events (artefacto del experimento).
--    El codigo revertido ya NO la usa (grep confirma 0 referencias productivas).
--    Si tu equipo la quiere conservar como cursor futuro, COMENTA esta linea.
ALTER TABLE public.events DROP COLUMN IF EXISTS global_sequence;
