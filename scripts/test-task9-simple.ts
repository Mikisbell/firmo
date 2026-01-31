/**
 * Task 9 Simple Integration Tests
 * Pruebas básicas de la UI de bulk operations
 */

const BASE_URL = 'http://localhost:3002';
const ADMIN_PIN = '1234';
const TENANT_ID = 'park-pos-tenant-001';

let authCookie: string | null = null;
let testProductIds: string[] = [];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const status = passed ? '✅' : '❌';
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.log(`${status} ${name}${durationStr}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

/**
 * Get auth token
 */
async function getAuthToken(): Promise<string> {
  if (authCookie) return authCookie;

  const response = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      pin: ADMIN_PIN,
      allowedRoles: ['OWNER', 'ADMIN', 'MANAGER']
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Login failed: ${response.status} - ${errorData.error || response.statusText}`);
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    const match = setCookie.match(/auth_token=([^;]+)/);
    if (match) {
      authCookie = match[1];
      return authCookie;
    }
  }

  throw new Error('Login failed: No auth cookie in response');
}

/**
 * Create test products
 */
async function createTestProducts(count: number, prefix: string, token: string): Promise<string[]> {
  const ids: string[] = [];
  const timestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    const product = {
      sku: `${prefix}-${timestamp}-${i}`,
      name: `Test Product ${prefix} ${i}`,
      price_cents: 1000 + i * 100,
      category: 'POLLOS',
      station: 'PARRILLA',
      type: 'SIMPLE',
      is_active: true,
    };
    
    const response = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${token}`,
      },
      body: JSON.stringify(product),
    });
    
    if (response.ok) {
      const created = await response.json();
      ids.push(created.id);
    }
  }
  
  return ids;
}

/**
 * Cleanup test products
 */
async function cleanupTestProducts(productIds: string[], token: string) {
  for (const id of productIds) {
    try {
      await fetch(`${BASE_URL}/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { 'Cookie': `auth_token=${token}` },
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get product by ID
 */
async function getProduct(id: string, token: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/admin/products/${id}`, {
    headers: { 'Cookie': `auth_token=${token}` },
  });
  return response.json();
}

// ============================================================================
// TESTS
// ============================================================================

async function runTests() {
  console.log('\n🧪 TASK 9 SIMPLE INTEGRATION TESTS\n');
  console.log('='.repeat(60));
  console.log('');
  
  const startTime = Date.now();
  const token = await getAuthToken();
  
  // Test 1: Bulk Activate
  {
    const testName = 'Bulk Activate (5 products)';
    const start = Date.now();
    try {
      const ids = await createTestProducts(5, 'BULK-ACT', token);
      testProductIds.push(...ids);
      
      // Deactivate first
      await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { is_active: false },
        }),
      });
      
      // Now activate
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { is_active: true },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        // Verify one product
        const product = await getProduct(ids[0], token);
        if (product.is_active === true) {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Product not activated in database');
        }
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: Bulk Category Change
  {
    const testName = 'Bulk Category Change (5 products)';
    const start = Date.now();
    try {
      const ids = await createTestProducts(5, 'BULK-CAT', token);
      testProductIds.push(...ids);
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { category: 'BEBIDAS' },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        // Verify one product
        const product = await getProduct(ids[0], token);
        if (product.category === 'BEBIDAS') {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Product category not updated in database');
        }
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 3: Bulk Station Change
  {
    const testName = 'Bulk Station Change (5 products)';
    const start = Date.now();
    try {
      const ids = await createTestProducts(5, 'BULK-STA', token);
      testProductIds.push(...ids);
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { station: 'BAR' },
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        // Verify one product
        const product = await getProduct(ids[0], token);
        if (product.station === 'BAR') {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Product station not updated in database');
        }
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 4: Bulk Delete (Soft Delete)
  {
    const testName = 'Bulk Delete / Soft Delete (5 products)';
    const start = Date.now();
    try {
      const ids = await createTestProducts(5, 'BULK-DEL', token);
      testProductIds.push(...ids);
      
      const response = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          operation: 'delete',
        }),
      });
      
      const result = await response.json();
      
      if (response.status === 200 && result.success_count === 5) {
        // Verify one product is soft deleted
        const product = await getProduct(ids[0], token);
        if (product.is_active === false) {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Product not soft deleted in database');
        }
      } else {
        throw new Error(`Status ${response.status}, success ${result.success_count}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 5: Multiple Operations in Sequence
  {
    const testName = 'Multiple Operations in Sequence';
    const start = Date.now();
    try {
      const ids = await createTestProducts(3, 'BULK-SEQ', token);
      testProductIds.push(...ids);
      
      // Operation 1: Change category
      await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { category: 'EXTRAS' },
        }),
      });
      
      // Operation 2: Change station
      await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { station: 'COCINA' },
        }),
      });
      
      // Operation 3: Deactivate
      await fetch(`${BASE_URL}/api/admin/products/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token}`,
        },
        body: JSON.stringify({
          product_ids: ids,
          updates: { is_active: false },
        }),
      });
      
      // Verify final state
      const product = await getProduct(ids[0], token);
      if (
        product.category === 'EXTRAS' &&
        product.station === 'COCINA' &&
        product.is_active === false
      ) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error('Final state incorrect after multiple operations');
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 6: Error Handling - Empty Array
  {
    const testName = 'Error Handling - Empty Product Array';
    const start = Date.now();
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
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 400, got ${response.status}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 7: Products List Endpoint
  {
    const testName = 'Products List Endpoint (Frontend Data Source)';
    const start = Date.now();
    try {
      const response = await fetch(`${BASE_URL}/api/admin/products`, {
        headers: { 'Cookie': `auth_token=${token}` },
      });
      
      if (response.status === 200) {
        const data = await response.json();
        const products = Array.isArray(data) ? data : data.items || data.data || [];
        
        if (products.length >= 0) {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        throw new Error(`Status ${response.status}`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test products...');
  await cleanupTestProducts(testProductIds, token);
  
  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(0);
  
  console.log(`Total: ${totalPassed}/${totalTests} passed (${totalPercentage}%)`);
  console.log(`⏱️  Duration: ${totalDuration}ms`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
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

runTests().catch((error) => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
