/**
 * Test Día 4 - Database Connection and Queries
 * Verifica la conexión a la base de datos y queries de paginación
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_ID_TEST = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

console.log('🧪 Testing Día 4 - Database Connection and Queries\n');
console.log('='.repeat(60));

async function testDatabaseConnection() {
  console.log('\n📍 Test 1: Database Connection');
  try {
    await prisma.$connect();
    console.log('   ✅ PASS: Connected to database');
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Could not connect to database');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testEmployeesQuery() {
  console.log('\n📍 Test 2: Employees Query with Pagination');
  try {
    const page = 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    const [employees, total] = await Promise.all([
      prisma.employees.findMany({
        where: { tenant_id: TENANT_ID_TEST },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          role: true,
          is_active: true,
        },
      }),
      prisma.employees.count({
        where: { tenant_id: TENANT_ID_TEST },
      }),
    ]);
    
    console.log('   ✅ PASS: Query executed successfully');
    console.log(`   📊 Results: ${employees.length} items, ${total} total`);
    
    if (employees.length > 0) {
      console.log(`   📝 Sample: ${employees[0].name} (${employees[0].role})`);
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Query failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testProductsQuery() {
  console.log('\n📍 Test 3: Products Query with Pagination and Filters');
  try {
    const page = 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    const where: any = { tenant_id: TENANT_ID_TEST };
    where.is_active = true;
    
    const [products, total] = await Promise.all([
      prisma.products.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          sku: true,
          name: true,
          price_cents: true,
          category: true,
          station: true,
          is_active: true,
        },
      }),
      prisma.products.count({ where }),
    ]);
    
    console.log('   ✅ PASS: Query executed successfully');
    console.log(`   📊 Results: ${products.length} items, ${total} total (active only)`);
    
    if (products.length > 0) {
      console.log(`   📝 Sample: ${products[0].name} - S/${(products[0].price_cents / 100).toFixed(2)}`);
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Query failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testPromotionsQuery() {
  console.log('\n📍 Test 4: Promotions Query with Pagination');
  try {
    const page = 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    const [promotions, total] = await Promise.all([
      prisma.promotions.findMany({
        where: { tenant_id: TENANT_ID_TEST },
        orderBy: { starts_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          is_active: true,
        },
      }),
      prisma.promotions.count({
        where: { tenant_id: TENANT_ID_TEST },
      }),
    ]);
    
    console.log('   ✅ PASS: Query executed successfully');
    console.log(`   📊 Results: ${promotions.length} items, ${total} total`);
    
    if (promotions.length > 0) {
      console.log(`   📝 Sample: ${promotions[0].name} (${promotions[0].type})`);
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Query failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testTablesQuery() {
  console.log('\n📍 Test 5: Tables Query with Pagination');
  try {
    const page = 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    const [tables, total] = await Promise.all([
      prisma.tables.findMany({
        where: { tenant_id: TENANT_ID_TEST },
        orderBy: [{ zone_id: 'asc' }, { number: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true,
          number: true,
          capacity: true,
          status: true,
          is_active: true,
        },
      }),
      prisma.tables.count({
        where: { tenant_id: TENANT_ID_TEST },
      }),
    ]);
    
    console.log('   ✅ PASS: Query executed successfully');
    console.log(`   📊 Results: ${tables.length} items, ${total} total`);
    
    if (tables.length > 0) {
      console.log(`   📝 Sample: Mesa ${tables[0].number} (${tables[0].status})`);
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Query failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testTerminalsQuery() {
  console.log('\n📍 Test 6: Terminals Query with Pagination');
  try {
    const page = 1;
    const limit = 5;
    const skip = (page - 1) * limit;
    
    const [terminals, total] = await Promise.all([
      prisma.terminals.findMany({
        where: { tenant_id: TENANT_ID_TEST },
        orderBy: { terminal_id: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          terminal_id: true,
          station_id: true,
          is_allowed: true,
        },
      }),
      prisma.terminals.count({
        where: { tenant_id: TENANT_ID_TEST },
      }),
    ]);
    
    console.log('   ✅ PASS: Query executed successfully');
    console.log(`   📊 Results: ${terminals.length} items, ${total} total`);
    
    if (terminals.length > 0) {
      console.log(`   📝 Sample: ${terminals[0].terminal_id} (${terminals[0].station_id})`);
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Query failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testPerformance() {
  console.log('\n📍 Test 7: Query Performance');
  try {
    const iterations = 10;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      await prisma.employees.findMany({
        where: { tenant_id: TENANT_ID_TEST },
        skip: 0,
        take: 10,
      });
      
      const end = Date.now();
      times.push(end - start);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log('   ✅ PASS: Performance test completed');
    console.log(`   📊 Stats (${iterations} queries):`);
    console.log(`      - Average: ${avg.toFixed(2)}ms`);
    console.log(`      - Min: ${min}ms`);
    console.log(`      - Max: ${max}ms`);
    
    if (avg > 100) {
      console.log('   ⚠️  WARNING: Average query time > 100ms');
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ FAIL: Performance test failed');
    console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function runTests() {
  console.log('\n🚀 Starting Database Tests...\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  
  const tests = [
    testDatabaseConnection,
    testEmployeesQuery,
    testProductsQuery,
    testPromotionsQuery,
    testTablesQuery,
    testTerminalsQuery,
    testPerformance,
  ];
  
  for (const test of tests) {
    results.total++;
    if (await test()) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL DATABASE TESTS PASSED! 🎉\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️\n');
  }
  
  await prisma.$disconnect();
  
  return results.failed === 0;
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
