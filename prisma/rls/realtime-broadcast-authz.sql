-- =============================================================================
-- Autorización de broadcast de Supabase Realtime, scoped por tenant vía JWT.
-- Reemplaza y endurece el POC (poc_tenant_receive / poc_tenant_send).
--
-- Modelo de PRODUCCIÓN:
--   - RECIBIR: un token 'authenticated' (minteado por /api/realtime/token con el
--     claim tenant_id) solo LEE broadcasts de su propio topic 'tenant:<tenant_id>'.
--   - EMITIR: SOLO el servidor, vía service_role (HTTP broadcast), que IGNORA RLS.
--     Los clientes NO emiten → NO se crea policy de INSERT para 'authenticated'.
--     Así ningún terminal puede inyectar broadcasts cross-tenant.
--
-- Idempotente y reversible. NO toca datos ni la tabla 'events'.
-- Aplicar con:
--   bun --env-file=.env --env-file=.env.local prisma db execute \
--     --file prisma/rls/realtime-broadcast-authz.sql --schema prisma/schema.prisma
-- (o desde el SQL editor de Supabase). Rollback: realtime-broadcast-authz-rollback.sql
-- =============================================================================

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Limpia el POC anterior (nombres poc_*).
DROP POLICY IF EXISTS poc_tenant_receive ON realtime.messages;
DROP POLICY IF EXISTS poc_tenant_send ON realtime.messages;

-- RECIBIR: cada terminal solo ve los broadcasts de su propio tenant.
DROP POLICY IF EXISTS realtime_tenant_receive ON realtime.messages;
CREATE POLICY realtime_tenant_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING ( realtime.topic() = 'tenant:' || (auth.jwt() ->> 'tenant_id') );

-- EMITIR: SIN policy para 'authenticated'. El servidor emite con service_role
-- (bypassa RLS). Si alguna vez existió poc_tenant_send, ya fue eliminada arriba.
