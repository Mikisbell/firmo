-- READ-ONLY: estado del event_outbox (reintento de publicaciones fallidas).
\echo '=== columnas ==='
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='event_outbox' ORDER BY ordinal_position;

\echo '=== total + published vs pending ==='
SELECT published, count(*) AS n FROM event_outbox GROUP BY published;

\echo '=== poison pills (attempts altos) + antiguedad de lo no publicado ==='
SELECT
  count(*) FILTER (WHERE published = false) AS pendientes,
  count(*) FILTER (WHERE published = false AND attempts >= 5) AS poison_pills,
  min(created_at) FILTER (WHERE published = false) AS pendiente_mas_viejo,
  max(attempts) AS max_attempts
FROM event_outbox;
