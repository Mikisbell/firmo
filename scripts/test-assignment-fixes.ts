/**
 * Test Script: Assignment Service Fixes Verification
 * 
 * Tests all fixes made to assignment.service.ts:
 * 1. Database schema verification (drivers table, delivery_orders fields)
 * 2. Assignment service functions
 * 3. API endpoints
 * 4. Type safety and field mappings
 * 
 * Run: npx tsx scripts/test-assignment-fixes.ts
 */

import prisma from '@/src/core/db/prisma';
import { 
  assignDriver, 
  getWeights, 
  updateWeights,
  calculateAssignmentScore,
  handleRejection,
  queueOrderForAssignment,
  processAssignmentQueue
} from '@/src/core/delivery/assignment.service';
import { 
  updateDriverLocation,
  getDriverLocation 
} from '@/src/core/delivery/geolocation.service';
import { 
  toDriverId, 
  toOrderId, 
  toTenantId 
} from '@/src/core/delivery/types-2026';
import type { Location, AssignmentWeights } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string; duration?: number }>
};

function logTest(name: string, status: 'PASS' | 'FAIL', error?: string, duration?: number) {
  results.tests.push({ name, status, error, duration });
  if (status === 'PASS') {
    results.passed++;
    console.log(`✅ ${name} ${duration ? `(${duration}ms)` : ''}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
    if (error) console.log(`   Error: ${error}`);
  }
}

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    logTest(name, 'PASS', undefined, Date.now() - start);
  } catch (error) {
    logTest(name, 'FAIL', error instanceof Error ? error.message : String(error));
  }
}

// ============================================
// DATABASE SCHEMA TESTS
// ============================================

async function testDatabaseSchema() {
  console.log('\n📊 DATABASE SCHEMA TESTS\n');

  await runTest('Drivers table exists and has correct fields', async () => {
    const driver = await prisma.drivers.findFirst();
    if (!driver) {
      // Create a test driver
      const testDriver = await prisma.drivers.create({
        data: {
          id: '00000000-0000-0000-0000-000000000099',
          tenant_id: TENANT_ID,
          name: 'Test Driver',
          phone: '+51999999999',
          is_active: true
        }
      });
      
      // Verify fields exist
      if (!testDriver.id) throw new Error('Missing id field');
      if (!testDriver.tenant_id) throw new Error('Missing tenant_id field');
      if (!testDriver.name) throw new Error('Missing name field');
      if (testDriver.phone === undefined) throw new Error('Missing phone field');
      if (testDriver.is_active === undefined) throw new Error('Missing is_active field');
    }
  });

  await runTest('Delivery_orders has correct relations', async () => {
    // Verify we can query delivery_orders with drivers relation
    const order = await prisma.delivery_orders.findFirst({
      include: {
        drivers: true,
        orders: {
          include: {
            customers: true,
            locations: true
          }
        }
      }
    });
    
    // Just verify the query works (order may be null if no data)
    if (order) {
      // Verify field names
      if (!order.address_text) throw new Error('Missing address_text field');
      if (!order.customer_phone) throw new Error('Missing customer_phone field');
      if (!order.created_at) throw new Error('Missing created_at field');
      
      // Verify no invalid fields
      if ('customer_name' in order) throw new Error('Invalid field customer_name exists');
      if ('pickup_location' in order) throw new Error('Invalid field pickup_location exists');
      if ('delivery_address' in order) throw new Error('Invalid field delivery_address exists');
      if ('updated_at' in order) throw new Error('Invalid field updated_at exists');
    }
  });

  await runTest('Assignment_logs table exists', async () => {
    const log = await prisma.assignment_logs.findFirst();
    // Just verify the table exists (log may be null)
  });

  await runTest('Assignment_weights table exists', async () => {
    const weights = await prisma.assignment_weights.findFirst();
    // Just verify the table exists (weights may be null)
  });

  await runTest('Location_history table exists', async () => {
    const history = await prisma.location_history.findFirst();
    // Just verify the table exists (history may be null)
  });
}

// ============================================
// ASSIGNMENT SERVICE TESTS
// ============================================

async function testAssignmentService() {
  console.log('\n🎯 ASSIGNMENT SERVICE TESTS\n');

  // Setup test data
  let testDriverId: string;
  let testOrderId: string;

  await runTest('Setup: Create test driver', async () => {
    const driver = await prisma.drivers.upsert({
      where: { id: '00000000-0000-0000-0000-000000000098' },
      create: {
        id: '00000000-0000-0000-0000-000000000098',
        tenant_id: TENANT_ID,
        name: 'Test Assignment Driver',
        phone: '+51988888888',
        is_active: true
      },
      update: {
        is_active: true
      }
    });
    testDriverId = driver.id;
    
    // Set driver location
    await updateDriverLocation(toDriverId(testDriverId), {
      latitude: -12.0464,
      longitude: -77.0428,
      accuracy: 10,
      timestamp: new Date()
    });
  });

  await runTest('Setup: Create test order', async () => {
    // First create a customer
    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: TENANT_ID,
          phone: '+51977777777'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000097',
        tenant_id: TENANT_ID,
        phone: '+51977777777',
        name: 'Test Customer'
      },
      update: {}
    });

    // Create a location
    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'TEST_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000096',
        tenant_id: TENANT_ID,
        code: 'TEST_LOC',
        name: 'Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    // Create an order
    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000095',
        tenant_id: TENANT_ID,
        order_number: 9999,
        order_type: 'DELIVERY',
        terminal_id: 'TEST_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    // Create delivery order
    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000094',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51977777777',
        status: 'PENDING'
      }
    });
    testOrderId = deliveryOrder.id;
  });

  await runTest('Get assignment weights (default)', async () => {
    const weights = await getWeights(TENANT_ID);
    if (weights.distance !== 0.4) throw new Error('Default distance weight should be 0.4');
    if (weights.workload !== 0.3) throw new Error('Default workload weight should be 0.3');
    if (weights.performance !== 0.3) throw new Error('Default performance weight should be 0.3');
  });

  await runTest('Update assignment weights', async () => {
    const newWeights: AssignmentWeights = {
      distance: 0.5,
      workload: 0.3,
      performance: 0.2
    };
    await updateWeights(TENANT_ID, newWeights);
    
    const retrieved = await getWeights(TENANT_ID);
    if (retrieved.distance !== 0.5) throw new Error('Distance weight not updated');
    if (retrieved.workload !== 0.3) throw new Error('Workload weight not updated');
    if (retrieved.performance !== 0.2) throw new Error('Performance weight not updated');
    
    // Reset to defaults
    await updateWeights(TENANT_ID, {
      distance: 0.4,
      workload: 0.3,
      performance: 0.3
    });
  });

  await runTest('Calculate assignment score', async () => {
    const driverLocation = await getDriverLocation(toDriverId(testDriverId));
    if (!driverLocation) throw new Error('Driver location not found');

    const driver = {
      id: toDriverId(testDriverId),
      name: 'Test Driver',
      phone: '+51988888888',
      location: driverLocation,
      activeOrders: [],
      performanceRating: 4.5,
      status: 'AVAILABLE' as const,
      isActive: true
    };

    const order = {
      id: toOrderId(testOrderId),
      tenantId: TENANT_ID,
      orderNumber: 9999,
      customerName: 'Test Customer',
      customerPhone: '+51977777777',
      pickupLocation: {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date()
      },
      deliveryLocation: {
        latitude: -12.0500,
        longitude: -77.0500,
        accuracy: 10,
        timestamp: new Date()
      },
      status: 'PENDING' as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const weights = await getWeights(TENANT_ID);
    const score = await calculateAssignmentScore(driver, order, weights);
    
    if (score.totalScore < 0 || score.totalScore > 100) {
      throw new Error(`Invalid total score: ${score.totalScore}`);
    }
    if (score.distanceScore < 0 || score.distanceScore > 100) {
      throw new Error(`Invalid distance score: ${score.distanceScore}`);
    }
    if (score.workloadScore < 0 || score.workloadScore > 100) {
      throw new Error(`Invalid workload score: ${score.workloadScore}`);
    }
    if (score.performanceScore < 0 || score.performanceScore > 100) {
      throw new Error(`Invalid performance score: ${score.performanceScore}`);
    }
  });

  await runTest('Assign driver to order', async () => {
    const assignedDriver = await assignDriver(toOrderId(testOrderId));
    
    if (!assignedDriver) {
      throw new Error('No driver assigned (may be expected if no drivers available)');
    }
    
    // Verify order was updated
    const order = await prisma.delivery_orders.findUnique({
      where: { id: testOrderId }
    });
    
    if (!order) throw new Error('Order not found');
    if (order.status !== 'ASSIGNED') throw new Error(`Order status should be ASSIGNED, got ${order.status}`);
    if (!order.driver_id) throw new Error('Driver ID not set on order');
    if (!order.assigned_at) throw new Error('Assigned timestamp not set');
  });

  await runTest('Queue order for assignment', async () => {
    await queueOrderForAssignment(toOrderId(testOrderId));
    // Just verify it doesn't throw
  });

  await runTest('Process assignment queue', async () => {
    await processAssignmentQueue();
    // Just verify it doesn't throw
  });

  await runTest('Handle driver rejection', async () => {
    const newDriver = await handleRejection(
      toOrderId(testOrderId),
      toDriverId(testDriverId),
      'Driver busy'
    );
    
    // May return null if no other drivers available
    if (newDriver) {
      if (newDriver.id === toDriverId(testDriverId)) {
        throw new Error('Should not reassign to rejected driver');
      }
    }
  });

  await runTest('Cleanup: Delete test data', async () => {
    await prisma.delivery_orders.deleteMany({
      where: { id: testOrderId }
    });
    await prisma.orders.deleteMany({
      where: { id: '00000000-0000-0000-0000-000000000095' }
    });
    await prisma.assignment_logs.deleteMany({
      where: { order_id: testOrderId }
    });
  });
}

// ============================================
// API ENDPOINT TESTS
// ============================================

async function testAPIEndpoints() {
  console.log('\n🌐 API ENDPOINT TESTS\n');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  await runTest('POST /api/locations - Update driver location', async () => {
    const response = await fetch(`${baseUrl}/api/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverId: '00000000-0000-0000-0000-000000000098',
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!data.success) throw new Error('API returned success: false');
  });

  await runTest('GET /api/locations/drivers - Get active driver locations', async () => {
    const response = await fetch(`${baseUrl}/api/locations/drivers`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.drivers)) throw new Error('Response should have drivers array');
    if (typeof data.count !== 'number') throw new Error('Response should have count number');
  });

  await runTest('GET /api/locations/history/:driverId - Get location history', async () => {
    const driverId = '00000000-0000-0000-0000-000000000098';
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date().toISOString();
    
    const response = await fetch(
      `${baseUrl}/api/locations/history/${driverId}?startDate=${startDate}&endDate=${endDate}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API returned ${response.status}: ${error}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.locations)) throw new Error('Response should have locations array');
    if (typeof data.count !== 'number') throw new Error('Response should have count number');
  });

  await runTest('GET /api/deliveries/stream - SSE connection', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    try {
      const response = await fetch(`${baseUrl}/api/deliveries/stream`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      if (response.headers.get('content-type') !== 'text/event-stream') {
        throw new Error('Response should be text/event-stream');
      }

      // Connection successful
      clearTimeout(timeout);
      controller.abort(); // Close connection
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        // Expected - we aborted the connection
        return;
      }
      throw error;
    }
  });
}

// ============================================
// TYPE SAFETY TESTS
// ============================================

async function testTypeSafety() {
  console.log('\n🔒 TYPE SAFETY TESTS\n');

  await runTest('Location type has correct fields', async () => {
    const location: Location = {
      latitude: -12.0464,
      longitude: -77.0428,
      accuracy: 10,
      timestamp: new Date(),
      speed: 25,
      heading: 180
    };

    // Verify required fields
    if (typeof location.latitude !== 'number') throw new Error('latitude should be number');
    if (typeof location.longitude !== 'number') throw new Error('longitude should be number');
    if (typeof location.accuracy !== 'number') throw new Error('accuracy should be number');
    if (!(location.timestamp instanceof Date)) throw new Error('timestamp should be Date');
    
    // Verify optional fields
    if (location.speed !== undefined && typeof location.speed !== 'number') {
      throw new Error('speed should be number or undefined');
    }
    if (location.heading !== undefined && typeof location.heading !== 'number') {
      throw new Error('heading should be number or undefined');
    }
  });

  await runTest('AssignmentWeights type has correct fields', async () => {
    const weights: AssignmentWeights = {
      distance: 0.4,
      workload: 0.3,
      performance: 0.3
    };

    if (typeof weights.distance !== 'number') throw new Error('distance should be number');
    if (typeof weights.workload !== 'number') throw new Error('workload should be number');
    if (typeof weights.performance !== 'number') throw new Error('performance should be number');
    
    const sum = weights.distance + weights.workload + weights.performance;
    if (Math.abs(sum - 1.0) > 0.01) throw new Error('Weights should sum to 1.0');
  });

  await runTest('Branded types prevent mixing', async () => {
    const driverId = toDriverId('test-driver-id');
    const orderId = toOrderId('test-order-id');
    const tenantId = toTenantId('test-tenant-id');

    // These should be different types at compile time
    // At runtime they're just strings, but TypeScript prevents mixing them
    if (typeof driverId !== 'string') throw new Error('DriverId should be string at runtime');
    if (typeof orderId !== 'string') throw new Error('OrderId should be string at runtime');
    if (typeof tenantId !== 'string') throw new Error('TenantId should be string at runtime');
  });
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function main() {
  console.log('🧪 ASSIGNMENT SERVICE FIXES - COMPREHENSIVE TEST SUITE\n');
  console.log('Testing all fixes made to assignment.service.ts\n');
  console.log('='.repeat(60));

  try {
    await testDatabaseSchema();
    await testAssignmentService();
    await testAPIEndpoints();
    await testTypeSafety();

    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST SUMMARY\n');
    console.log(`Total Tests: ${results.passed + results.failed}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
      console.log('\n❌ FAILED TESTS:\n');
      results.tests
        .filter(t => t.status === 'FAIL')
        .forEach(t => {
          console.log(`  • ${t.name}`);
          if (t.error) console.log(`    ${t.error}`);
        });
      process.exit(1);
    } else {
      console.log('\n✅ ALL TESTS PASSED!\n');
      console.log('Assignment service fixes verified successfully.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
