-- READ-ONLY: caza triggers residuales del SRE y funciones que toquen last_processed_sequence.
\echo '=== 1. TRIGGERS de usuario (no internos) en public ==='
SELECT c.relname AS tabla, t.tgname AS trigger, p.proname AS funcion
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND c.relnamespace = 'public'::regnamespace
ORDER BY c.relname, t.tgname;

\echo '=== 2. FUNCIONES cuyo cuerpo menciona last_processed_sequence ==='
SELECT proname AS funcion
FROM pg_proc
WHERE prosrc LIKE '%last_processed_sequence%';

\echo '=== 3. shifts tiene la columna last_processed_sequence? (esperado: vacio) ==='
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'shifts' AND column_name = 'last_processed_sequence';
