/**
 * Provision Test Tenants for E2E Testing
 * 
 * Creates two test tenants with all necessary data for E2E RLS isolation tests
 * 
 * Run: npx tsx scripts/provision-test-tenants.ts
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Test tenant configurations
const TENANT_1 = {
  id: 'test-tenant-1-' + Date.now(),
  legal_name: 'Pollería Test 1',
  ruc: '20123456789',
  address_text: 'Av. Test 123, Lima',
  admin_pin: '1111',
  admin_name: 'Admin Test 1',
};

const TENANT_2 = {
  id: 'test-tenant-2-' + (Date.now() + 1),
  legal_name: 'Pollería Test 2',
  ruc: '20987654321',
  address_text: 'Av. Test 456, Lima',
  admin_pin: '2222',
  admin_name: 'Admin Test 2',
};

// Hash PIN with salt
function hashPin(pin: string): string {
  const salt = 'PARK_POS_2026_';
  return crypto.createHash('sha256').update(salt + pin).digest('hex');
}

async function provisionTenant(config: typeof TENANT_1) {
  console.log(`\n📋 Provisioning tenant: ${config.legal_name}`);

  try {
    // 1. Create tenant settings
    console.log('  ✓ Creating tenant settings...');
    const tenantSettings = await prisma.tenant_settings.create({
      data: {
        tenant_id: config.id,
        legal_name: config.legal_name,
        ruc: config.ruc,
        address_text: config.address_text,
        timezone: 'America/Lima',
        currency: 'PEN',
        is_active: true,
      },
    });

    // 2. Create default stations
    console.log('  ✓ Creating default stations...');
    const stations = ['PARRILLA', 'COCINA', 'BAR', 'EMPAQUE'];
    for (const station of stations) {
      await prisma.stations.create({
        data: {
          tenant_id: config.id,
          name: station,
          display_name: station,
          is_active: true,
        },
      });
    }

    // 3. Create admin employee
    console.log('  ✓ Creating admin employee...');
    const adminEmployee = await prisma.employees.create({
      data: {
        tenant_id: config.id,
        name: config.admin_name,
        pin_hash: hashPin(config.admin_pin),
        role: 'ADMIN',
        is_active: true,
      },
    });

    // 4. Create terminal number ranges
    console.log('  ✓ Creating terminal number ranges...');
    await prisma.terminal_number_ranges.create({
      data: {
        tenant_id: config.id,
        start_number: 1,
        end_number: 100,
        next_number: 1,
      },
    });

    // 5. Create default terminal
    console.log('  ✓ Creating default terminal...');
    const terminal = await prisma.terminals.create({
      data: {
        tenant_id: config.id,
        terminal_id: `TERMINAL_${config.id.substring(0, 8)}`,
        device_name: `Test Terminal ${config.legal_name}`,
        device_fingerprint: uuidv4(),
        is_active: true,
      },
    });

    // 6. Create test products
    console.log('  ✓ Creating test products...');
    const products = [
      { name: 'Pollo 1/4', price_cents: 1500, category: 'PLATOS' },
      { name: 'Pollo 1/2', price_cents: 2500, category: 'PLATOS' },
      { name: 'Papas', price_cents: 800, category: 'ACOMPAÑAMIENTOS' },
      { name: 'Gaseosa', price_cents: 500, category: 'BEBIDAS' },
    ];

    for (const product of products) {
      await prisma.products.create({
        data: {
          tenant_id: config.id,
          name: product.name,
          price_cents: product.price_cents,
          category: product.category,
          is_active: true,
        },
      });
    }

    // 7. Create test orders
    console.log('  ✓ Creating test orders...');
    for (let i = 1; i <= 3; i++) {
      await prisma.orders.create({
        data: {
          tenant_id: config.id,
          order_number: 1000 + i,
          order_type: 'DINE_IN',
          total_cents: 5000 + (i * 1000),
          status: 'COMPLETED',
        },
      });
    }

    // 8. Create audit log entries
    console.log('  ✓ Creating audit log entries...');
    await prisma.audit_logs.create({
      data: {
        tenant_id: config.id,
        action: 'TENANT_CREATED',
        entity_type: 'TENANT',
        entity_id: config.id,
        changes: { created: true },
      },
    });

    console.log(`✅ Tenant provisioned successfully!`);
    console.log(`   Tenant ID: ${config.id}`);
    console.log(`   Admin PIN: ${config.admin_pin}`);
    console.log(`   Admin Name: ${config.admin_name}`);

    return {
      id: config.id,
      adminPin: config.admin_pin,
      adminName: config.admin_name,
    };
  } catch (error) {
    console.error(`❌ Error provisioning tenant: ${error}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting test tenant provisioning...\n');

  try {
    // Provision both tenants
    const tenant1 = await provisionTenant(TENANT_1);
    const tenant2 = await provisionTenant(TENANT_2);

    console.log('\n✅ All test tenants provisioned successfully!\n');
    console.log('📋 Test Tenant Configuration:');
    console.log(`\nTenant 1:`);
    console.log(`  ID: ${tenant1.id}`);
    console.log(`  PIN: ${tenant1.adminPin}`);
    console.log(`  Name: ${tenant1.adminName}`);
    console.log(`\nTenant 2:`);
    console.log(`  ID: ${tenant2.id}`);
    console.log(`  PIN: ${tenant2.adminPin}`);
    console.log(`  Name: ${tenant2.adminName}`);

    console.log('\n🎯 Ready to run E2E tests:');
    console.log('   npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts');

    process.exit(0);
  } catch (error) {
    console.error('❌ Provisioning failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
