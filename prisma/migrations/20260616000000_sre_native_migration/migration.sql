-- Creación de funciones nativas SRE para Supabase
-- Aisladas en PL/pgSQL para evitar latencia de red y contención OLTP.

-- 1. Fast Tracker
CREATE OR REPLACE FUNCTION sre_fast_tracker() RETURNS void AS $$
DECLARE
    v_cursor bigint;
    v_max_seq bigint;
BEGIN
    -- 1. Obtener cursor actual de forma segura
    SELECT last_processed_sequence INTO v_cursor FROM projection_checkpoints WHERE projection_name = 'main';
    IF v_cursor IS NULL THEN
        v_cursor := 0;
        INSERT INTO projection_checkpoints (projection_name, last_processed_sequence) VALUES ('main', 0) ON CONFLICT DO NOTHING;
    END IF;

    -- 2. Detectar huecos (O(N) solo sobre el delta) e insertarlos en missing_sequences
    -- Se ignora la ventana de los últimos 5 segundos para permitir Rollbacks en vuelo
    INSERT INTO missing_sequences (sequence_id)
    SELECT s.gap_seq
    FROM (
        SELECT global_sequence, LEAD(global_sequence) OVER (ORDER BY global_sequence) as next_seq
        FROM events
        WHERE global_sequence > v_cursor AND received_at <= NOW() - INTERVAL '5 seconds'
    ) AS sequence_delta, generate_series(global_sequence + 1, next_seq - 1) AS s(gap_seq)
    WHERE next_seq - global_sequence > 1
    ON CONFLICT DO NOTHING;

    -- 3. Avanzar el cursor al máximo evento procesado
    SELECT MAX(global_sequence) INTO v_max_seq 
    FROM events 
    WHERE global_sequence > v_cursor AND received_at <= NOW() - INTERVAL '5 seconds';
    
    IF v_max_seq IS NOT NULL THEN
        UPDATE projection_checkpoints SET last_processed_sequence = v_max_seq WHERE projection_name = 'main';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Scavenger (Limpiador de Rollbacks)
CREATE OR REPLACE FUNCTION sre_scavenger() RETURNS void AS $$
BEGIN
    -- Los fantasmas muertos (Rollbacks) son huecos que nunca se llenarán.
    -- Si el evento anterior tiene más de 15 minutos, el hueco se considera "Cadáver".
    -- En producción real, aquí se emitiría una métrica en lugar de solo borrarlo.
    DELETE FROM missing_sequences
    WHERE detected_at < NOW() - INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql;

-- 3. Habilitar pg_cron y orquestar (Requiere rol postgres)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover horarios viejos por idempotencia de la migración
SELECT cron.unschedule('sre-fast-tracker') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sre-fast-tracker');
SELECT cron.unschedule('sre-scavenger') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sre-scavenger');

-- Programar los demonios
SELECT cron.schedule('sre-fast-tracker', '* * * * *', 'SELECT sre_fast_tracker()');
SELECT cron.schedule('sre-scavenger', '*/5 * * * *', 'SELECT sre_scavenger()');
