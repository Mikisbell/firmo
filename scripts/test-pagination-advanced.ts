/**
 * Advanced Pagination Tests
 * Tests for filters, edge cases, and pagination metadata
 */

const BASE_URL = 'http://localhost:3000';

console.log('🧪 Advanced Pagination Tests\n');

interface PaginationResponse {
  items: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function testPaginationMetadata() {
  console.log('📊 Test 1: Pagination Metadata Accuracy');
  
  const response = await fetch(`${BASE_URL}/api/admin/employees?page=2&limit=3`);
  const data: PaginationResponse = await response.json();
  
  const { pagination } = data;
  
  // Verify calculations
  const expectedTotalPages = Math.ceil(pagination.total / pagination.limit);
  const expectedHasNext = pagination.page < expectedTotalPages;
  const expectedHasPrev = pagination.page > 1;
  
  console.log(`   Total: ${pagination.total}`);
  console.log(`   Limit: ${pagination.limit}`);
  console.log(`   Page: ${pagination.page}`);
  console.log(`   Total Pages: ${pagination.totalPages} (expected: ${expectedTotalPages})`);
  console.log(`   Has Next: ${pagination.hasNext} (expected: ${expectedHasNext})`);
  console.log(`   Has Prev: ${pagination.hasPrev} (expected: ${expectedHasPrev})`);
  
  if (
    pagination.totalPages === expectedTotalPages &&
    pagination.hasNext === expectedHasNext &&
    pagination.hasPrev === expectedHasPrev
  ) {
    console.log('   ✅ PASS: Metadata calculations correct\n');
    return true;
  } else {
    console.log('   ❌ FAIL: Metadata calculations incorrect\n');
    return false;
  }
}

async function testProductFilters() {
  console.log('📊 Test 2: Product Filters');
  
  // Test category filter
  const categoryResponse = await fetch(`${BASE_URL}/api/admin/products?category=POLLOS`);
  const categoryData: PaginationResponse = await categoryResponse.json();
  
  console.log(`   Category=POLLOS: ${categoryData.items.length} items`);
  
  const allPollos = categoryData.items.every(p => p.category === 'POLLOS');
  if (allPollos) {
    console.log('   ✅ PASS: Category filter works');
  } else {
    console.log('   ❌ FAIL: Category filter not working');
    return false;
  }
  
  // Test station filter
  const stationResponse = await fetch(`${BASE_URL}/api/admin/products?station=PARRILLA`);
  const stationData: PaginationResponse = await stationResponse.json();
  
  console.log(`   Station=PARRILLA: ${stationData.items.length} items`);
  
  const allParrilla = stationData.items.every(p => p.station === 'PARRILLA');
  if (allParrilla) {
    console.log('   ✅ PASS: Station filter works\n');
    return true;
  } else {
    console.log('   ❌ FAIL: Station filter not working\n');
    return false;
  }
}

async function testNavigationFlow() {
  console.log('📊 Test 3: Navigation Flow (First → Next → Prev → Last)');
  
  // First page
  const page1 = await fetch(`${BASE_URL}/api/admin/products?page=1&limit=5`);
  const data1: PaginationResponse = await page1.json();
  
  console.log(`   Page 1: ${data1.items.length} items, hasNext=${data1.pagination.hasNext}, hasPrev=${data1.pagination.hasPrev}`);
  
  if (!data1.pagination.hasPrev && data1.pagination.hasNext) {
    console.log('   ✅ First page correct');
  } else {
    console.log('   ❌ First page incorrect');
    return false;
  }
  
  // Middle page
  const page2 = await fetch(`${BASE_URL}/api/admin/products?page=2&limit=5`);
  const data2: PaginationResponse = await page2.json();
  
  console.log(`   Page 2: ${data2.items.length} items, hasNext=${data2.pagination.hasNext}, hasPrev=${data2.pagination.hasPrev}`);
  
  if (data2.pagination.hasPrev && data2.pagination.hasNext) {
    console.log('   ✅ Middle page correct');
  } else {
    console.log('   ❌ Middle page incorrect');
    return false;
  }
  
  // Last page
  const lastPage = data2.pagination.totalPages;
  const pageLast = await fetch(`${BASE_URL}/api/admin/products?page=${lastPage}&limit=5`);
  const dataLast: PaginationResponse = await pageLast.json();
  
  console.log(`   Page ${lastPage}: ${dataLast.items.length} items, hasNext=${dataLast.pagination.hasNext}, hasPrev=${dataLast.pagination.hasPrev}`);
  
  if (dataLast.pagination.hasPrev && !dataLast.pagination.hasNext) {
    console.log('   ✅ Last page correct\n');
    return true;
  } else {
    console.log('   ❌ Last page incorrect\n');
    return false;
  }
}

async function testEdgeCases() {
  console.log('📊 Test 4: Edge Cases');
  
  // Test invalid page (negative)
  const negPage = await fetch(`${BASE_URL}/api/admin/employees?page=-5`);
  const negData: PaginationResponse = await negPage.json();
  
  if (negData.pagination.page === 1) {
    console.log('   ✅ Negative page defaults to 1');
  } else {
    console.log('   ❌ Negative page not handled');
    return false;
  }
  
  // Test invalid limit (0)
  const zeroLimit = await fetch(`${BASE_URL}/api/admin/employees?limit=0`);
  const zeroData: PaginationResponse = await zeroLimit.json();
  
  if (zeroData.pagination.limit >= 1) {
    console.log('   ✅ Zero limit defaults to minimum');
  } else {
    console.log('   ❌ Zero limit not handled');
    return false;
  }
  
  // Test limit > 100
  const bigLimit = await fetch(`${BASE_URL}/api/admin/employees?limit=500`);
  const bigData: PaginationResponse = await bigLimit.json();
  
  if (bigData.pagination.limit <= 100) {
    console.log('   ✅ Large limit capped at 100');
  } else {
    console.log('   ❌ Large limit not capped');
    return false;
  }
  
  // Test page beyond total
  const beyondPage = await fetch(`${BASE_URL}/api/admin/employees?page=999`);
  const beyondData: PaginationResponse = await beyondPage.json();
  
  if (beyondData.items.length === 0 && beyondData.pagination.total > 0) {
    console.log('   ✅ Page beyond total returns empty\n');
    return true;
  } else {
    console.log('   ❌ Page beyond total not handled\n');
    return false;
  }
}

async function testPerformance() {
  console.log('📊 Test 5: Performance');
  
  const iterations = 10;
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fetch(`${BASE_URL}/api/admin/products?page=${i + 1}&limit=10`);
    const end = Date.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log(`   Average: ${avgTime.toFixed(0)}ms`);
  console.log(`   Min: ${minTime}ms`);
  console.log(`   Max: ${maxTime}ms`);
  
  if (avgTime < 500) {
    console.log('   ✅ PASS: Performance acceptable (< 500ms avg)\n');
    return true;
  } else {
    console.log('   ⚠️  WARNING: Performance slow (> 500ms avg)\n');
    return true; // Don't fail on performance
  }
}

async function runAdvancedTests() {
  let passed = 0;
  let failed = 0;
  
  if (await testPaginationMetadata()) passed++; else failed++;
  if (await testProductFilters()) passed++; else failed++;
  if (await testNavigationFlow()) passed++; else failed++;
  if (await testEdgeCases()) passed++; else failed++;
  if (await testPerformance()) passed++; else failed++;
  
  console.log('='.repeat(60));
  console.log('📊 RESUMEN DE PRUEBAS AVANZADAS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}/5`);
  console.log(`❌ Failed: ${failed}/5`);
  console.log(`📈 Success Rate: ${(passed / 5 * 100).toFixed(0)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas avanzadas pasaron!');
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa los detalles arriba.');
  }
}

runAdvancedTests().catch(console.error);
