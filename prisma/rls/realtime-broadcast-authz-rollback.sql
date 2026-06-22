-- =============================================================================
-- Rollback de realtime-broadcast-authz.sql.
-- Elimina la policy de recepción endurecida. Tras esto, los canales privados
-- 'tenant:<id>' quedan SIN policy de SELECT → los clientes reciben CHANNEL_ERROR
-- (a menos que se re-aplique el POC permisivo).
--
-- Aplicar con:
--   bun --env-file=.env --env-file=.env.local prisma db execute \
--     --file prisma/rls/realtime-broadcast-authz-rollback.sql --schema prisma/schema.prisma
-- =============================================================================

DROP POLICY IF EXISTS realtime_tenant_receive ON realtime.messages;

-- Nota: NO se desactiva RLS en realtime.messages (lo gestiona Supabase).
-- Si se necesita volver al comportamiento POC (cliente puede emitir), re-crear:
--   CREATE POLICY poc_tenant_send ON realtime.messages
--     FOR INSERT TO authenticated
--     WITH CHECK ( realtime.topic() = 'tenant:' || (auth.jwt() ->> 'tenant_id') );
