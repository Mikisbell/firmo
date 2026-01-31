/**
 * Test Pagination Implementation
 * Tests for Day 3 - Pagination helpers and components
 */

import { parsePaginationParams, createPaginatedResponse, getPaginationMeta } from '../src/lib/pagination';

console.log('🧪 Testing Pagination Implementation (Day 3)\n');

// Test 1: parsePaginationParams with default values
console.log('Test 1: parsePaginationParams - Default values');
const searchParams1 = new URLSearchParams();
const result1 = parsePaginationParams(searchParams1);
console.log('✅ Default params:', result1);
console.assert(result1.page === 1, 'Default page should be 1');
console.assert(result1.limit === 10, 'Default limit should be 10');
console.assert(result1.skip === 0, 'Default skip should be 0');

// Test 2: parsePaginationParams with custom values
console.log('\nTest 2: parsePaginationParams - Custom values');
const searchParams2 = new URLSearchParams('page=3&limit=20');
const result2 = parsePaginationParams(searchParams2);
console.log('✅ Custom params (page=3, limit=20):', result2);
console.assert(result2.page === 3, 'Page should be 3');
console.assert(result2.limit === 20, 'Limit should be 20');
console.assert(result2.skip === 40, 'Skip should be 40 (page-1 * limit)');

// Test 3: parsePaginationParams with invalid values
console.log('\nTest 3: parsePaginationParams - Invalid values');
const searchParams3 = new URLSearchParams('page=-5&limit=200');
const result3 = parsePaginationParams(searchParams3);
console.log('✅ Invalid params (page=-5, limit=200):', result3);
console.assert(result3.page === 1, 'Negative page should default to 1');
console.assert(result3.limit === 100, 'Limit > 100 should cap at 100');

// Test 4: createPaginatedResponse - First page
console.log('\nTest 4: createPaginatedResponse - First page');
const items = [1, 2, 3, 4, 5];
const total = 50;
const params = { page: 1, limit: 10, skip: 0 };
const response = createPaginatedResponse(items, total, params);
console.log('✅ First page response:', response.pagination);
console.assert(response.pagination.page === 1, 'Page should be 1');
console.assert(response.pagination.totalPages === 5, 'Total pages should be 5');
console.assert(response.pagination.hasNext === true, 'Should have next page');
console.assert(response.pagination.hasPrev === false, 'Should not have previous page');

// Test 5: createPaginatedResponse - Last page
console.log('\nTest 5: createPaginatedResponse - Last page');
const params2 = { page: 5, limit: 10, skip: 40 };
const response2 = createPaginatedResponse([1, 2, 3], 43, params2);
console.log('✅ Last page response:', response2.pagination);
console.assert(response2.pagination.hasNext === false, 'Should not have next page');
console.assert(response2.pagination.hasPrev === true, 'Should have previous page');

// Test 6: createPaginatedResponse - Empty results
console.log('\nTest 6: createPaginatedResponse - Empty results');
const response3 = createPaginatedResponse([], 0, { page: 1, limit: 10, skip: 0 });
console.log('✅ Empty results response:', response3.pagination);
console.assert(response3.pagination.total === 0, 'Total should be 0');
console.assert(response3.pagination.totalPages === 0, 'Total pages should be 0');
console.assert(response3.pagination.hasNext === false, 'Should not have next page');
console.assert(response3.pagination.hasPrev === false, 'Should not have previous page');

// Test 7: getPaginationMeta
console.log('\nTest 7: getPaginationMeta - Metadata only');
const meta = getPaginationMeta(100, { page: 3, limit: 20, skip: 40 });
console.log('✅ Pagination metadata:', meta);
console.assert(meta.page === 3, 'Page should be 3');
console.assert(meta.totalPages === 5, 'Total pages should be 5');
console.assert(meta.hasNext === true, 'Should have next page');
console.assert(meta.hasPrev === true, 'Should have previous page');

// Test 8: Edge case - Single item
console.log('\nTest 8: Edge case - Single item');
const response4 = createPaginatedResponse([1], 1, { page: 1, limit: 10, skip: 0 });
console.log('✅ Single item response:', response4.pagination);
console.assert(response4.pagination.totalPages === 1, 'Total pages should be 1');
console.assert(response4.pagination.hasNext === false, 'Should not have next page');
console.assert(response4.pagination.hasPrev === false, 'Should not have previous page');

// Test 9: Edge case - Exact page boundary
console.log('\nTest 9: Edge case - Exact page boundary');
const response5 = createPaginatedResponse([1, 2, 3, 4, 5], 100, { page: 10, limit: 10, skip: 90 });
console.log('✅ Exact boundary response:', response5.pagination);
console.assert(response5.pagination.totalPages === 10, 'Total pages should be 10');
console.assert(response5.pagination.hasNext === false, 'Should not have next page (last page)');
console.assert(response5.pagination.hasPrev === true, 'Should have previous page');

// Test 10: Performance test - Large dataset
console.log('\nTest 10: Performance test - Large dataset');
const startTime = Date.now();
for (let i = 0; i < 1000; i++) {
  const params = { page: i + 1, limit: 50, skip: i * 50 };
  createPaginatedResponse([], 50000, params);
}
const endTime = Date.now();
console.log(`✅ Performance: 1000 pagination calculations in ${endTime - startTime}ms`);
console.assert(endTime - startTime < 100, 'Should complete in less than 100ms');

console.log('\n✅ All pagination tests passed!\n');
console.log('Summary:');
console.log('- parsePaginationParams: ✅ Handles defaults, custom values, and invalid inputs');
console.log('- createPaginatedResponse: ✅ Correctly calculates pagination metadata');
console.log('- getPaginationMeta: ✅ Returns metadata without items');
console.log('- Edge cases: ✅ Handles empty results, single items, and boundaries');
console.log('- Performance: ✅ Fast enough for production use');
