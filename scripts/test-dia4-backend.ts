/**
 * Test Día 4 - Backend Pagination Endpoints
 * Prueba los 5 endpoints con paginación implementada
 */

const BASE_URL = 'http://localhost:3001';
const TENANT_ID_TEST = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

console.log('🧪 Testing Día 4 - Backend Pagination Endpoints\n');
console.log('='.repeat(60));

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function testEndpoint(name: string, url: string, expectedFields: string[]) {
  try {
    console.log(`\n📍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`   ❌ FAIL: HTTP ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    
    // Check if it's a paginated response
    if (!data.items || !data.pagination) {
      console.log(`   ❌ FAIL: Not a paginated response`);
      console.log(`   Response keys:`, Object.keys(data));
      return false;
    }
    
    // Check pagination structure
    const requiredPaginationFields = ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev'];
    const missingFields = requiredPaginationFields.filter(field => !(field in data.pagination));
    
    if (missingFields.length > 0) {
      console.log(`   ❌ FAIL: Missing pagination fields: ${missingFields.join(', ')}`);
      return false;
    }
    
    // Check items structure (if there are items)
    if (data.items.length > 0) {
      const firstItem = data.items[0];
      const missingItemFields = expectedFields.filter(field => !(field in firstItem));
      
      if (missingItemFields.length > 0) {
        console.log(`   ⚠️  WARNING: Missing item fields: ${missingItemFields.join(', ')}`);
      }
    }
    
    console.log(`   ✅ PASS`);
    console.log(`   📊 Stats:`);
    console.log(`      - Items: ${data.items.length}`);
    console.log(`      - Total: ${data.pagination.total}`);
    console.log(`      - Page: ${data.pagination.page}/${data.pagination.totalPages}`);
    console.log(`      - Has Next: ${data.pagination.hasNext}`);
    console.log(`      - Has Prev: ${data.pagination.hasPrev}`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testPaginationParams(name: string, baseUrl: string) {
  console.log(`\n🔍 Testing pagination params for: ${name}`);
  
  const tests = [
    { params: '?page=1&limit=5', desc: 'Page 1, Limit 5' },
    { params: '?page=2&limit=3', desc: 'Page 2, Limit 3' },
    { params: '?limit=20', desc: 'Default page, Limit 20' },
    { params: '?page=1', desc: 'Page 1, Default limit' },
  ];
  
  let passed = 0;
  
  for (const test of tests) {
    try {
      const url = `${baseUrl}${test.params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`   ❌ ${test.desc}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data.items || !data.pagination) {
        console.log(`   ❌ ${test.desc}: Invalid response structure`);
        continue;
      }
      
      console.log(`   ✅ ${test.desc}: ${data.items.length} items, page ${data.pagination.page}`);
      passed++;
    } catch (error) {
      console.log(`   ❌ ${test.desc}: ${error instanceof Error ? error.message : 'Error'}`);
    }
  }
  
  console.log(`   📊 Result: ${passed}/${tests.length} tests passed`);
  return passed === tests.length;
}

async function testFilters(name: string, baseUrl: string, filterTests: Array<{params: string, desc: string}>) {
  console.log(`\n🔎 Testing filters for: ${name}`);
  
  let passed = 0;
  
  for (const test of filterTests) {
    try {
      const url = `${baseUrl}${test.params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`   ❌ ${test.desc}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`   ✅ ${test.desc}: ${data.pagination.total} items`);
      passed++;
    } catch (error) {
      console.log(`   ❌ ${test.desc}: ${error instanceof Error ? error.message : 'Error'}`);
    }
  }
  
  console.log(`   📊 Result: ${passed}/${filterTests.length} tests passed`);
  return passed === filterTests.length;
}

async function runTests() {
  console.log('\n🚀 Starting Backend Pagination Tests...\n');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
  };
  
  // Test 1: Employees Endpoint
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: EMPLOYEES ENDPOINT');
  console.log('='.repeat(60));
  
  results.total++;
  if (await testEndpoint(
    'GET /api/admin/employees',
    `${BASE_URL}/api/admin/employees`,
    ['id', 'name', 'role', 'is_active']
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testPaginationParams('Employees', `${BASE_URL}/api/admin/employees`)) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testFilters('Employees', `${BASE_URL}/api/admin/employees`, [
    { params: '?is_active=true', desc: 'Active only' },
    { params: '?is_active=false', desc: 'Inactive only' },
  ])) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test 2: Products Endpoint
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: PRODUCTS ENDPOINT');
  console.log('='.repeat(60));
  
  results.total++;
  if (await testEndpoint(
    'GET /api/admin/products',
    `${BASE_URL}/api/admin/products`,
    ['id', 'sku', 'name', 'price_cents', 'category', 'station']
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testPaginationParams('Products', `${BASE_URL}/api/admin/products`)) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testFilters('Products', `${BASE_URL}/api/admin/products`, [
    { params: '?is_active=true', desc: 'Active only' },
    { params: '?category=POLLOS', desc: 'Category: POLLOS' },
    { params: '?station=PARRILLA', desc: 'Station: PARRILLA' },
  ])) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test 3: Promotions Endpoint
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: PROMOTIONS ENDPOINT');
  console.log('='.repeat(60));
  
  results.total++;
  if (await testEndpoint(
    'GET /api/admin/promotions',
    `${BASE_URL}/api/admin/promotions`,
    ['id', 'name', 'type', 'value', 'is_active']
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testPaginationParams('Promotions', `${BASE_URL}/api/admin/promotions`)) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test 4: Tables Endpoint
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: TABLES ENDPOINT');
  console.log('='.repeat(60));
  
  results.total++;
  if (await testEndpoint(
    'GET /api/admin/tables',
    `${BASE_URL}/api/admin/tables`,
    ['id', 'number', 'capacity', 'status']
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testPaginationParams('Tables', `${BASE_URL}/api/admin/tables`)) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Test 5: Terminals Endpoint
  console.log('\n' + '='.repeat(60));
  console.log('TEST 5: TERMINALS ENDPOINT');
  console.log('='.repeat(60));
  
  results.total++;
  if (await testEndpoint(
    'GET /api/admin/terminals',
    `${BASE_URL}/api/admin/terminals`,
    ['id', 'terminal_id', 'station_id']
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testPaginationParams('Terminals', `${BASE_URL}/api/admin/terminals`)) {
    results.passed++;
  } else {
    results.failed++;
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
    console.log('\n🎉 ALL TESTS PASSED! 🎉\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED ⚠️\n');
  }
  
  return results.failed === 0;
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
