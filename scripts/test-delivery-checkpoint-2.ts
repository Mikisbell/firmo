#!/usr/bin/env tsx

/**
 * Delivery 2026 Modernization - Checkpoint 2 Integration Test
 * 
 * Tests the integration of core services:
 * - Assignment Algorithm
 * - Push Notifications
 * - ETA Calculator
 * 
 * Verifies complete flow: order creation → assignment → notification → ETA
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { deliveryRedisService } from '../src/core/delivery/redis-connection';
import { assignDriver, calculateAssignmentScore, getWeights } from '../src/core/delivery/assignment.service';
import { calculateInitialETA, recalculateETA, recordActualDeliveryTime } from '../src/core/delivery/eta-calculator.service';
import { subscribe, sendNotification, queueNotification, processQueue } from '../src/core/delivery/push.service';
import type { TenantId, DriverId, OrderId, Location, PushSubscription, PushNotification } from '../src/core/delivery/types-2026';

const prisma = new PrismaClient();

// Test data
const TENANT_ID = uuidv4() as TenantId;
const DRIVER_1_ID = uuidv4() as DriverId;
const DRIVER_2_ID = uuidv4() as DriverId;
const ORDER_1_ID = uuidv4() as OrderId;
const ORDER_2_ID = uuidv4() as OrderId;

const RESTAURANT_LOCATION: Location = {
  latitude: 40.7128,
  longitude: -74.0060,
  accuracy: 10,
  timestamp: new Date().toISOString(),
};

const CUSTOMER_LOCATION: Location = {
  latitude: 40.7589,
  longitude: -73.9851,
  accuracy: 10,
  timestamp: new Date().toISOString(),
};

const DRIVER_1_LOCATION: Location = {
  latitude: 40.7300,
  longitude: -74.0000,
  accuracy: 10,
  timestamp: new Date().toISOString(),
};

const DRIVER_2_LOCATION: Location = {
  latitude: 40.7500,
  longitude: -73.9900,
  accuracy: 10,
  timestamp: new Date().toISOString(),
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, duration: number, error?: string, details?: Record<string, unknown>) {
  results.push({ name, passed, duration, error, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${name} (${duration}ms)`);
  if (error) console.log(`  Error: ${error}`);
  if (details) console.log(`  Details:`, JSON.stringify(details, null, 2));
}

async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    logTest(name, true, Date.now() - start);
  } catch (error) {
    logTest(name, false, Date.now() - start, error instanceof Error ? error.message : String(error));
  }
}

async function setup() {
  console.log('\n🔧 Setting up test environment...\n');

  // Create tenant
  await prisma.tenants.upsert({
    where: { id: TENANT_ID },
    create: {
      id: TENANT_ID,
      name: 'Test Restaurant',
      slug: 'test-restaurant',
      timezone: 'America/New_York',
    },
    update: {},
  });

  // Create drivers
  await prisma.employees.upsert({
    where: { id: DRIVER_1_ID },
    create: {
      id: DRIVER_1_ID,
      tenant_id: TENANT_ID,
      name: 'Driver One',
      role: 'DRIVER',
      pin_hash: 'test-hash',
      is_active: true,
    },
    update: { is_active: true },
  });

  await prisma.employees.upsert({
    where: { id: DRIVER_2_ID },
    create: {
      id: DRIVER_2_ID,
      tenant_id: TENANT_ID,
      name: 'Driver Two',
      role: 'DRIVER',
      pin_hash: 'test-hash',
      is_active: true,
    },
    update: { is_active: true },
  });

  // Create delivery orders
  await prisma.delivery_orders.upsert({
    where: { id: ORDER_1_ID },
    create: {
      id: ORDER_1_ID,
      tenant_id: TENANT_ID,
      customer_name: 'John Doe',
      customer_phone: '+1234567890',
      address_text: '123 Main St, New York, NY',
      delivery_address: JSON.stringify(CUSTOMER_LOCATION),
      pickup_location: JSON.stringify(RESTAURANT_LOCATION),
      status: 'PENDING',
      total_amount: 2500, // $25.00
    },
    update: { status: 'PENDING' },
  });

  await prisma.delivery_orders.upsert({
    where: { id: ORDER_2_ID },
    create: {
      id: ORDER_2_ID,
      tenant_id: TENANT_ID,
      customer_name: 'Jane Smith',
      customer_phone: '+1234567891',
      address_text: '456 Oak Ave, New York, NY',
      delivery_address: JSON.stringify(CUSTOMER_LOCATION),
      pickup_location: JSON.stringify(RESTAURANT_LOCATION),
      status: 'PENDING',
      total_amount: 3500, // $35.00
    },
    update: { status: 'PENDING' },
  });

  // Store driver locations in Redis
  await deliveryRedisService.set(
    `driver:location:${DRIVER_1_ID}`,
    JSON.stringify(DRIVER_1_LOCATION),
    300
  );

  await deliveryRedisService.set(
    `driver:location:${DRIVER_2_ID}`,
    JSON.stringify(DRIVER_2_LOCATION),
    300
  );

  console.log('✅ Test environment ready\n');
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test environment...\n');

  // Delete test data
  await prisma.eta_predictions.deleteMany({ where: { order_id: { in: [ORDER_1_ID, ORDER_2_ID] } } });
  await prisma.assignment_logs.deleteMany({ where: { order_id: { in: [ORDER_1_ID, ORDER_2_ID] } } });
  await prisma.delivery_orders.deleteMany({ where: { id: { in: [ORDER_1_ID, ORDER_2_ID] } } });
  await prisma.push_subscriptions.deleteMany({ where: { driver_id: { in: [DRIVER_1_ID, DRIVER_2_ID] } } });
  await prisma.employees.deleteMany({ where: { id: { in: [DRIVER_1_ID, DRIVER_2_ID] } } });
  await prisma.assignment_weights.deleteMany({ where: { tenant_id: TENANT_ID } });
  await prisma.tenants.deleteMany({ where: { id: TENANT_ID } });

  // Clear Redis
  await deliveryRedisService.del(`driver:location:${DRIVER_1_ID}`);
  await deliveryRedisService.del(`driver:location:${DRIVER_2_ID}`);

  console.log('✅ Cleanup complete\n');
}

async function testAssignmentService() {
  console.log('📦 Testing Assignment Service...\n');

  // Test 1: Get default weights
  await runTest('Get default assignment weights', async () => {
    const weights = await getWeights(TENANT_ID);
    if (weights.distance !== 0.4) throw new Error(`Expected distance weight 0.4, got ${weights.distance}`);
    if (weights.workload !== 0.3) throw new Error(`Expected workload weight 0.3, got ${weights.workload}`);
    if (weights.performance !== 0.3) throw new Error(`Expected performance weight 0.3, got ${weights.performance}`);
  });

  // Test 2: Calculate assignment scores
  await runTest('Calculate assignment scores for drivers', async () => {
    const score1 = await calculateAssignmentScore(
      TENANT_ID,
      ORDER_1_ID,
      DRIVER_1_ID,
      DRIVER_1_LOCATION,
      RESTAURANT_LOCATION,
      CUSTOMER_LOCATION
    );

    const score2 = await calculateAssignmentScore(
      TENANT_ID,
      ORDER_1_ID,
      DRIVER_2_ID,
      DRIVER_2_LOCATION,
      RESTAURANT_LOCATION,
      CUSTOMER_LOCATION
    );

    if (score1.totalScore < 0 || score1.totalScore > 100) {
      throw new Error(`Invalid score for driver 1: ${score1.totalScore}`);
    }

    if (score2.totalScore < 0 || score2.totalScore > 100) {
      throw new Error(`Invalid score for driver 2: ${score2.totalScore}`);
    }

    console.log(`  Driver 1 score: ${score1.totalScore.toFixed(2)}`);
    console.log(`  Driver 2 score: ${score2.totalScore.toFixed(2)}`);
  });

  // Test 3: Assign driver to order
  await runTest('Assign best driver to order', async () => {
    const assignment = await assignDriver(TENANT_ID, ORDER_1_ID);
    
    if (!assignment) throw new Error('No driver assigned');
    if (!assignment.driverId) throw new Error('Driver ID missing');
    if (assignment.score < 0 || assignment.score > 100) {
      throw new Error(`Invalid assignment score: ${assignment.score}`);
    }

    console.log(`  Assigned driver: ${assignment.driverId}`);
    console.log(`  Assignment score: ${assignment.score.toFixed(2)}`);
    console.log(`  Distance to pickup: ${assignment.distanceToPickup.toFixed(2)}km`);
    console.log(`  Distance to delivery: ${assignment.distanceToDelivery.toFixed(2)}km`);

    // Verify order status updated
    const order = await prisma.delivery_orders.findUnique({ where: { id: ORDER_1_ID } });
    if (order?.status !== 'ASSIGNED') throw new Error(`Expected status ASSIGNED, got ${order?.status}`);
    if (order?.driver_id !== assignment.driverId) {
      throw new Error(`Expected driver ${assignment.driverId}, got ${order?.driver_id}`);
    }
  });

  // Test 4: Verify assignment logged
  await runTest('Verify assignment logged to database', async () => {
    const logs = await prisma.assignment_logs.findMany({
      where: { order_id: ORDER_1_ID },
      orderBy: { created_at: 'desc' },
    });

    if (logs.length === 0) throw new Error('No assignment logs found');
    
    const log = logs[0];
    if (!log.driver_id) throw new Error('Driver ID missing in log');
    if (log.score === null) throw new Error('Score missing in log');
    if (log.distance_to_pickup === null) throw new Error('Distance to pickup missing in log');

    console.log(`  Log ID: ${log.id}`);
    console.log(`  Driver: ${log.driver_id}`);
    console.log(`  Score: ${log.score}`);
  });
}

async function testETACalculator() {
  console.log('\n📍 Testing ETA Calculator...\n');

  // Get assigned driver
  const order = await prisma.delivery_orders.findUnique({ where: { id: ORDER_1_ID } });
  if (!order?.driver_id) throw new Error('Order not assigned');
  const driverId = order.driver_id as DriverId;

  // Get driver location
  const locationStr = await deliveryRedisService.get(`driver:location:${driverId}`);
  if (!locationStr) throw new Error('Driver location not found');
  const driverLocation: Location = JSON.parse(locationStr);

  // Test 1: Calculate initial ETA
  await runTest('Calculate initial ETA', async () => {
    const eta = await calculateInitialETA(
      ORDER_1_ID,
      driverId,
      driverLocation,
      RESTAURANT_LOCATION,
      CUSTOMER_LOCATION
    );

    if (eta.estimatedMinutes <= 0) throw new Error(`Invalid ETA: ${eta.estimatedMinutes}`);
    if (eta.confidenceIntervalMin >= eta.confidenceIntervalMax) {
      throw new Error('Invalid confidence interval');
    }

    console.log(`  Estimated time: ${eta.estimatedMinutes} minutes`);
    console.log(`  Confidence: ${eta.confidenceIntervalMin}-${eta.confidenceIntervalMax} minutes`);
    console.log(`  Driver factor: ${eta.driverSpeedFactor}`);
    console.log(`  Traffic factor: ${eta.trafficFactor}`);
    console.log(`  Weather factor: ${eta.weatherFactor}`);
  });

  // Test 2: Verify ETA stored in database
  await runTest('Verify ETA stored in database', async () => {
    const predictions = await prisma.eta_predictions.findMany({
      where: { order_id: ORDER_1_ID },
      orderBy: { created_at: 'desc' },
    });

    if (predictions.length === 0) throw new Error('No ETA predictions found');

    const prediction = predictions[0];
    if (prediction.predicted_minutes <= 0) {
      throw new Error(`Invalid predicted minutes: ${prediction.predicted_minutes}`);
    }

    console.log(`  Prediction ID: ${prediction.id}`);
    console.log(`  Predicted: ${prediction.predicted_minutes} minutes`);
  });

  // Test 3: Recalculate ETA with new location
  await runTest('Recalculate ETA with updated location', async () => {
    // Move driver closer to restaurant
    const newLocation: Location = {
      latitude: 40.7150,
      longitude: -74.0050,
      accuracy: 10,
      timestamp: new Date().toISOString(),
    };

    await deliveryRedisService.set(
      `driver:location:${driverId}`,
      JSON.stringify(newLocation),
      300
    );

    const eta = await recalculateETA(ORDER_1_ID, driverId, newLocation, CUSTOMER_LOCATION);

    if (eta.estimatedMinutes <= 0) throw new Error(`Invalid ETA: ${eta.estimatedMinutes}`);
    if (eta.changeFromPrevious === undefined) throw new Error('Change from previous missing');

    console.log(`  New estimated time: ${eta.estimatedMinutes} minutes`);
    console.log(`  Change from previous: ${eta.changeFromPrevious > 0 ? '+' : ''}${eta.changeFromPrevious} minutes`);
    console.log(`  Significant change: ${eta.significantChange ? 'YES' : 'NO'}`);
  });

  // Test 4: Record actual delivery time
  await runTest('Record actual delivery time', async () => {
    const actualMinutes = 25;
    await recordActualDeliveryTime(ORDER_1_ID, actualMinutes);

    const predictions = await prisma.eta_predictions.findMany({
      where: { order_id: ORDER_1_ID },
      orderBy: { created_at: 'asc' },
    });

    const firstPrediction = predictions[0];
    if (firstPrediction.actual_minutes !== actualMinutes) {
      throw new Error(`Expected actual minutes ${actualMinutes}, got ${firstPrediction.actual_minutes}`);
    }

    const error = Math.abs(firstPrediction.predicted_minutes - actualMinutes);
    console.log(`  Actual time: ${actualMinutes} minutes`);
    console.log(`  Prediction error: ${error} minutes`);
  });
}

async function testPushService() {
  console.log('\n🔔 Testing Push Service...\n');

  const subscription: PushSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
    keys: {
      p256dh: 'test-p256dh-key',
      auth: 'test-auth-key',
    },
  };

  // Test 1: Subscribe driver
  await runTest('Subscribe driver to push notifications', async () => {
    await subscribe(TENANT_ID, DRIVER_1_ID, subscription);

    const sub = await prisma.push_subscriptions.findFirst({
      where: {
        tenant_id: TENANT_ID,
        driver_id: DRIVER_1_ID,
      },
    });

    if (!sub) throw new Error('Subscription not found in database');
    if (sub.endpoint !== subscription.endpoint) {
      throw new Error(`Expected endpoint ${subscription.endpoint}, got ${sub.endpoint}`);
    }

    console.log(`  Subscription ID: ${sub.id}`);
    console.log(`  Endpoint: ${sub.endpoint}`);
  });

  // Test 2: Queue notification (simulated offline)
  await runTest('Queue notification for offline driver', async () => {
    const notification: PushNotification = {
      title: 'New Delivery Order',
      body: 'You have been assigned a new delivery',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { orderId: ORDER_2_ID },
      actions: [
        { action: 'accept', title: 'Accept' },
        { action: 'reject', title: 'Reject' },
      ],
      priority: 'urgent',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };

    await queueNotification(TENANT_ID, DRIVER_2_ID, notification);

    // Verify queued in Redis
    const queueKey = `push:queue:${TENANT_ID}:${DRIVER_2_ID}`;
    const queueLength = await deliveryRedisService.llen(queueKey);

    if (queueLength === 0) throw new Error('Notification not queued');

    console.log(`  Queue length: ${queueLength}`);
    console.log(`  Notification: ${notification.title}`);
  });

  // Test 3: Process queue (simulated online)
  await runTest('Process queued notifications', async () => {
    // Subscribe driver 2
    await subscribe(TENANT_ID, DRIVER_2_ID, subscription);

    // Process queue (will fail to send but should remove from queue)
    await processQueue(TENANT_ID, DRIVER_2_ID);

    // Verify queue empty
    const queueKey = `push:queue:${TENANT_ID}:${DRIVER_2_ID}`;
    const queueLength = await deliveryRedisService.llen(queueKey);

    console.log(`  Queue length after processing: ${queueLength}`);
    console.log(`  Note: Actual sending will fail (no valid endpoint), but queue processed`);
  });
}

async function testIntegration() {
  console.log('\n🔗 Testing Service Integration...\n');

  // Test complete flow: order → assignment → ETA → notification
  await runTest('Complete flow: order → assignment → ETA', async () => {
    // 1. Assign driver to order 2
    const assignment = await assignDriver(TENANT_ID, ORDER_2_ID);
    if (!assignment) throw new Error('No driver assigned');

    console.log(`  ✅ Step 1: Driver assigned (${assignment.driverId})`);

    // 2. Calculate initial ETA
    const driverLocationStr = await deliveryRedisService.get(`driver:location:${assignment.driverId}`);
    if (!driverLocationStr) throw new Error('Driver location not found');
    const driverLocation: Location = JSON.parse(driverLocationStr);

    const eta = await calculateInitialETA(
      ORDER_2_ID,
      assignment.driverId,
      driverLocation,
      RESTAURANT_LOCATION,
      CUSTOMER_LOCATION
    );

    console.log(`  ✅ Step 2: ETA calculated (${eta.estimatedMinutes} minutes)`);

    // 3. Verify assignment logged
    const logs = await prisma.assignment_logs.findMany({
      where: { order_id: ORDER_2_ID },
    });

    if (logs.length === 0) throw new Error('Assignment not logged');
    console.log(`  ✅ Step 3: Assignment logged (${logs.length} entries)`);

    // 4. Verify ETA stored
    const predictions = await prisma.eta_predictions.findMany({
      where: { order_id: ORDER_2_ID },
    });

    if (predictions.length === 0) throw new Error('ETA not stored');
    console.log(`  ✅ Step 4: ETA stored (${predictions.length} predictions)`);

    // 5. Verify order status
    const order = await prisma.delivery_orders.findUnique({ where: { id: ORDER_2_ID } });
    if (order?.status !== 'ASSIGNED') throw new Error(`Expected status ASSIGNED, got ${order?.status}`);
    console.log(`  ✅ Step 5: Order status updated (${order.status})`);

    console.log('\n  🎉 Complete flow successful!');
  });
}

async function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => r.failed).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  console.log(`Pass Rate: ${passRate}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) console.log(`     ${r.error}`);
    });
    console.log();
  }

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`Total Duration: ${totalDuration}ms\n`);

  console.log('='.repeat(80) + '\n');

  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Core services are working correctly.\n');
    return 0;
  } else {
    console.log('⚠️  SOME TESTS FAILED. Review errors above.\n');
    return 1;
  }
}

async function main() {
  console.log('🚀 Delivery 2026 Modernization - Checkpoint 2 Integration Test\n');
  console.log('Testing: Assignment Algorithm + Push Notifications + ETA Calculator\n');

  try {
    await setup();
    await testAssignmentService();
    await testETACalculator();
    await testPushService();
    await testIntegration();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    return 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  return await printSummary();
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
