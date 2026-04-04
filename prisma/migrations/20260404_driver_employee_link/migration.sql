-- Link drivers to employees via FK (employee_id is optional for backward compatibility)
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS idx_drivers_employee_id ON drivers(employee_id);

-- Auto-link drivers to employees by matching name within same tenant
UPDATE drivers d
SET employee_id = e.id
FROM employees e
WHERE d.tenant_id = e.tenant_id
  AND d.name = e.name
  AND d.employee_id IS NULL
  AND e.is_active = true;
