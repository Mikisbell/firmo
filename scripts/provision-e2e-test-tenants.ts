/**
 * Provision E2E Test Tenants
 * Creates 2 test tenants with employees and products for E2E testing
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(SALT + pin).digest('hex');
}

async function main() {
  console.log('🚀 Provisioning E2E test tenants...\n');

  // Tenant 1 - Use fixed ID for E2E tests
  const tenant1Id = '11111111-1111-1111-1111-111111111111';
  const tenant1 = await prisma.tenants.upsert({
    where: { id: tenant1Id },
    update: {},
    create: {
      id: tenant1Id,
      name: 'Pollería Test 1',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  console.log('✅ Tenant 1 created:', tenant1.name, `(ID: ${tenant1Id})`);

  // Tenant 1 - Settings
  await prisma.tenant_settings.upsert({
    where: { tenant_id: tenant1Id },
    update: {},
    create: {
      tenant_id: tenant1Id,
      legal_name: 'Pollería Test 1 S.A.C.',
      ruc: '20123456781',
      address_text: 'Av. Test 123, Lima',
      timezone: 'America/Lima',
      currency: 'PEN',
    },
  });

  // Tenant 1 - Admin Employee
  const tenant1AdminId = uuidv4();
  const tenant1Admin = await prisma.employees.upsert({
    where: { id: tenant1AdminId },
    update: {},
    create: {
      id: tenant1AdminId,
      tenant_id: tenant1Id,
      name: 'Admin Tenant 1',
      role: 'ADMIN',
      pin_hash: hashPin('1111'),
      is_active: true,
    },
  });
  console.log('  ✅ Admin employee created:', tenant1Admin.name);

  // Tenant 1 - Regular Employees
  const tenant1Employees = [
    { name: 'Cajero Tenant 1', role: 'CASHIER' },
    { name: 'Mesero Tenant 1', role: 'WAITER' },
  ];

  for (const emp of tenant1Employees) {
    await prisma.employees.upsert({
      where: { id: uuidv4() },
      update: {},
      create: {
        id: uuidv4(),
        tenant_id: tenant1Id,
        name: emp.name,
        role: emp.role,
        pin_hash: hashPin('9999'),
        is_active: true,
      },
    });
    console.log('  ✅ Employee created:', emp.name);
  }

  // Tenant 1 - Products
  const tenant1Products = [
    { sku: 'T1-POLLO', name: 'Pollo Tenant 1', price_cents: 3500, category: 'POLLOS', station: 'PARRILLA' },
    { sku: 'T1-PAPAS', name: 'Papas Tenant 1', price_cents: 800, category: 'EXTRAS', station: 'COCINA' },
  ];

  for (const prod of tenant1Products) {
    await prisma.products.upsert({
      where: { 
        tenant_id_sku: {
          tenant_id: tenant1Id,
          sku: prod.sku,
        }
      },
      update: {
        name: prod.name,
        short_name: prod.name,
        price_cents: prod.price_cents,
        category: prod.category,
        station: prod.station,
        is_active: true,
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant1Id,
        sku: prod.sku,
        name: prod.name,
        short_name: prod.name,
        price_cents: prod.price_cents,
        category: prod.category,
        station: prod.station,
        type: 'SIMPLE',
        is_active: true,
      },
    });
    console.log('  ✅ Product created:', prod.name);
  }

  console.log('');

  // Tenant 2 - Use fixed ID for E2E tests
  const tenant2Id = '22222222-2222-2222-2222-222222222222';
  const tenant2 = await prisma.tenants.upsert({
    where: { id: tenant2Id },
    update: {},
    create: {
      id: tenant2Id,
      name: 'Pollería Test 2',
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
  console.log('✅ Tenant 2 created:', tenant2.name, `(ID: ${tenant2Id})`);

  // Tenant 2 - Settings
  await prisma.tenant_settings.upsert({
    where: { tenant_id: tenant2Id },
    update: {},
    create: {
      tenant_id: tenant2Id,
      legal_name: 'Pollería Test 2 S.A.C.',
      ruc: '20123456782',
      address_text: 'Av. Test 456, Lima',
      timezone: 'America/Lima',
      currency: 'PEN',
    },
  });

  // Tenant 2 - Admin Employee
  const tenant2AdminId = uuidv4();
  const tenant2Admin = await prisma.employees.upsert({
    where: { id: tenant2AdminId },
    update: {},
    create: {
      id: tenant2AdminId,
      tenant_id: tenant2Id,
      name: 'Admin Tenant 2',
      role: 'ADMIN',
      pin_hash: hashPin('2222'),
      is_active: true,
    },
  });
  console.log('  ✅ Admin employee created:', tenant2Admin.name);

  // Tenant 2 - Regular Employees
  const tenant2Employees = [
    { name: 'Cajero Tenant 2', role: 'CASHIER' },
    { name: 'Mesero Tenant 2', role: 'WAITER' },
  ];

  for (const emp of tenant2Employees) {
    await prisma.employees.upsert({
      where: { id: uuidv4() },
      update: {},
      create: {
        id: uuidv4(),
        tenant_id: tenant2Id,
        name: emp.name,
        role: emp.role,
        pin_hash: hashPin('9999'),
        is_active: true,
      },
    });
    console.log('  ✅ Employee created:', emp.name);
  }

  // Tenant 2 - Products
  const tenant2Products = [
    { sku: 'T2-POLLO', name: 'Pollo Tenant 2', price_cents: 3500, category: 'POLLOS', station: 'PARRILLA' },
    { sku: 'T2-PAPAS', name: 'Papas Tenant 2', price_cents: 800, category: 'EXTRAS', station: 'COCINA' },
  ];

  for (const prod of tenant2Products) {
    await prisma.products.upsert({
      where: { 
        tenant_id_sku: {
          tenant_id: tenant2Id,
          sku: prod.sku,
        }
      },
      update: {
        name: prod.name,
        short_name: prod.name,
        price_cents: prod.price_cents,
        category: prod.category,
        station: prod.station,
        is_active: true,
      },
      create: {
        id: uuidv4(),
        tenant_id: tenant2Id,
        sku: prod.sku,
        name: prod.name,
        short_name: prod.name,
        price_cents: prod.price_cents,
        category: prod.category,
        station: prod.station,
        type: 'SIMPLE',
        is_active: true,
      },
    });
    console.log('  ✅ Product created:', prod.name);
  }

  console.log('\n✅ E2E test tenants provisioned successfully!');
  console.log('\nTest credentials:');
  console.log('  Tenant 1 Admin PIN: 1111');
  console.log('  Tenant 2 Admin PIN: 2222');
  
  // Create analytics data for both tenants
  console.log('\n📊 Creating analytics data...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  // Tenant 1 - Analytics data
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant1Id,
        date: today,
      },
    },
    update: {},
    create: {
      tenant_id: tenant1Id,
      date: today,
      active_terminals: 3,
      total_orders: 25,
      total_events: 150,
      total_revenue_cents: 87500, // S/ 875.00
      avg_order_value_cents: 3500, // S/ 35.00
      peak_orders_per_hour: 8,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 12,
    },
  });
  
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant1Id,
        date: yesterday,
      },
    },
    update: {},
    create: {
      tenant_id: tenant1Id,
      date: yesterday,
      active_terminals: 3,
      total_orders: 22,
      total_events: 132,
      total_revenue_cents: 77000, // S/ 770.00
      avg_order_value_cents: 3500,
      peak_orders_per_hour: 7,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 11,
    },
  });
  
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant1Id,
        date: lastWeek,
      },
    },
    update: {},
    create: {
      tenant_id: tenant1Id,
      date: lastWeek,
      active_terminals: 3,
      total_orders: 20,
      total_events: 120,
      total_revenue_cents: 70000, // S/ 700.00
      avg_order_value_cents: 3500,
      peak_orders_per_hour: 6,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 10,
    },
  });
  
  console.log('  ✅ Tenant 1 analytics created (3 days)');
  
  // Tenant 2 - Analytics data (different values)
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant2Id,
        date: today,
      },
    },
    update: {},
    create: {
      tenant_id: tenant2Id,
      date: today,
      active_terminals: 2,
      total_orders: 18,
      total_events: 108,
      total_revenue_cents: 63000, // S/ 630.00
      avg_order_value_cents: 3500,
      peak_orders_per_hour: 6,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 9,
    },
  });
  
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant2Id,
        date: yesterday,
      },
    },
    update: {},
    create: {
      tenant_id: tenant2Id,
      date: yesterday,
      active_terminals: 2,
      total_orders: 16,
      total_events: 96,
      total_revenue_cents: 56000, // S/ 560.00
      avg_order_value_cents: 3500,
      peak_orders_per_hour: 5,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 8,
    },
  });
  
  await prisma.tenant_analytics.upsert({
    where: {
      tenant_id_date: {
        tenant_id: tenant2Id,
        date: lastWeek,
      },
    },
    update: {},
    create: {
      tenant_id: tenant2Id,
      date: lastWeek,
      active_terminals: 2,
      total_orders: 15,
      total_events: 90,
      total_revenue_cents: 52500, // S/ 525.00
      avg_order_value_cents: 3500,
      peak_orders_per_hour: 5,
      sync_errors: 0,
      api_errors: 0,
      storage_mb: 7,
    },
  });
  
  console.log('  ✅ Tenant 2 analytics created (3 days)');
  console.log('\n✅ Analytics data provisioned successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error provisioning tenants:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
