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

  // Test 2: RLS Isolation - Tenant 1 no ve datos de Tenant 2
  await test('RLS Isolation: Tenant 1 no ve datos de Tenant 2', async () => {
    // Crear tenant 1
    const tenant1 = await provisionTenant({
      legal_name: 'Tenant 1 RLS Test',
      admin_name: 'Admin 1',
      admin_pin: '1111',
    });

    // Crear tenant 2
    const tenant2 = await provisionTenant({
      legal_name: 'Tenant 2 RLS Test',
      admin_name: 'Admin 2',
      admin_pin: '2222',
    });

    // Cambiar contexto a tenant 1
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1.tenant_id}, true)
    `;

    // Contar órdenes de tenant 1 (debe ser 0)
    const ordersT1 = await prisma.orders.findMany();

    // Cambiar contexto a tenant 2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant2.tenant_id}, true)
    `;

    // Contar órdenes de tenant 2 (debe ser 0)
    const ordersT2 = await prisma.orders.findMany();

    if (ordersT1.length !== 0) {
      throw new Error(`Tenant 1 vio ${ordersT1.length} órdenes (esperaba 0)`);
    }

    if (ordersT2.length !== 0) {
      throw new Error(`Tenant 2 vio ${ordersT2.length} órdenes (esperaba 0)`);
    }
  });

  // Test 3: Tenant Settings Isolation
  await test('RLS Isolation: Tenant settings aislados', async () => {
    const tenant1 = await provisionTenant({
      legal_name: 'Settings Test 1',
      admin_name: 'Admin 1',
      admin_pin: '3333',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'Settings Test 2',
      admin_name: 'Admin 2',
      admin_pin: '4444',
    });

    // Cambiar a tenant 1
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1.tenant_id}, true)
    `;

    const settings1 = await prisma.tenant_settings.findMany();

    // Cambiar a tenant 2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant2.tenant_id}, true)
    `;

    const settings2 = await prisma.tenant_settings.findMany();

    // Cada tenant debe ver solo sus propios settings
    if (settings1.length !== 1) {
      throw new Error(`Tenant 1 vio ${settings1.length} settings (esperaba 1)`);
    }

    if (settings2.length !== 1) {
      throw new Error(`Tenant 2 vio ${settings2.length} settings (esperaba 1)`);
    }

    if (settings1[0].legal_name !== 'Settings Test 1') {
      throw new Error('Tenant 1 vio settings de otro tenant');
    }

    if (settings2[0].legal_name !== 'Settings Test 2') {
      throw new Error('Tenant 2 vio settings de otro tenant');
    }
  });

  // Test 4: Employees Isolation
  await test('RLS Isolation: Employees aislados por tenant', async () => {
    const tenant1 = await provisionTenant({
      legal_name: 'Employees Test 1',
      admin_name: 'Admin 1',
      admin_pin: '5555',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'Employees Test 2',
      admin_name: 'Admin 2',
      admin_pin: '6666',
    });

    // Cambiar a tenant 1
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1.tenant_id}, true)
    `;

    const employees1 = await prisma.employees.findMany();

    // Cambiar a tenant 2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant2.tenant_id}, true)
    `;

    const employees2 = await prisma.employees.findMany();

    // Cada tenant debe ver solo sus empleados
    if (employees1.length !== 1) {
      throw new Error(`Tenant 1 vio ${employees1.length} empleados (esperaba 1)`);
    }

    if (employees2.length !== 1) {
      throw new Error(`Tenant 2 vio ${employees2.length} empleados (esperaba 1)`);
    }
  });

  // Test 5: Stations Isolation
  await test('RLS Isolation: Stations aisladas por tenant', async () => {
    const tenant1 = await provisionTenant({
      legal_name: 'Stations Test 1',
      admin_name: 'Admin 1',
      admin_pin: '7777',
    });

    const tenant2 = await provisionTenant({
      legal_name: 'Stations Test 2',
      admin_name: 'Admin 2',
      admin_pin: '8888',
    });

    // Cambiar a tenant 1
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1.tenant_id}, true)
    `;

    const stations1 = await prisma.stations.findMany();

    // Cambiar a tenant 2
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant2.tenant_id}, true)
    `;

    const stations2 = await prisma.stations.findMany();

    // Cada tenant debe ver solo sus estaciones
    if (stations1.length !== 4) {
      throw new Error(`Tenant 1 vio ${stations1.length} estaciones (esperaba 4)`);
    }

    if (stations2.length !== 4) {
      throw new Error(`Tenant 2 vio ${stations2.length} estaciones (esperaba 4)`);
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
