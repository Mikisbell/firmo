-- Enable RLS on tenant_settings table
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant_settings
CREATE POLICY tenant_settings_tenant_select ON tenant_settings
  FOR SELECT
  USING (
    (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)
    OR ((current_setting('app.is_cross_tenant_admin'::text))::boolean = true)
  );

CREATE POLICY tenant_settings_tenant_insert ON tenant_settings
  FOR INSERT
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid);

CREATE POLICY tenant_settings_tenant_update ON tenant_settings
  FOR UPDATE
  USING (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid)
  WITH CHECK (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid);

CREATE POLICY tenant_settings_tenant_delete ON tenant_settings
  FOR DELETE
  USING (tenant_id = (current_setting('app.current_tenant_id'::text))::uuid);
