/**
 * Comprehensive Task 8 Testing
 * Tests Backend, API, Database, and Frontend integration
 */

import prisma from '../src/core/db/prisma';
import { getTenantId } from '../src/core/config/tenant';
import { randomUUID } from 'crypto';
import { bulkOperationsService } from '../src/core/services/bulk-operations.service';

const TENANT_ID = getTenantId();
const BASE_URL = 'http://localhost:3001';
const ADMIN_PIN = '1234';

let authCookie: string | null = null;

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(category: string, name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ category, name, passed, error, duration });
  const status = passed ? '✅' : '❌';
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.log(`${status} ${category}: ${name}${durationStr}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

/**
 * Get auth token
 */
async function getAuthToken(): Promise<string> {
  if (authCookie) return authCookie;

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: TENANT_ID, pin: ADMIN_PIN }),
  });

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/auth_token=([^;]+)/);
    if (match) {
      authCookie = match[1];
      return authCookie;
    }
  }

  throw new Error('Login failed');
}

/**
 * Create test products
 */
async function createTestProducts(count: number, prefix: string = 'TEST'): Promise<string[]> {
  const ids: string[] = [];
  const timestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    const product = await prisma.products.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT_ID,
        sku: `${prefix}-${timestamp}-${i}`,
        name: `Test Product ${prefix} ${i}`,
        price_cents: 1000 + i * 100,
        category: 'POLLOS',
        station: 'PARRILLA',
        type: 'SIMPLE',
        is_active: true,
      },
    });
    ids.push(product.id);
  }
  
  return ids;
}

/**
 * Cleanup test products
 */
async function cleanupTestProducts(productIds: string[]) {
  await prisma.products.deleteMany({
    where: { id: { in: productIds } },
  });
}

// ============================================================================
// BACKEND TESTS (Service Layer)
// ============================================================================

async function testBackendService() {
  console.log('\n🔧 BACKEND SERVICE TESTS\n');
  
  // Test 1: Service bulk update
  {
    const testName = 'Service bulk update';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'BACKEND');
      
      const result = await bulkOperationsService.bulkUpdate(
        productIds,
        { is_active: false },
        TENANT_ID,
        'test-user-id'
      );
      
      if (result.success_count === 5 && result.failure_count === 0) {
        logTest('Backend', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 5 success, got ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Backend', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: Service bulk delete
  {
    const testName = 'Service bulk delete';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'BACKEND-DEL');
      
      const result = await bulkOperationsService.bulkDelete(
        productIds,
        TENANT_ID,
        'test-user-id'
      );
      
      if (result.success_count === 5 && result.failure_count === 0) {
        logTest('Backend', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 5 success, got ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Backend', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 3: Service batch processing (50+ products)
  {
    const testName = 'Service batch processing (60 products)';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(60, 'BATCH');
      
      const result = await bulkOperationsService.bulkUpdate(
        productIds,
        { category: 'BEBIDAS' },
        TENANT_ID,
        'test-user-id'
      );
      
      if (result.success_count === 60 && result.failure_count === 0) {
        logTest('Backend', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 60 success, got ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Backend', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
}

// ============================================================================
// API TESTS
// ============================================================================

async function testAPI() {
  console.log('\n🌐 API ENDPOINT TESTS\n');
  
  const token = await getAuthToken();
  
  // Test 1: API bulk activate
  {
    const testName = 'API bulk activate';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'API-ACT');
      await prisma.products.updateMany({
        where: { id: { in: productIds } },
        data: { is_active: false },
      });
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          updates: { is_active: true },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: API bulk category change
  {
    const testName = 'API bulk category change';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'API-CAT');
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          updates: { category: 'EXTRAS' },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 3: API bulk station change
  {
    const testName = 'API bulk station change';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'API-STA');
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          updates: { station: 'COCINA' },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 4: API bulk delete
  {
    const testName = 'API bulk delete';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'API-DEL');
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          operation: 'delete',
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 5: API validation - no products
  {
    const testName = 'API validation - no products';
    const startTime = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: [],
          updates: { is_active: true },
        }),
      });
      
      if (response.status === 400) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 6: API validation - no updates
  {
    const testName = 'API validation - no updates';
    const startTime = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: [randomUUID()],
          updates: {},
        }),
      });
      
      if (response.status === 400) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 7: API authentication required
  {
    const testName = 'API authentication required';
    const startTime = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_ids: [randomUUID()],
          updates: { is_active: true },
        }),
      });
      
      if (response.status === 401) {
        logTest('API', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Expected 401, got ${response.status}`);
      }
    } catch (error) {
      logTest('API', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
}

// ============================================================================
// DATABASE TESTS
// ============================================================================

async function testDatabase() {
  console.log('\n💾 DATABASE TESTS\n');
  
  // Test 1: Database update verification
  {
    const testName = 'Database update verification';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(5, 'DB-UPD');
      
      await bulkOperationsService.bulkUpdate(
        productIds,
        { is_active: false, category: 'BEBIDAS' },
        TENANT_ID,
        'test-user-id'
      );
      
      const products = await prisma.products.findMany({
        where: { id: { in: productIds } },
        select: { is_active: true, category: true },
      });
      
      const allCorrect = products.every(p => 
        p.is_active === false && p.category === 'BEBIDAS'
      );
      
      if (allCorrect) {
        logTest('Database', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error('Not all products updated correctly');
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Database', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: Database version increment
  {
    const testName = 'Database version increment';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(3, 'DB-VER');
      
      const beforeProducts = await prisma.products.findMany({
        where: { id: { in: productIds } },
        select: { id: true, version: true },
      });
      
      await bulkOperationsService.bulkUpdate(
        productIds,
        { is_active: false },
        TENANT_ID,
        'test-user-id'
      );
      
      const afterProducts = await prisma.products.findMany({
        where: { id: { in: productIds } },
        select: { id: true, version: true },
      });
      
      const allIncremented = afterProducts.every((after, index) => 
        after.version === beforeProducts[index].version + 1
      );
      
      if (allIncremented) {
        logTest('Database', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error('Not all versions incremented');
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Database', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 3: Database audit trail
  {
    const testName = 'Database audit trail';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(3, 'DB-AUD');
      const validUserId = randomUUID(); // Use valid UUID for audit trail
      
      const beforeCount = await prisma.admin_access_logs.count({
        where: {
          tenant_id: TENANT_ID,
          action: 'BULK_UPDATE',
        },
      });
      
      await bulkOperationsService.bulkUpdate(
        productIds,
        { is_active: false },
        TENANT_ID,
        validUserId
      );
      
      const afterCount = await prisma.admin_access_logs.count({
        where: {
          tenant_id: TENANT_ID,
          action: 'BULK_UPDATE',
        },
      });
      
      if (afterCount > beforeCount) {
        logTest('Database', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error('No audit log created');
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Database', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 4: Database catalog version increment
  {
    const testName = 'Database catalog version increment';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(3, 'DB-CAT');
      
      const beforeCatalog = await prisma.catalog_meta.findUnique({
        where: { tenant_id: TENANT_ID },
        select: { catalog_version: true },
      });
      
      const beforeVersion = beforeCatalog?.catalog_version || 0;
      
      await bulkOperationsService.bulkUpdate(
        productIds,
        { is_active: false },
        TENANT_ID,
        'test-user-id'
      );
      
      const afterCatalog = await prisma.catalog_meta.findUnique({
        where: { tenant_id: TENANT_ID },
        select: { catalog_version: true },
      });
      
      const afterVersion = afterCatalog?.catalog_version || 0;
      
      if (afterVersion > beforeVersion) {
        logTest('Database', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error(`Catalog version not incremented: ${beforeVersion} -> ${afterVersion}`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Database', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 5: Database transaction atomicity
  {
    const testName = 'Database transaction atomicity';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(3, 'DB-TXN');
      
      // Add one invalid ID to force failure
      const invalidIds = [...productIds, randomUUID()];
      
      const beforeProducts = await prisma.products.findMany({
        where: { id: { in: productIds } },
        select: { is_active: true },
      });
      
      try {
        await bulkOperationsService.bulkUpdate(
          invalidIds,
          { is_active: false },
          TENANT_ID,
          'test-user-id'
        );
      } catch (error) {
        // Expected to fail
      }
      
      const afterProducts = await prisma.products.findMany({
        where: { id: { in: productIds } },
        select: { is_active: true },
      });
      
      // Verify no products were updated (transaction rolled back)
      const noChanges = afterProducts.every((after, index) => 
        after.is_active === beforeProducts[index].is_active
      );
      
      if (noChanges) {
        logTest('Database', testName, true, undefined, Date.now() - startTime);
      } else {
        throw new Error('Transaction not atomic - partial updates occurred');
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Database', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

async function testPerformance() {
  console.log('\n⚡ PERFORMANCE TESTS\n');
  
  const token = await getAuthToken();
  
  // Test 1: Performance - 50 products
  {
    const testName = 'Performance - 50 products (<3s)';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(50, 'PERF-50');
      
      const opStart = Date.now();
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          updates: { is_active: false },
        }),
      });
      
      const duration = Date.now() - opStart;
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 50 && duration < 3000) {
        logTest('Performance', testName, true, undefined, duration);
      } else {
        throw new Error(`Duration ${duration}ms (expected <3000ms)`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Performance', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: Performance - 100 products
  {
    const testName = 'Performance - 100 products (<5s)';
    const startTime = Date.now();
    try {
      const productIds = await createTestProducts(100, 'PERF-100');
      
      const opStart = Date.now();
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: productIds,
          updates: { is_active: false },
        }),
      });
      
      const duration = Date.now() - opStart;
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 100 && duration < 5000) {
        logTest('Performance', testName, true, undefined, duration);
      } else {
        throw new Error(`Duration ${duration}ms (expected <5000ms)`);
      }
      
      await cleanupTestProducts(productIds);
    } catch (error) {
      logTest('Performance', testName, false, error instanceof Error ? error.message : String(error));
    }
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n🧪 COMPREHENSIVE TASK 8 TESTING\n');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    await testBackendService();
    await testAPI();
    await testDatabase();
    await testPerformance();
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');
  
  const byCategory: Record<string, { passed: number; failed: number }> = {};
  
  results.forEach(r => {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { passed: 0, failed: 0 };
    }
    if (r.passed) {
      byCategory[r.category].passed++;
    } else {
      byCategory[r.category].failed++;
    }
  });
  
  Object.entries(byCategory).forEach(([category, stats]) => {
    const total = stats.passed + stats.failed;
    const percentage = ((stats.passed / total) * 100).toFixed(0);
    console.log(`${category}: ${stats.passed}/${total} passed (${percentage}%)`);
  });
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(0);
  
  console.log(`\nTotal: ${totalPassed}/${totalTests} passed (${totalPercentage}%)`);
  console.log(`⏱️  Duration: ${totalDuration}ms`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.category}: ${r.name}`);
      if (r.error) {
        console.log(`    ${r.error}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (totalFailed === 0) {
    console.log('\n✅ ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${totalFailed} TEST(S) FAILED\n`);
    process.exit(1);
  }
}

runAllTests();
