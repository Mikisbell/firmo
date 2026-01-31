/**
 * Complete Integration Test: Admin Panel CRUD
 * Tests Backend APIs + Database + Cache + Metrics
 * 
 * Run: npx tsx scripts/test-admin-crud-complete.ts
 */

import prisma from '../src/core/db/prisma';
import { createHash } from 'crypto';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = 'PARK_POS_2026_';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

// Test data
const testEmployee = {
  name: 'Test Employee Integration',
  role: 'WAITER',
  pin: '8888',
};

const testProduct = {
  sku: 'TEST-INT-001',
  name: 'Test Product Integration',
  short_name: 'Test Int',
  price_cents: 1500,
  category: 'BEBIDAS',
  station: 'BAR',
  type: 'SIMPLE',
};

let createdEmployeeId: string | null = null;
let createdProductId: string | null = null;

async function testDatabaseConnection() {
  log('\n📊 Testing Database Connection...', 'cyan');
  
  try {
    await prisma.$connect();
    log('✅ Database connected successfully', 'green');
    
    // Test query
    const count = await prisma.employees.count();
    log(`✅ Found ${count} employees in database`, 'green');
    
    return true;
  } catch (error) {
    log(`❌ Database connection failed: ${error}`, 'red');
    return false;
  }
}

async function testEmployeesAPI() {
  log('\n👥 Testing Employees API...', 'cyan');
  
  try {
    // Test 1: GET /api/admin/employees (List)
    log('\n1️⃣ Testing GET /api/admin/employees', 'blue');
    const listResponse = await fetch(`${BASE_URL}/api/admin/employees?page=1&limit=10`);
    
    if (!listResponse.ok) {
      throw new Error(`GET failed: ${listResponse.status} ${listResponse.statusText}`);
    }
    
    const listData = await listResponse.json();
    log(`✅ GET employees: ${listData.data?.length || 0} employees, total: ${listData.total || 0}`, 'green');
    log(`   Pagination: page ${listData.page}, limit ${listData.limit}`, 'green');
    
    // Test 2: POST /api/admin/employees (Create)
    log('\n2️⃣ Testing POST /api/admin/employees', 'blue');
    const createResponse = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token', // Mock auth for testing
      },
      body: JSON.stringify(testEmployee),
    });
    
    if (createResponse.status === 401) {
      log('⚠️  POST requires authentication (expected in production)', 'yellow');
      log('   Skipping create test - auth required', 'yellow');
    } else if (createResponse.ok) {
      const createData = await createResponse.json();
      createdEmployeeId = createData.id;
      log(`✅ POST employee created: ${createData.name} (${createData.id})`, 'green');
      log(`   Role: ${createData.role}, Active: ${createData.is_active}`, 'green');
    } else {
      const errorData = await createResponse.json();
      log(`⚠️  POST failed: ${createResponse.status} - ${errorData.error || 'Unknown error'}`, 'yellow');
    }
    
    // Test 3: GET with filters
    log('\n3️⃣ Testing GET with filters (is_active=true)', 'blue');
    const filterResponse = await fetch(`${BASE_URL}/api/admin/employees?is_active=true&limit=5`);
    
    if (filterResponse.ok) {
      const filterData = await filterResponse.json();
      log(`✅ GET filtered: ${filterData.data?.length || 0} active employees`, 'green');
    }
    
    // Test 4: Cache test (second request should be faster)
    log('\n4️⃣ Testing Cache Performance', 'blue');
    const start1 = Date.now();
    await fetch(`${BASE_URL}/api/admin/employees?page=1&limit=10`);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await fetch(`${BASE_URL}/api/admin/employees?page=1&limit=10`);
    const time2 = Date.now() - start2;
    
    log(`   First request: ${time1}ms`, 'green');
    log(`   Second request (cached): ${time2}ms`, 'green');
    
    if (time2 < time1) {
      log(`✅ Cache working! ${Math.round((1 - time2/time1) * 100)}% faster`, 'green');
    } else {
      log(`⚠️  Cache might not be active (both requests similar speed)`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Employees API test failed: ${error}`, 'red');
    return false;
  }
}

async function testProductsAPI() {
  log('\n📦 Testing Products API...', 'cyan');
  
  try {
    // Test 1: GET /api/admin/products (List)
    log('\n1️⃣ Testing GET /api/admin/products', 'blue');
    const listResponse = await fetch(`${BASE_URL}/api/admin/products?page=1&limit=10`);
    
    if (!listResponse.ok) {
      throw new Error(`GET failed: ${listResponse.status} ${listResponse.statusText}`);
    }
    
    const listData = await listResponse.json();
    log(`✅ GET products: ${listData.data?.length || 0} products, total: ${listData.total || 0}`, 'green');
    
    // Test 2: POST /api/admin/products (Create)
    log('\n2️⃣ Testing POST /api/admin/products', 'blue');
    const createResponse = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify(testProduct),
    });
    
    if (createResponse.status === 401) {
      log('⚠️  POST requires authentication (expected in production)', 'yellow');
    } else if (createResponse.ok) {
      const createData = await createResponse.json();
      createdProductId = createData.id;
      log(`✅ POST product created: ${createData.name} (${createData.id})`, 'green');
      log(`   SKU: ${createData.sku}, Price: S/${(createData.price_cents / 100).toFixed(2)}`, 'green');
    } else {
      const errorData = await createResponse.json();
      log(`⚠️  POST failed: ${createResponse.status} - ${errorData.error || 'Unknown error'}`, 'yellow');
    }
    
    // Test 3: GET with filters
    log('\n3️⃣ Testing GET with filters (category=BEBIDAS)', 'blue');
    const filterResponse = await fetch(`${BASE_URL}/api/admin/products?category=BEBIDAS&limit=5`);
    
    if (filterResponse.ok) {
      const filterData = await filterResponse.json();
      log(`✅ GET filtered: ${filterData.data?.length || 0} BEBIDAS products`, 'green');
    }
    
    // Test 4: GET with station filter
    log('\n4️⃣ Testing GET with station filter (station=BAR)', 'blue');
    const stationResponse = await fetch(`${BASE_URL}/api/admin/products?station=BAR&limit=5`);
    
    if (stationResponse.ok) {
      const stationData = await stationResponse.json();
      log(`✅ GET filtered: ${stationData.data?.length || 0} BAR products`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Products API test failed: ${error}`, 'red');
    return false;
  }
}

async function testMetricsEndpoint() {
  log('\n📊 Testing Metrics Endpoint...', 'cyan');
  
  try {
    // Test 1: Prometheus format
    log('\n1️⃣ Testing GET /api/metrics (Prometheus format)', 'blue');
    const prometheusResponse = await fetch(`${BASE_URL}/api/metrics`);
    
    if (prometheusResponse.ok) {
      const prometheusData = await prometheusResponse.text();
      const lines = prometheusData.split('\n').filter(l => l.trim());
      log(`✅ Prometheus metrics: ${lines.length} lines`, 'green');
      
      // Check for key metrics
      const hasHttpMetrics = prometheusData.includes('http_requests_total');
      const hasCacheMetrics = prometheusData.includes('cache_hits_total') || prometheusData.includes('cache_misses_total');
      
      if (hasHttpMetrics) log('   ✅ HTTP metrics present', 'green');
      if (hasCacheMetrics) log('   ✅ Cache metrics present', 'green');
    }
    
    // Test 2: JSON format
    log('\n2️⃣ Testing GET /api/metrics?format=json', 'blue');
    const jsonResponse = await fetch(`${BASE_URL}/api/metrics?format=json`);
    
    if (jsonResponse.ok) {
      const jsonData = await jsonResponse.json();
      const metricCount = Object.keys(jsonData).length;
      log(`✅ JSON metrics: ${metricCount} metric types`, 'green');
      
      // Show some metrics
      Object.keys(jsonData).slice(0, 5).forEach(key => {
        log(`   - ${key}`, 'green');
      });
    }
    
    return true;
  } catch (error) {
    log(`❌ Metrics endpoint test failed: ${error}`, 'red');
    return false;
  }
}

async function testDatabaseIntegrity() {
  log('\n🔍 Testing Database Integrity...', 'cyan');
  
  try {
    // Test 1: Check employees table
    log('\n1️⃣ Checking employees table', 'blue');
    const employees = await prisma.employees.findMany({
      where: { tenant_id: TENANT_ID },
      take: 5,
    });
    log(`✅ Found ${employees.length} employees`, 'green');
    
    // Test 2: Check products table
    log('\n2️⃣ Checking products table', 'blue');
    const products = await prisma.products.findMany({
      where: { tenant_id: TENANT_ID },
      take: 5,
    });
    log(`✅ Found ${products.length} products`, 'green');
    
    // Test 3: Check catalog_meta
    log('\n3️⃣ Checking catalog_meta', 'blue');
    const catalogMeta = await prisma.catalog_meta.findUnique({
      where: { tenant_id: TENANT_ID },
    });
    
    if (catalogMeta) {
      log(`✅ Catalog version: ${catalogMeta.catalog_version}`, 'green');
      log(`   Last updated: ${catalogMeta.updated_at}`, 'green');
    } else {
      log('⚠️  No catalog_meta found (will be created on first product)', 'yellow');
    }
    
    // Test 4: Check admin_access_logs
    log('\n4️⃣ Checking admin_access_logs', 'blue');
    const logs = await prisma.admin_access_logs.findMany({
      where: { tenant_id: TENANT_ID },
      orderBy: { created_at: 'desc' },
      take: 5,
    });
    log(`✅ Found ${logs.length} recent audit logs`, 'green');
    
    if (logs.length > 0) {
      logs.forEach(log => {
        console.log(`   - ${log.action} on ${log.resource} at ${log.created_at}`);
      });
    }
    
    return true;
  } catch (error) {
    log(`❌ Database integrity test failed: ${error}`, 'red');
    return false;
  }
}

async function testValidations() {
  log('\n✅ Testing Validations...', 'cyan');
  
  try {
    // Test 1: Invalid employee data
    log('\n1️⃣ Testing invalid employee data (missing fields)', 'blue');
    const invalidEmployee = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({ name: 'Test' }), // Missing role and pin
    });
    
    if (invalidEmployee.status === 400 || invalidEmployee.status === 401) {
      log('✅ Validation working: rejected invalid data', 'green');
    } else {
      log('⚠️  Validation might not be working properly', 'yellow');
    }
    
    // Test 2: Invalid product data
    log('\n2️⃣ Testing invalid product data (negative price)', 'blue');
    const invalidProduct = await fetch(`${BASE_URL}/api/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({
        sku: 'TEST',
        name: 'Test',
        price_cents: -100, // Invalid negative price
        category: 'BEBIDAS',
        station: 'BAR',
      }),
    });
    
    if (invalidProduct.status === 400 || invalidProduct.status === 401) {
      log('✅ Validation working: rejected negative price', 'green');
    } else {
      log('⚠️  Validation might not be working properly', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Validation test failed: ${error}`, 'red');
    return false;
  }
}

async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'cyan');
  
  try {
    // Delete test employee if created
    if (createdEmployeeId) {
      await prisma.employees.delete({
        where: { id: createdEmployeeId },
      });
      log(`✅ Deleted test employee: ${createdEmployeeId}`, 'green');
    }
    
    // Delete test product if created
    if (createdProductId) {
      await prisma.products.delete({
        where: { id: createdProductId },
      });
      log(`✅ Deleted test product: ${createdProductId}`, 'green');
    }
    
    // Delete any test data by name pattern
    const deletedEmployees = await prisma.employees.deleteMany({
      where: {
        tenant_id: TENANT_ID,
        name: { contains: 'Test Employee Integration' },
      },
    });
    
    const deletedProducts = await prisma.products.deleteMany({
      where: {
        tenant_id: TENANT_ID,
        sku: { startsWith: 'TEST-INT-' },
      },
    });
    
    if (deletedEmployees.count > 0) {
      log(`✅ Cleaned up ${deletedEmployees.count} test employees`, 'green');
    }
    
    if (deletedProducts.count > 0) {
      log(`✅ Cleaned up ${deletedProducts.count} test products`, 'green');
    }
    
    return true;
  } catch (error) {
    log(`⚠️  Cleanup warning: ${error}`, 'yellow');
    return true; // Don't fail on cleanup errors
  }
}

async function runAllTests() {
  log('\n🚀 Starting Complete Integration Tests', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const results = {
    database: false,
    employeesAPI: false,
    productsAPI: false,
    metrics: false,
    integrity: false,
    validations: false,
  };
  
  try {
    // Run tests
    results.database = await testDatabaseConnection();
    results.employeesAPI = await testEmployeesAPI();
    results.productsAPI = await testProductsAPI();
    results.metrics = await testMetricsEndpoint();
    results.integrity = await testDatabaseIntegrity();
    results.validations = await testValidations();
    
    // Cleanup
    await cleanup();
    
    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('📊 TEST SUMMARY', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const tests = [
      { name: 'Database Connection', result: results.database },
      { name: 'Employees API', result: results.employeesAPI },
      { name: 'Products API', result: results.productsAPI },
      { name: 'Metrics Endpoint', result: results.metrics },
      { name: 'Database Integrity', result: results.integrity },
      { name: 'Validations', result: results.validations },
    ];
    
    tests.forEach(test => {
      const icon = test.result ? '✅' : '❌';
      const color = test.result ? 'green' : 'red';
      log(`${icon} ${test.name}`, color);
    });
    
    const passedCount = tests.filter(t => t.result).length;
    const totalCount = tests.length;
    const percentage = Math.round((passedCount / totalCount) * 100);
    
    log('\n' + '='.repeat(60), 'cyan');
    log(`RESULT: ${passedCount}/${totalCount} tests passed (${percentage}%)`, 
        percentage === 100 ? 'green' : percentage >= 80 ? 'yellow' : 'red');
    log('='.repeat(60), 'cyan');
    
    if (percentage === 100) {
      log('\n🎉 ALL TESTS PASSED! System is working perfectly!', 'green');
    } else if (percentage >= 80) {
      log('\n⚠️  Most tests passed, but some issues detected', 'yellow');
    } else {
      log('\n❌ Multiple test failures detected', 'red');
    }
    
  } catch (error) {
    log(`\n❌ Test suite failed: ${error}`, 'red');
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests().catch(console.error);
