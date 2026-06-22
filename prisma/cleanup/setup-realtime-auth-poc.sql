-- POC: autorizacion de canales privados de Supabase Realtime, scoped por tenant via JWT.
-- Un token 'authenticated' puede RECIBIR y EMITIR broadcasts SOLO en 'tenant:<su tenant_id>'.
-- ADITIVO y REVERSIBLE (DROP POLICY). NO toca datos ni la tabla events.
-- Nota produccion: la politica de INSERT (emitir) es para la POC; en prod conviene que SOLO
-- el servidor emita (service_role) y dejar a los clientes solo con SELECT (recibir).

DROP POLICY IF EXISTS poc_tenant_receive ON realtime.messages;
CREATE POLICY poc_tenant_receive ON realtime.messages
  FOR SELECT TO authenticated
  USING ( realtime.topic() = 'tenant:' || (auth.jwt() ->> 'tenant_id') );

DROP POLICY IF EXISTS poc_tenant_send ON realtime.messages;
CREATE POLICY poc_tenant_send ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK ( realtime.topic() = 'tenant:' || (auth.jwt() ->> 'tenant_id') );
