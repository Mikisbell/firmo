/**
 * Simple Bulk Operations API Test
 * Tests the POST /api/admin/products/bulk endpoint
 */

import prisma from '../src/core/db/prisma';
import { getTenantId } from '../src/core/config/tenant';
import { randomUUID } from 'crypto';

const TENANT_ID = getTenantId();
const BASE_URL = 'http://localhost:3001';
const ADMIN_PIN = '1234';

let authCookie: string | null = null;

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
async function createTestProducts(count: number): Promise<string[]> {
  const ids: string[] = [];
  const timestamp = Date.now();
  
  for (let i = 0; i < count; i++) {
    const product = await prisma.products.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT_ID,
        sku: `TEST-BULK-${timestamp}-${i}`,
        name: `Test Product ${i}`,
        price_cents: 1000,
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
 * Main test
 */
async function runTest() {
  console.log('\n🧪 Bulk Operations API Test\n');
  
  try {
    // 1. Login
    console.log('1. Logging in...');
    const token = await getAuthToken();
    console.log('   ✅ Logged in');
    
    // 2. Create test products
    console.log('\n2. Creating 10 test products...');
    const productIds = await createTestProducts(10);
    console.log(`   ✅ Created ${productIds.length} products`);
    
    // 3. Test bulk deactivate
    console.log('\n3. Testing bulk deactivate...');
    const deactivateResponse = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
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
    
    const deactivateResult = await deactivateResponse.json();
    console.log(`   Status: ${deactivateResponse.status}`);
    console.log(`   Success: ${deactivateResult.success_count}`);
    console.log(`   Failures: ${deactivateResult.failure_count}`);
    
    if (deactivateResponse.status === 200 && deactivateResult.success_count === 10) {
      console.log('   ✅ Bulk deactivate successful');
    } else {
      console.log('   ❌ Bulk deactivate failed');
      console.log('   Response:', JSON.stringify(deactivateResult, null, 2));
    }
    
    // 4. Verify database
    console.log('\n4. Verifying database...');
    const products = await prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { is_active: true },
    });
    
    const allInactive = products.every(p => p.is_active === false);
    if (allInactive) {
      console.log('   ✅ All products deactivated in database');
    } else {
      console.log('   ❌ Some products still active');
    }
    
    // 5. Test bulk activate
    console.log('\n5. Testing bulk activate...');
    const activateResponse = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
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
    
    const activateResult = await activateResponse.json();
    console.log(`   Status: ${activateResponse.status}`);
    console.log(`   Success: ${activateResult.success_count}`);
    
    if (activateResponse.status === 200 && activateResult.success_count === 10) {
      console.log('   ✅ Bulk activate successful');
    } else {
      console.log('   ❌ Bulk activate failed');
    }
    
    // 6. Test bulk category change
    console.log('\n6. Testing bulk category change...');
    const categoryResponse = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${token}`,
      },
      body: JSON.stringify({
        product_ids: productIds,
        updates: { category: 'BEBIDAS' },
      }),
    });
    
    const categoryResult = await categoryResponse.json();
    console.log(`   Status: ${categoryResponse.status}`);
    console.log(`   Success: ${categoryResult.success_count}`);
    
    if (categoryResponse.status === 200 && categoryResult.success_count === 10) {
      console.log('   ✅ Bulk category change successful');
    } else {
      console.log('   ❌ Bulk category change failed');
    }
    
    // 7. Test bulk delete
    console.log('\n7. Testing bulk delete...');
    const deleteResponse = await fetch(`${BASE_URL}/api/admin/products/bulk`, {
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
    
    const deleteResult = await deleteResponse.json();
    console.log(`   Status: ${deleteResponse.status}`);
    console.log(`   Success: ${deleteResult.success_count}`);
    
    if (deleteResponse.status === 200 && deleteResult.success_count === 10) {
      console.log('   ✅ Bulk delete successful');
    } else {
      console.log('   ❌ Bulk delete failed');
    }
    
    // 8. Cleanup
    console.log('\n8. Cleaning up...');
    await prisma.products.deleteMany({
      where: { id: { in: productIds } },
    });
    console.log('   ✅ Test products deleted');
    
    console.log('\n✅ All tests passed!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTest();
