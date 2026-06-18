-- READ-ONLY: estado de la autorizacion de Supabase Realtime (canales privados).
\echo '=== 1. realtime.messages existe + RLS habilitado? ==='
SELECT n.nspname AS schema, c.relname AS tabla, c.relrowsecurity AS rls_on
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'realtime' AND c.relname = 'messages';

\echo '=== 2. politicas existentes en realtime.messages ==='
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'realtime' AND tablename = 'messages';

\echo '=== 3. funcion realtime.topic() disponible? ==='
SELECT proname FROM pg_proc
WHERE pronamespace = 'realtime'::regnamespace AND proname IN ('topic');

\echo '=== 4. rol authenticated existe? ==='
SELECT rolname FROM pg_roles WHERE rolname IN ('authenticated','anon','service_role');
