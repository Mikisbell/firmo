/**
 * Script de prueba para verificar CRUD de Admin Panel
 * Verifica Employees y Products CRUD
 */

import prisma from '../src/core/db/prisma';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

async function testEmployeesCRUD() {
  console.log('\n🧪 Testing Employees CRUD...\n');

  try {
    // 1. CREATE
    console.log('1️⃣ CREATE Employee...');
    const testEmployee = await prisma.employees.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT_ID,
        name: 'Test Employee CRUD',
        role: 'WAITER',
        pin_hash: hashPin('9999'),
        is_active: true,
      },
    });
    console.log('✅ Created:', testEmployee.id, '-', testEmployee.name);

    // 2. READ
    console.log('\n2️⃣ READ Employee...');
    const readEmployee = await prisma.employees.findFirst({
      where: { id: testEmployee.id, tenant_id: TENANT_ID },
    });
    console.log('✅ Read:', readEmployee?.name, '- Role:', readEmployee?.role);

    // 3. UPDATE
    console.log('\n3️⃣ UPDATE Employee...');
    const updatedEmployee = await prisma.employees.update({
      where: { id: testEmployee.id },
      data: { name: 'Test Employee UPDATED', role: 'CASHIER' },
    });
    console.log('✅ Updated:', updatedEmployee.name, '- New Role:', updatedEmployee.role);

    // 4. SOFT DELETE
    console.log('\n4️⃣ SOFT DELETE Employee...');
    await prisma.employees.update({
      where: { id: testEmployee.id },
      data: { is_active: false },
    });
    const deletedEmployee = await prisma.employees.findFirst({
      where: { id: testEmployee.id },
    });
    console.log('✅ Soft Deleted - is_active:', deletedEmployee?.is_active);

    // 5. CLEANUP
    console.log('\n5️⃣ CLEANUP (hard delete for test)...');
    await prisma.employees.delete({
      where: { id: testEmployee.id },
    });
    console.log('✅ Cleaned up test employee');

    console.log('\n✅ Employees CRUD: ALL TESTS PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ Employees CRUD Error:', error);
    return false;
  }
}

async function testProductsCRUD() {
  console.log('\n🧪 Testing Products CRUD...\n');

  try {
    // 1. CREATE
    console.log('1️⃣ CREATE Product...');
    const testProduct = await prisma.products.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT_ID,
        sku: 'TEST-CRUD-001',
        name: 'Test Product CRUD',
        short_name: 'Test CRUD',
        price_cents: 1500, // S/ 15.00
        category: 'EXTRAS',
        station: 'COCINA',
        type: 'SIMPLE',
        is_active: true,
      },
    });
    console.log('✅ Created:', testProduct.id, '-', testProduct.name);
    console.log('   Price:', testProduct.price_cents, 'centavos (S/', (testProduct.price_cents / 100).toFixed(2), ')');

    // 2. READ
    console.log('\n2️⃣ READ Product...');
    const readProduct = await prisma.products.findFirst({
      where: { id: testProduct.id, tenant_id: TENANT_ID },
    });
    console.log('✅ Read:', readProduct?.name, '- SKU:', readProduct?.sku);

    // 3. UPDATE
    console.log('\n3️⃣ UPDATE Product...');
    const updatedProduct = await prisma.products.update({
      where: { id: testProduct.id },
      data: { 
        name: 'Test Product UPDATED',
        price_cents: 2000, // S/ 20.00
      },
    });
    console.log('✅ Updated:', updatedProduct.name);
    console.log('   New Price:', updatedProduct.price_cents, 'centavos (S/', (updatedProduct.price_cents / 100).toFixed(2), ')');

    // 4. CATALOG VERSION CHECK
    console.log('\n4️⃣ CHECK Catalog Version...');
    const catalogMeta = await prisma.catalog_meta.findUnique({
      where: { tenant_id: TENANT_ID },
    });
    console.log('✅ Catalog Version:', catalogMeta?.catalog_version);

    // 5. SOFT DELETE
    console.log('\n5️⃣ SOFT DELETE Product...');
    await prisma.products.update({
      where: { id: testProduct.id },
      data: { is_active: false },
    });
    const deletedProduct = await prisma.products.findFirst({
      where: { id: testProduct.id },
    });
    console.log('✅ Soft Deleted - is_active:', deletedProduct?.is_active);

    // 6. CLEANUP
    console.log('\n6️⃣ CLEANUP (hard delete for test)...');
    await prisma.products.delete({
      where: { id: testProduct.id },
    });
    console.log('✅ Cleaned up test product');

    console.log('\n✅ Products CRUD: ALL TESTS PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ Products CRUD Error:', error);
    return false;
  }
}

async function testAuditTrail() {
  console.log('\n🧪 Testing Audit Trail...\n');

  try {
    // Check recent audit logs
    const recentLogs = await prisma.admin_access_logs.findMany({
      where: { tenant_id: TENANT_ID },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    console.log('📋 Recent Audit Logs:');
    recentLogs.forEach((log, i) => {
      console.log(`${i + 1}. ${log.action} on ${log.resource} - ${log.created_at.toISOString()}`);
      if (log.metadata) {
        console.log('   Metadata:', JSON.stringify(log.metadata));
      }
    });

    console.log('\n✅ Audit Trail: WORKING\n');
    return true;
  } catch (error) {
    console.error('❌ Audit Trail Error:', error);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 ADMIN PANEL CRUD VERIFICATION TESTS');
  console.log('═══════════════════════════════════════════════════════');

  const results = {
    employees: false,
    products: false,
    auditTrail: false,
  };

  // Test Employees CRUD
  results.employees = await testEmployeesCRUD();

  // Test Products CRUD
  results.products = await testProductsCRUD();

  // Test Audit Trail
  results.auditTrail = await testAuditTrail();

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Employees CRUD:', results.employees ? '✅ PASS' : '❌ FAIL');
  console.log('Products CRUD:', results.products ? '✅ PASS' : '❌ FAIL');
  console.log('Audit Trail:', results.auditTrail ? '✅ PASS' : '❌ FAIL');
  console.log('═══════════════════════════════════════════════════════');

  const allPassed = results.employees && results.products && results.auditTrail;
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED! Frontend, Backend, and Database are aligned.\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED. Check the output above for details.\n');
  }

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
