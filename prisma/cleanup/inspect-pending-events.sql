-- READ-ONLY: diagnostico a fondo de pending_events (cola fuera-de-orden).
\echo '=== 1. columnas de pending_events ==='
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pending_events' ORDER BY ordinal_position;

\echo '=== 2. total + antiguedad (mas viejo / mas nuevo) ==='
SELECT count(*) AS total, min(enqueued_at) AS mas_viejo, max(enqueued_at) AS mas_nuevo FROM pending_events;

\echo '=== 3. por event_type ==='
SELECT event_type, count(*) AS n FROM pending_events GROUP BY event_type ORDER BY n DESC LIMIT 20;

\echo '=== 4. por tenant (top 10) ==='
SELECT tenant_id, count(*) AS n FROM pending_events GROUP BY tenant_id ORDER BY n DESC LIMIT 10;

\echo '=== 5. antiguedad por buckets (cuantos llevan dias/semanas atascados) ==='
SELECT
  count(*) FILTER (WHERE enqueued_at > now() - interval '1 hour')  AS ultima_hora,
  count(*) FILTER (WHERE enqueued_at <= now() - interval '1 hour' AND enqueued_at > now() - interval '1 day') AS ultimo_dia,
  count(*) FILTER (WHERE enqueued_at <= now() - interval '1 day'  AND enqueued_at > now() - interval '7 days') AS ultima_semana,
  count(*) FILTER (WHERE enqueued_at <= now() - interval '7 days') AS mas_de_una_semana
FROM pending_events;

\echo '=== 6. indices en pending_events ==='
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'pending_events';
