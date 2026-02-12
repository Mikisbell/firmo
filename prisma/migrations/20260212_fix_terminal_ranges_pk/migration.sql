-- Fix Terminal Number Ranges Primary Key
-- 
-- Problema: PK actual solo en terminal_id permite colisiones entre tenants
-- Solución: PK compuesto (tenant_id, terminal_id) para aislamiento multi-tenant
--
-- Requirement 4.1: PK compuesto para multi-tenancy
-- Fecha: 12 Febrero 2026

-- Drop existing PK constraint
ALTER TABLE terminal_number_ranges DROP CONSTRAINT terminal_number_ranges_pkey;

-- Add composite PK (tenant_id, terminal_id)
ALTER TABLE terminal_number_ranges ADD PRIMARY KEY (tenant_id, terminal_id);
