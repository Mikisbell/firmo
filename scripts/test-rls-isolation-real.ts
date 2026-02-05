/**
 * Real RLS Isolation Test
 * 
 * Verifica que RLS REALMENTE aísla datos entre tenants
 * Usa app_user (con RLS habilitado), no postgres (que bypassa RLS)
 * 
 * Ejecutar: npx ts-node scripts/test-rls-isolation-real.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Conexión con postgres (bypassa RLS - para setup)
const postgresClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Usuario postgres
    },
  },
});

// Conexión con app_user (tiene RLS habilitado)
const appUserClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_APP_USER || process.env.DATABASE_URL,
    },
  },
});

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
  console.log('🧪 Real RLS Isolation Tests\n');
  console.log('═'.repeat(60));

  // Test 1: Create two tenants with data
  let tenant1Id: string;
  let tenant2Id: string;

  await test('Setup: Create Tenant 1', async () => {
    tenant1Id = uuidv4();
    
    // Create tenant settings
    await postgresClient.tenant_settings.create({
      data: {
        tenant_id: tenant1Id,
        legal_name: 'Tenant 1 - RLS Test',
        timezone: 'America/Lima',
        currency: 'PEN',
      },
    });

    // Create some orders for Tenant 1
    for (let i = 0; i < 5; i++) {
      await postgresClient.orders.create({
        data: {
          tenant_id: tenant1Id,
          order_number: `T1-${i}`,
          total_cents: 10000 + i * 100,
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log(`  Created Tenant 1: ${tenant1Id}`);
  });

  await test('Setup: Create Tenant 2', async () => {
    tenant2Id = uuidv4();
    
    // Create tenant settings
    await postgresClient.tenant_settings.create({
      data: {
        tenant_id: tenant2Id,
        legal_name: 'Tenant 2 - RLS Test',
        timezone: 'America/Lima',
        currency: 'PEN',
      },
    });

    // Create some orders for Tenant 2
    for (let i = 0; i < 10; i++) {
      await postgresClient.orders.create({
        data: {
          tenant_id: tenant2Id,
          order_number: `T2-${i}`,
          total_cents: 20000 + i * 100,
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log(`  Created Tenant 2: ${tenant2Id}`);
  });

  // Test 2: Verify postgres sees all data (bypasses RLS)
  await test('Verification: Postgres sees all data (bypasses RLS)', async () => {
    const allOrders = await postgresClient.orders.findMany();
    
    if (allOrders.length < 15) {
      throw new Error(`Expected at least 15 orders, got ${allOrders.length}`);
    }

    console.log(`  Postgres sees ${allOrders.length} orders (expected 15+)`);
  });

  // Test 3: RLS Isolation - Tenant 1 should only see its data
  await test('RLS Isolation: Tenant 1 sees only its data', async () => {
    // Set tenant context for app_user
    await appUserClient.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1Id}::text, false)
    `;

    // Query orders as Tenant 1
    const tenant1Orders = await appUserClient.orders.findMany();

    if (tenant1Orders.length !== 5) {
      throw new Error(
        `Tenant 1 should see 5 orders, but sees ${tenant1Orders.length}. RLS NOT WORKING!`
      );
    }

    // Verify all orders belong to Tenant 1
    for (const order of tenant1Orders) {
      if (order.tenant_id !== tenant1Id) {
        throw new Error(
          `Tenant 1 sees order from Tenant 2! RLS FAILED! Order: ${JSON.stringify(order)}`
        );
      }
    }

    console.log(`  Tenant 1 sees ${tenant1Orders.length} orders (correct!)`);
  });

  // Test 4: RLS Isolation - Tenant 2 should only see its data
  await test('RLS Isolation: Tenant 2 sees only its data', async () => {
    // Set tenant context for app_user
    await appUserClient.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant2Id}::text, false)
    `;

    // Query orders as Tenant 2
    const tenant2Orders = await appUserClient.orders.findMany();

    if (tenant2Orders.length !== 10) {
      throw new Error(
        `Tenant 2 should see 10 orders, but sees ${tenant2Orders.length}. RLS NOT WORKING!`
      );
    }

    // Verify all orders belong to Tenant 2
    for (const order of tenant2Orders) {
      if (order.tenant_id !== tenant2Id) {
        throw new Error(
          `Tenant 2 sees order from Tenant 1! RLS FAILED! Order: ${JSON.stringify(order)}`
        );
      }
    }

    console.log(`  Tenant 2 sees ${tenant2Orders.length} orders (correct!)`);
  });

  // Test 5: RLS Isolation - Tenant 1 cannot see Tenant 2 data
  await test('RLS Isolation: Tenant 1 cannot see Tenant 2 data', async () => {
    // Set tenant context for Tenant 1
    await appUserClient.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1Id}::text, false)
    `;

    // Try to query Tenant 2 orders directly
    const tenant2Orders = await appUserClient.orders.findMany({
      where: { tenant_id: tenant2Id },
    });

    if (tenant2Orders.length > 0) {
      throw new Error(
        `Tenant 1 should NOT see Tenant 2 orders, but sees ${tenant2Orders.length}. RLS FAILED!`
      );
    }

    console.log(`  Tenant 1 cannot see Tenant 2 data (correct!)`);
  });

  // Test 6: RLS Isolation - Tenant settings are isolated
  await test('RLS Isolation: Tenant settings are isolated', async () => {
    // Set tenant context for Tenant 1
    await appUserClient.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenant1Id}::text, false)
    `;

    // Query tenant settings as Tenant 1
    const settings = await appUserClient.tenant_settings.findMany();

    if (settings.length !== 1) {
      throw new Error(
        `Tenant 1 should see 1 setting, but sees ${settings.length}. RLS NOT WORKING!`
      );
    }

    if (settings[0].tenant_id !== tenant1Id) {
      throw new Error(
        `Tenant 1 sees settings from Tenant 2! RLS FAILED!`
      );
    }

    console.log(`  Tenant 1 sees ${settings.length} setting (correct!)`);
  });

  // Cleanup
  await test('Cleanup: Delete test data', async () => {
    await postgresClient.orders.deleteMany({
      where: {
        OR: [
          { tenant_id: tenant1Id },
          { tenant_id: tenant2Id },
        ],
      },
    });

    await postgresClient.tenant_settings.deleteMany({
      where: {
        OR: [
          { tenant_id: tenant1Id },
          { tenant_id: tenant2Id },
        ],
      },
    });

    console.log(`  Cleaned up test data`);
  });

  // Summary
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

  // Disconnect
  await postgresClient.$disconnect();
  await appUserClient.$disconnect();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
