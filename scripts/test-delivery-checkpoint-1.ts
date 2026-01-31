/**
 * Checkpoint 1: Core Infrastructure Complete
 * 
 * This script verifies that Tasks 1-3 are complete and working:
 * - Task 1: Infrastructure (Redis, Prisma, Types, Arbitraries)
 * - Task 2: SSE Service (Connection Manager, Broadcaster, API)
 * - Task 3: Geolocation Service (Location storage, queries, history)
 */

import { PrismaClient } from '@prisma/client';
import { RedisConnection } from '../src/core/delivery/redis-connection';
import { SSEConnectionManager } from '../src/core/delivery/sse-connection-manager';
import { SSEBroadcaster } from '../src/core/delivery/sse-broadcaster';
import {
  updateDriverLocation,
  getDriverLocation,
  getActiveDriverLocations,
  getLocationHistory,
  validateCoordinates
} from '../src/core/delivery/geolocation.service';
import type { Location, DeliveryEvent, DriverId } from '../src/core/delivery/types-2026';

const prisma = new PrismaClient();
const redis = new RedisConnection();

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

async function testRedisConnection() {
  const start = Date.now();
  try {
    await redis.setex('test:checkpoint', 10, 'hello');
    const value = await redis.get('test:checkpoint');
    if (value !== 'hello') {
      throw new Error(`Expected 'hello', got '${value}'`);
    }
    await redis.del('test:checkpoint');
    logTest('Redis Connection', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Redis Connection', false, error instanceof Error ? error.message : String(error));
  }
}

async function testRedisPubSub() {
  const start = Date.now();
  try {
    let received = false;
    const channel = 'test:checkpoint:pubsub';
    
    await redis.subscribe(channel, (message) => {
      if (message === 'test-message') {
        received = true;
      }
    });
    
    await redis.publish(channel, 'test-message');
    
    // Wait for message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await redis.unsubscribe(channel);
    
    if (!received) {
      throw new Error('Message not received');
    }
    
    logTest('Redis Pub/Sub', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Redis Pub/Sub', false, error instanceof Error ? error.message : String(error));
  }
}

async function testDatabaseTables() {
  const start = Date.now();
  try {
    // Check all new tables exist
    const tables = [
      'location_history',
      'whatsapp_messages',
      'assignment_weights',
      'assignment_logs',
      'eta_predictions',
      'delivery_metrics'
    ];
    
    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
      );
      const exists = (result as any)[0].exists;
      if (!exists) {
        throw new Error(`Table ${table} does not exist`);
      }
    }
    
    logTest('Database Tables', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Database Tables', false, error instanceof Error ? error.message : String(error));
  }
}

async function testSSEConnectionManager() {
  const start = Date.now();
  try {
    const manager = new SSEConnectionManager(redis);
    
    // Mock response object
    const mockResponse = {
      write: () => {},
      end: () => {}
    } as any;
    
    // Add client
    await manager.addClient('test-client-1', mockResponse, { restaurantId: 'test-restaurant' });
    
    // Check active clients
    const clients = await manager.getActiveClients();
    if (clients.length !== 1) {
      throw new Error(`Expected 1 client, got ${clients.length}`);
    }
    
    // Remove client
    await manager.removeClient('test-client-1');
    
    const clientsAfter = await manager.getActiveClients();
    if (clientsAfter.length !== 0) {
      throw new Error(`Expected 0 clients, got ${clientsAfter.length}`);
    }
    
    logTest('SSE Connection Manager', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('SSE Connection Manager', false, error instanceof Error ? error.message : String(error));
  }
}

async function testSSEBroadcaster() {
  const start = Date.now();
  try {
    const manager = new SSEConnectionManager(redis);
    const broadcaster = new SSEBroadcaster(redis, manager);
    
    // Mock response object
    const mockResponse = {
      write: () => {},
      end: () => {}
    } as any;
    
    // Add client
    await manager.addClient('test-client-2', mockResponse, { restaurantId: 'test-restaurant' });
    
    // Broadcast event
    const event: DeliveryEvent = {
      id: 'test-event-1',
      type: 'order_created',
      timestamp: new Date(),
      data: { orderId: 'test-order-1' },
      restaurantId: 'test-restaurant'
    };
    
    await broadcaster.broadcast(event);
    
    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Cleanup
    await manager.removeClient('test-client-2');
    
    logTest('SSE Broadcaster', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('SSE Broadcaster', false, error instanceof Error ? error.message : String(error));
  }
}

async function testSSEEndpoint() {
  const start = Date.now();
  try {
    // Test that the endpoint exists and returns correct headers
    const response = await fetch('http://localhost:3001/api/deliveries/stream', {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      throw new Error(`Expected text/event-stream, got ${contentType}`);
    }
    
    // Close the connection
    response.body?.cancel();
    
    logTest('SSE API Endpoint', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('SSE API Endpoint', false, error instanceof Error ? error.message : String(error));
  }
}

async function testGeolocationService() {
  const start = Date.now();
  try {
    const testLocation: Location = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10,
      timestamp: new Date(),
      speed: 25,
      heading: 180
    };
    
    // Update location
    await updateDriverLocation('test-driver-1' as DriverId, testLocation);
    
    // Get location
    const location = await getDriverLocation('test-driver-1' as DriverId);
    if (!location) {
      throw new Error('Location not found');
    }
    
    if (location.latitude !== testLocation.latitude) {
      throw new Error(`Expected latitude ${testLocation.latitude}, got ${location.latitude}`);
    }
    
    // Get active locations
    const activeLocations = await getActiveDriverLocations();
    if (activeLocations.size === 0) {
      throw new Error('No active locations found');
    }
    
    // Cleanup
    await redis.del('driver:test-driver-1:location');
    
    logTest('Geolocation Service', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Geolocation Service', false, error instanceof Error ? error.message : String(error));
  }
}

async function testLocationHistory() {
  const start = Date.now();
  try {
    // Create test driver if not exists
    const driver = await prisma.employees.findFirst({
      where: { role: 'DRIVER' }
    });
    
    if (!driver) {
      throw new Error('No driver found in database. Run seed script first.');
    }
    
    const testLocation: Location = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10,
      timestamp: new Date(),
      speed: 25,
      heading: 180
    };
    
    // Update location (should trigger history insert)
    await updateDriverLocation(driver.id as DriverId, testLocation);
    
    // Wait for async insert
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get history
    const history = await getLocationHistory(
      driver.id as DriverId,
      new Date(Date.now() - 3600000), // 1 hour ago
      new Date()
    );
    
    if (history.length === 0) {
      throw new Error('No location history found');
    }
    
    logTest('Location History', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Location History', false, error instanceof Error ? error.message : String(error));
  }
}

async function testLocationValidation() {
  const start = Date.now();
  try {
    // Test invalid latitude
    try {
      await updateDriverLocation('test-driver-2' as DriverId, {
        latitude: 91, // Invalid
        longitude: 0,
        accuracy: 10,
        timestamp: new Date()
      });
      throw new Error('Should have rejected invalid latitude');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('latitude')) {
        throw error;
      }
    }
    
    // Test invalid longitude
    try {
      await updateDriverLocation('test-driver-2' as DriverId, {
        latitude: 0,
        longitude: 181, // Invalid
        accuracy: 10,
        timestamp: new Date()
      });
      throw new Error('Should have rejected invalid longitude');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('longitude')) {
        throw error;
      }
    }
    
    logTest('Location Validation', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Location Validation', false, error instanceof Error ? error.message : String(error));
  }
}

async function testLocationTTL() {
  const start = Date.now();
  try {
    const testLocation: Location = {
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10,
      timestamp: new Date()
    };
    
    // Update location
    await updateDriverLocation('test-driver-3' as DriverId, testLocation);
    
    // Check TTL
    const ttl = await redis.ttl('driver:test-driver-3:location');
    if (ttl <= 0 || ttl > 300) {
      throw new Error(`Expected TTL around 300 seconds, got ${ttl}`);
    }
    
    // Cleanup
    await redis.del('driver:test-driver-3:location');
    
    logTest('Location TTL', true, undefined, Date.now() - start);
  } catch (error) {
    logTest('Location TTL', false, error instanceof Error ? error.message : String(error));
  }
}

async function runAllTests() {
  console.log('\n🧪 Checkpoint 1: Core Infrastructure Complete\n');
  console.log('Testing Tasks 1-3 implementation...\n');
  
  // Task 1: Infrastructure
  console.log('📦 Task 1: Infrastructure');
  await testRedisConnection();
  await testRedisPubSub();
  await testDatabaseTables();
  
  // Task 2: SSE Service
  console.log('\n📡 Task 2: SSE Service');
  await testSSEConnectionManager();
  await testSSEBroadcaster();
  await testSSEEndpoint();
  
  // Task 3: Geolocation Service
  console.log('\n📍 Task 3: Geolocation Service');
  await testGeolocationService();
  await testLocationHistory();
  await testLocationValidation();
  await testLocationTTL();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed (${percentage}%)\n`);
  
  if (passed === total) {
    console.log('✅ Checkpoint 1 PASSED - Core Infrastructure is complete and working!');
    console.log('\nReady to proceed with Task 5: Assignment Algorithm\n');
  } else {
    console.log('❌ Checkpoint 1 FAILED - Some tests need attention\n');
    console.log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  await prisma.$disconnect();
  await redis.quit();
}

runAllTests().catch(console.error);
