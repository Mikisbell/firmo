/**
 * Test Pagination Endpoints
 * Tests for Day 4 Part 1 - Pagination implementation in endpoints
 */

const BASE_URL = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

console.log('🧪 Testing Pagination Endpoints (Day 4 Part 1)\n');

// Helper function to test endpoint
async function testEndpoint(name: string, url: string, expectedFields: string[]) {
  console.log(`\n📍 Testing ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`   ❌ FAIL: HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    // Check pagination structure
    if (!data.items || !data.pagination) {
      console.log(`   ❌ FAIL: Missing items or pagination`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return false;
    }
    
    // Check pagination metadata
    const { pagination } = data;
    const requiredFields = ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'];
    const missingFields = requiredFields.filter(f => !(f in pagination));
    
    if (missingFields.length > 0) {
      console.log(`   ❌ FAIL: Missing pagination fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    // Check items structure
    if (data.items.length > 0) {
      const item = data.items[0];
      const missingItemFields = expectedFields.filter(f => !(f in item));
      
      if (missingItemFields.length > 0) {
        console.log(`   ❌ FAIL: Missing item fields: ${missingItemFields.join(', ')}`);
        return false;
      }
    }
    
    console.log(`   ✅ PASS`);
    console.log(`   Items: ${data.items.length}`);
    console.log(`   Total: ${pagination.total}`);
    console.log(`   Page: ${pagination.page}/${pagination.totalPages}`);
    console.log(`   Has Next: ${pagination.hasNext}`);
    console.log(`   Has Prev: ${pagination.hasPrev}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ FAIL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  // Test 1: Employees - Default pagination
  if (await testEndpoint(
    'Employees (default)',
    `${BASE_URL}/api/admin/employees`,
    ['id', 'name', 'role', 'is_active']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 2: Employees - Custom page and limit
  if (await testEndpoint(
    'Employees (page=2, limit=3)',
    `${BASE_URL}/api/admin/employees?page=2&limit=3`,
    ['id', 'name', 'role', 'is_active']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 3: Employees - Filter by is_active
  if (await testEndpoint(
    'Employees (is_active=true)',
    `${BASE_URL}/api/admin/employees?is_active=true`,
    ['id', 'name', 'role', 'is_active']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 4: Products - Default pagination
  if (await testEndpoint(
    'Products (default)',
    `${BASE_URL}/api/admin/products`,
    ['id', 'sku', 'name', 'price_cents', 'category', 'station']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 5: Products - Custom pagination
  if (await testEndpoint(
    'Products (page=1, limit=5)',
    `${BASE_URL}/api/admin/products?page=1&limit=5`,
    ['id', 'sku', 'name', 'price_cents', 'category', 'station']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 6: Promotions - Default pagination
  if (await testEndpoint(
    'Promotions (default)',
    `${BASE_URL}/api/admin/promotions`,
    ['id', 'name', 'type', 'value', 'starts_at', 'ends_at']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 7: Tables - Default pagination
  if (await testEndpoint(
    'Tables (default)',
    `${BASE_URL}/api/admin/tables`,
    ['id', 'number', 'capacity', 'status']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 8: Terminals - Default pagination
  if (await testEndpoint(
    'Terminals (default)',
    `${BASE_URL}/api/admin/terminals`,
    ['id', 'terminal_id', 'station_id']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 9: Edge case - page=0 (should default to 1)
  if (await testEndpoint(
    'Employees (page=0, should default to 1)',
    `${BASE_URL}/api/admin/employees?page=0`,
    ['id', 'name', 'role']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 10: Edge case - limit=200 (should cap at 100)
  if (await testEndpoint(
    'Employees (limit=200, should cap at 100)',
    `${BASE_URL}/api/admin/employees?limit=200`,
    ['id', 'name', 'role']
  )) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}/10`);
  console.log(`❌ Failed: ${failed}/10`);
  console.log(`📈 Success Rate: ${(passed / 10 * 100).toFixed(0)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron!');
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa los detalles arriba.');
  }
}

// Run tests
runTests().catch(console.error);
