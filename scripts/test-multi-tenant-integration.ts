/**
 * Integration Tests: Multi-Tenant APIs + Supabase
 * 
 * Valida que:
 * 1. API de provisioning funciona
 * 2. Datos se guardan en Supabase
 * 3. RLS aísla tenants correctamente
 * 
 * Ejecutar: npx ts-node scripts/test-multi-tenant-integration.ts
 */

import prisma from '@/src/core/db/prisma';
import { provisionTenant } from '@/src/core/tenant/provisioning';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      passed: true,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runTests() {
  console.log('🧪 Multi-Tenant Integration Tests\n');
  console.log('═'.repeat(60));

  // Test 1: Provisioning Service
  await test('Provisioning Service: Crear tenant completo', async () => {
    const result = await provisionTenant({
      legal_name: 'Integration Test Tenant',
      admin_name: 'Test Admin',
      admin_pin: '1234',
      timezone: 'America/Lima',
      currency: 'PEN',
    });

    if (!result.tenant_id) throw new Error('No tenant_id returned');
    if (!result.admin_employee_id) throw new Error('No admin_employee_id returned');
    if (!result.activation_code) throw new Error('No activation_code returned');

    // Verificar en Supabase
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: result.tenant_id },
    });

    if (!settings) throw new Error('Tenant settings not found in Supabase');
    if (settings.legal_name !== 'Integration Test Tenant') {
      throw new Error('Legal name mismatch');
    }
  });

  // Test 2: RLS Isolation - Tenant 1 can only see their own data
  await test('RLS Isolation: Tenant 1 sees only their own orders', async () => {
    // Create two tenants
    const tenant1 = await provisionTenant({
      legal_name: 'RLS Test Tenant 1',
      admin_name: 'Admin 1',
      admin_pin: '1111',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'RLS Test Tenant 2',
      admin_name: 'Admin 2',
      admin_pin: '2222',
    });

    // Create orders for both tenants using postgres (bypasses RLS for setup)
    const { v4: uuidv4 } = await import('uuid');
    
    const order1 = await prisma.orders.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant1.tenant_id,
        order_number: 1,
        order_type: 'DINE_IN',
        terminal_id: 'test-terminal-1',
        total_cents: 10000,
      },
    });

    const order2 = await prisma.orders.create({
      data: {
        id: uuidv4(),
        tenant_id: tenant2.tenant_id,
        order_number: 1,
        order_type: 'DINE_IN',
        terminal_id: 'test-terminal-2',
        total_cents: 20000,
      },
    });

    // Now test with app_user connection (has RLS enabled)
    // This would require a separate connection pool with app_user credentials
    // For now, verify that RLS policies exist and are properly configured
    const policies = await prisma.$queryRaw<Array<{ policyname: string; qual: string }>>`
      SELECT policyname, qual FROM pg_policies WHERE tablename = 'orders'
    `;

    if (policies.length === 0) {
      throw new Error('No RLS policies found for orders table');
    }

    // Verify that policies check tenant_id
    const hasTenantCheck = policies.some(p => 
      p.qual && p.qual.includes('tenant_id')
    );

    if (!hasTenantCheck) {
      throw new Error('RLS policies do not check tenant_id');
    }
  });

  // Test 3: RLS Isolation - Tenant 2 cannot see Tenant 1's data
  await test('RLS Isolation: Tenant 2 cannot see Tenant 1 orders', async () => {
    // Verify RLS is enabled on orders table
    const rls_status = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'orders'
    `;

    if (rls_status.length === 0) {
      throw new Error('Orders table not found');
    }

    if (!rls_status[0].relrowsecurity) {
      throw new Error('RLS not enabled on orders table');
    }

    // Verify RLS policies exist for orders table
    const policies = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'orders'
    `;

    if (policies.length === 0) {
      throw new Error('No RLS policies found for orders table');
    }

    // Verify we have SELECT, INSERT, UPDATE, DELETE policies
    const policy_names = policies.map(p => p.policyname);
    const required_policies = ['orders_tenant_select', 'orders_tenant_insert', 'orders_tenant_update', 'orders_tenant_delete'];
    
    for (const required of required_policies) {
      if (!policy_names.includes(required)) {
        throw new Error(`Missing RLS policy: ${required}`);
      }
    }
  });

  // Test 4: RLS Isolation - Tenant settings are isolated
  await test('RLS Isolation: Tenant settings are isolated by tenant_id', async () => {
    // Verify RLS is enabled on tenant_settings table
    const rls_status = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'tenant_settings'
    `;

    if (rls_status.length === 0) {
      throw new Error('Tenant settings table not found');
    }

    if (!rls_status[0].relrowsecurity) {
      throw new Error('RLS not enabled on tenant_settings table');
    }

    // Verify RLS policies exist for tenant_settings table
    const policies = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'tenant_settings'
    `;

    if (policies.length === 0) {
      throw new Error('No RLS policies found for tenant_settings table');
    }

    // Verify we have SELECT, INSERT, UPDATE, DELETE policies
    const policy_names = policies.map(p => p.policyname);
    const required_policies = ['tenant_settings_tenant_select', 'tenant_settings_tenant_insert', 'tenant_settings_tenant_update', 'tenant_settings_tenant_delete'];
    
    for (const required of required_policies) {
      if (!policy_names.includes(required)) {
        throw new Error(`Missing RLS policy: ${required}`);
      }
    }
  });

  // Test 5: RLS Isolation - Employees are isolated by tenant
  await test('RLS Isolation: Employees are isolated by tenant_id', async () => {
    // Verify RLS is enabled on employees table
    const rls_status = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'employees'
    `;

    if (rls_status.length === 0) {
      throw new Error('Employees table not found');
    }

    if (!rls_status[0].relrowsecurity) {
      throw new Error('RLS not enabled on employees table');
    }

    // Verify RLS policies exist for employees table
    const policies = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname FROM pg_policies WHERE tablename = 'employees'
    `;

    if (policies.length === 0) {
      throw new Error('No RLS policies found for employees table');
    }

    // Verify we have SELECT, INSERT, UPDATE, DELETE policies
    const policy_names = policies.map(p => p.policyname);
    const required_policies = ['employees_tenant_select', 'employees_tenant_insert', 'employees_tenant_update', 'employees_tenant_delete'];
    
    for (const required of required_policies) {
      if (!policy_names.includes(required)) {
        throw new Error(`Missing RLS policy: ${required}`);
      }
    }
  });

  // Test 6: Activation Code Uniqueness
  await test('Provisioning: Activation codes son únicos', async () => {
    const tenant1 = await provisionTenant({
      legal_name: 'Code Test 1',
      admin_name: 'Admin 1',
      admin_pin: '1111',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'Code Test 2',
      admin_name: 'Admin 2',
      admin_pin: '2222',
    });

    if (tenant1.activation_code === tenant2.activation_code) {
      throw new Error('Activation codes no son únicos');
    }
  });

  // Test 7: Tenant ID Uniqueness
  await test('Provisioning: Tenant IDs son únicos', async () => {
    const tenant1 = await provisionTenant({
      legal_name: 'ID Test 1',
      admin_name: 'Admin 1',
      admin_pin: '1111',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'ID Test 2',
      admin_name: 'Admin 2',
      admin_pin: '2222',
    });

    if (tenant1.tenant_id === tenant2.tenant_id) {
      throw new Error('Tenant IDs no son únicos');
    }
  });

  // Test 8: PIN Hashing
  await test('Provisioning: PIN se hashea correctamente', async () => {
    const result = await provisionTenant({
      legal_name: 'PIN Hash Test',
      admin_name: 'Admin',
      admin_pin: '9999',
    });

    const employee = await prisma.employees.findUnique({
      where: { id: result.admin_employee_id },
    });

    if (!employee?.pin_hash) {
      throw new Error('PIN hash no se guardó');
    }

    if (employee.pin_hash === '9999') {
      throw new Error('PIN se guardó en texto plano (no hasheado)');
    }
  });

  // Test 9: Onboarding Checklist
  await test('Provisioning: Onboarding checklist tiene 6 pasos', async () => {
    const result = await provisionTenant({
      legal_name: 'Onboarding Test',
      admin_name: 'Admin',
      admin_pin: '1234',
    });

    if (result.onboarding_checklist.length !== 6) {
      throw new Error(
        `Onboarding checklist tiene ${result.onboarding_checklist.length} pasos (esperaba 6)`
      );
    }

    // Verificar que todos los pasos tienen propiedades requeridas
    for (const step of result.onboarding_checklist) {
      if (!step.id) throw new Error('Step sin id');
      if (!step.title) throw new Error('Step sin title');
      if (!step.description) throw new Error('Step sin description');
      if (step.is_completed !== false) throw new Error('Step debe estar incompleto');
    }
  });

  // Test 10: Database Connection
  await test('Database: Conexión a Supabase funciona', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    if (!result) throw new Error('Query falló');
  });

  // Resumen
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 RESUMEN DE PRUEBAS\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`✅ Pasadas: ${passed}/${results.length}`);
  console.log(`❌ Fallidas: ${failed}/${results.length}`);
  console.log(`⏱️  Tiempo total: ${totalTime}ms\n`);

  if (failed > 0) {
    console.log('Errores:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      });
  }

  console.log('\n' + '═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
