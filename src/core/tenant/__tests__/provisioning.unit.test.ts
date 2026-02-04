/**
 * Unit Tests: Tenant Provisioning Service
 * 
 * Valida que el servicio de provisioning crea todos los recursos correctamente
 * en Supabase Cloud.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { provisionTenant } from '@/src/core/tenant/provisioning';
import prisma from '@/src/core/db/prisma';

describe('Tenant Provisioning Service', () => {
  const tenantsToCleanup: string[] = [];

  afterEach(async () => {
    // Limpiar datos de prueba
    for (const tenantId of tenantsToCleanup) {
      try {
        await prisma.tenant_settings.delete({
          where: { tenant_id: tenantId },
        }).catch(() => {});
      } catch (e) {
        // Ignorar errores de limpieza
      }
    }
    tenantsToCleanup.length = 0;
  });

  it('✅ debe provisionar tenant con todos los recursos', async () => {
    const result = await provisionTenant({
      legal_name: 'Pollería Unit Test 1',
      admin_name: 'Juan Test',
      admin_pin: '1234',
      timezone: 'America/Lima',
      currency: 'PEN',
    });

    tenantsToCleanup.push(result.tenant_id);

    // Verificaciones básicas
    expect(result.tenant_id).toBeDefined();
    expect(result.tenant_id.length).toBeGreaterThan(10);
    expect(result.admin_employee_id).toBeDefined();
    expect(result.activation_code).toMatch(/^\d{6}$/); // 6 dígitos
    expect(result.onboarding_checklist).toHaveLength(6);

    // Verificar en Supabase
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: result.tenant_id },
    });

    expect(settings).toBeDefined();
    expect(settings?.legal_name).toBe('Pollería Unit Test 1');
    expect(settings?.timezone).toBe('America/Lima');
    expect(settings?.currency).toBe('PEN');
  });

  it('✅ debe crear 4 estaciones por defecto', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Stations',
      admin_name: 'Test',
      admin_pin: '5678',
    });

    tenantsToCleanup.push(result.tenant_id);

    const stations = await prisma.stations.findMany({
      where: { tenant_id: result.tenant_id },
    });

    expect(stations).toHaveLength(4);
    
    const codes = stations.map(s => s.code).sort();
    expect(codes).toEqual(['BAR', 'COCINA', 'EMPAQUE', 'PARRILLA']);
  });

  it('✅ debe crear admin employee con PIN hasheado', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Admin',
      admin_name: 'Carlos Admin',
      admin_pin: '9999',
    });

    tenantsToCleanup.push(result.tenant_id);

    const employee = await prisma.employees.findUnique({
      where: { id: result.admin_employee_id },
    });

    expect(employee).toBeDefined();
    expect(employee?.name).toBe('Carlos Admin');
    expect(employee?.role).toBe('ADMIN');
    expect(employee?.pin_hash).toBeDefined();
    expect(employee?.pin_hash).not.toBe('9999'); // No debe estar en texto plano
    expect(employee?.is_active).toBe(true);
  });

  it('✅ debe asignar 10 rangos de números de terminal', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Ranges',
      admin_name: 'Test',
      admin_pin: '1111',
    });

    tenantsToCleanup.push(result.tenant_id);

    const ranges = await prisma.terminal_number_ranges.findMany({
      where: { tenant_id: result.tenant_id },
    });

    expect(ranges).toHaveLength(10);
    expect(ranges[0].range_start).toBe(1);
    expect(ranges[0].range_end).toBe(100);
    expect(ranges[9].range_start).toBe(901);
    expect(ranges[9].range_end).toBe(1000);
  });

  it('✅ debe crear terminal por defecto', async () => {
    const result = await provisionTenant({
      legal_name: 'Test Terminal',
      admin_name: 'Test',
      admin_pin: '2222',
    });

    tenantsToCleanup.push(result.tenant_id);

    const terminals = await prisma.terminals.findMany({
      where: { tenant_id: result.tenant_id },
    });

    expect(terminals.length).toBeGreaterThanOrEqual(1);
    expect(terminals[0].is_allowed).toBe(true);
  });
});
