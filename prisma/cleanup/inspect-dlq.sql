-- READ-ONLY: diagnostico del dead_letter_queue (donde van los huerfanos expirados).
\echo '=== 1. total + antiguedad ==='
SELECT count(*) AS total, min(enqueued_at) AS mas_viejo, max(expired_at) AS ultimo_expirado FROM dead_letter_queue;

\echo '=== 2. por event_type ==='
SELECT event_type, count(*) AS n FROM dead_letter_queue GROUP BY event_type ORDER BY n DESC LIMIT 20;

\echo '=== 3. por reason ==='
SELECT reason, count(*) AS n FROM dead_letter_queue GROUP BY reason ORDER BY n DESC LIMIT 10;

\echo '=== 4. por tenant (top 10) ==='
SELECT tenant_id, count(*) AS n FROM dead_letter_queue GROUP BY tenant_id ORDER BY n DESC LIMIT 10;

\echo '=== 5. antiguedad por buckets ==='
SELECT
  count(*) FILTER (WHERE expired_at > now() - interval '1 day')  AS ultimo_dia,
  count(*) FILTER (WHERE expired_at <= now() - interval '1 day' AND expired_at > now() - interval '7 days') AS ultima_semana,
  count(*) FILTER (WHERE expired_at <= now() - interval '7 days') AS mas_de_una_semana
FROM dead_letter_queue;
