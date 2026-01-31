/**
 * Comprehensive Test Script for Delivery 2026 Modernization - Tasks 1 & 2
 * 
 * Tests:
 * - Task 1: Infrastructure (Redis, Types, Arbitraries, Database)
 * - Task 2: SSE Service (Connection Manager, Broadcaster, API Endpoint)
 * 
 * Run: npx tsx scripts/test-delivery-2026-tasks-1-2.ts
 */

import { deliveryRedisService } from '../src/core/delivery/redis-connection';
import { sseConnectionManager } from '../src/core/delivery/sse-connection-manager';
import { sseBroadcaster, broadcastDeliveryEvent } from '../src/core/delivery/sse-broadcaster';
import { toDriverId, toOrderId, toTenantId } from '../src/core/delivery/types-2026';
import type { DeliveryEvent } from '../src/core/delivery/types-2026';
import prisma from '../src/core/db/prisma';

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }>
};

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ 
        name, 
        status: 'FAIL', 
        error: error instanceof Error ? error.message : String(error) 
      });
      console.log(`❌ ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

async function runTests() {
  console.log('\n🧪 DELIVERY 2026 MODERNIZATION - TASKS 1 & 2 TESTS\n');
  console.log('=' .repeat(60));
  
  // ============================================
  // TASK 1: Infrastructure Tests
  // ============================================
  console.log('\n📦 TASK 1: Infrastructure Tests\n');
  
  await test('1.1 Redis Service - Set and Get', async () => {
    const key = 'test:delivery:location';
    const value = JSON.stringify({ lat: 40.7128, lng: -74.0060 });
    
    await deliveryRedisService.setex(key, 60, value);
    const retrieved = await deliveryRedisService.get(key);
    
    if (retrieved !== value) {
      throw new Error(`Expected ${value}, got ${retrieved}`);
    }
    
    await deliveryRedisService.del(key);
  })();
  
  await test('1.2 Redis Service - TTL Expiration', async () => {
    const key = 'test:delivery:ttl';
    const value = 'test-value';
    
    await deliveryRedisService.setex(key, 1, value); // 1 second TTL
    
    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const retrieved = await deliveryRedisService.get(key);
    if (retrieved !== null) {
      throw new Error(`Expected null (expired), got ${retrieved}`);
    }
  })();
  
  await test('1.3 Redis Service - List Operations', async () => {
    const key = 'test:delivery:queue';
    
    await deliveryRedisService.rpush(key, 'item1');
    await deliveryRedisService.rpush(key, 'item2');
    
    const length = await deliveryRedisService.llen(key);
    if (length !== 2) {
      throw new Error(`Expected length 2, got ${length}`);
    }
    
    const item1 = await deliveryRedisService.lpop(key);
    if (item1 !== 'item1') {
      throw new Error(`Expected item1, got ${item1}`);
    }
    
    await deliveryRedisService.del(key);
  })();
  
  await test('1.4 Branded Types - Type Safety', () => {
    const driverId = toDriverId('driver-123');
    const orderId = toOrderId('order-456');
    const tenantId = toTenantId('tenant-789');
    
    // These should compile without errors
    const driver: { id: typeof driverId } = { id: driverId };
    const order: { id: typeof orderId } = { id: orderId };
    const tenant: { id: typeof tenantId } = { id: tenantId };
    
    if (!driver.id || !order.id || !tenant.id) {
      throw new Error('Branded types not working');
    }
  })();
  
  await test('1.5 Database - Check New Tables Exist', async () => {
    // Query each new table to verify it exists
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
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
        )`
      );
      
      const exists = (result as any)[0].exists;
      if (!exists) {
        throw new Error(`Table ${table} does not exist`);
      }
    }
  })();
  
  // ============================================
  // TASK 2: SSE Service Tests
  // ============================================
  console.log('\n📡 TASK 2: SSE Service Tests\n');
  
  await test('2.1 SSE Connection Manager - Add Client', async () => {
    const clientId = 'test-client-1';
    const mockController = {
      enqueue: () => {},
      close: () => {}
    } as any;
    
    await sseConnectionManager.addClient(clientId, mockController);
    
    const clients = sseConnectionManager.getActiveClients();
    if (!clients.includes(clientId)) {
      throw new Error(`Client ${clientId} not found in active clients`);
    }
    
    await sseConnectionManager.removeClient(clientId);
  })();
  
  await test('2.2 SSE Connection Manager - Remove Client', async () => {
    const clientId = 'test-client-2';
    const mockController = {
      enqueue: () => {},
      close: () => {}
    } as any;
    
    await sseConnectionManager.addClient(clientId, mockController);
    await sseConnectionManager.removeClient(clientId);
    
    const clients = sseConnectionManager.getActiveClients();
    if (clients.includes(clientId)) {
      throw new Error(`Client ${clientId} should have been removed`);
    }
  })();
  
  await test('2.3 SSE Connection Manager - Filter by Restaurant', async () => {
    const restaurantId = 'restaurant-123';
    const client1 = 'test-client-3';
    const client2 = 'test-client-4';
    
    const mockController = {
      enqueue: () => {},
      close: () => {}
    } as any;
    
    await sseConnectionManager.addClient(client1, mockController, restaurantId);
    await sseConnectionManager.addClient(client2, mockController, 'other-restaurant');
    
    const filtered = sseConnectionManager.getFilteredClients(restaurantId);
    
    if (filtered.length !== 1 || filtered[0].id !== client1) {
      throw new Error(`Expected 1 client for restaurant ${restaurantId}, got ${filtered.length}`);
    }
    
    await sseConnectionManager.removeClient(client1);
    await sseConnectionManager.removeClient(client2);
  })();
  
  await test('2.4 SSE Connection Manager - Statistics', async () => {
    const stats = sseConnectionManager.getStats();
    
    if (typeof stats.totalClients !== 'number') {
      throw new Error('Stats should include totalClients');
    }
    
    if (typeof stats.averageConnectionDuration !== 'number') {
      throw new Error('Stats should include averageConnectionDuration');
    }
  })();
  
  await test('2.5 SSE Broadcaster - Event ID Generation', async () => {
    const event: DeliveryEvent = {
      id: '',
      type: 'order_created',
      timestamp: new Date(),
      data: { orderId: 'test-order' }
    };
    
    // Broadcast will generate an ID if not provided
    const clientId = 'test-client-5';
    const messages: string[] = [];
    const mockController = {
      enqueue: (data: Uint8Array) => {
        messages.push(new TextDecoder().decode(data));
      },
      close: () => {}
    } as any;
    
    await sseConnectionManager.addClient(clientId, mockController);
    await sseBroadcaster.broadcast(event);
    
    // Check that event ID was generated
    if (!event.id) {
      throw new Error('Event ID should have been generated');
    }
    
    // Check that message was sent
    if (messages.length === 0) {
      throw new Error('No messages were sent');
    }
    
    await sseConnectionManager.removeClient(clientId);
  })();
  
  await test('2.6 SSE Broadcaster - Broadcast to Multiple Clients', async () => {
    const client1 = 'test-client-6';
    const client2 = 'test-client-7';
    const messages1: string[] = [];
    const messages2: string[] = [];
    
    const mockController1 = {
      enqueue: (data: Uint8Array) => {
        messages1.push(new TextDecoder().decode(data));
      },
      close: () => {}
    } as any;
    
    const mockController2 = {
      enqueue: (data: Uint8Array) => {
        messages2.push(new TextDecoder().decode(data));
      },
      close: () => {}
    } as any;
    
    await sseConnectionManager.addClient(client1, mockController1);
    await sseConnectionManager.addClient(client2, mockController2);
    
    const event: DeliveryEvent = {
      id: 'test-event-1',
      type: 'order_assigned',
      timestamp: new Date(),
      data: { orderId: 'order-123', driverId: 'driver-456' }
    };
    
    await sseBroadcaster.broadcast(event);
    
    // Both clients should receive the message
    if (messages1.length === 0 || messages2.length === 0) {
      throw new Error('Both clients should have received the message');
    }
    
    await sseConnectionManager.removeClient(client1);
    await sseConnectionManager.removeClient(client2);
  })();
  
  await test('2.7 SSE Broadcaster - Helper Function', async () => {
    const clientId = 'test-client-8';
    const restaurantId = 'restaurant-123';
    const messages: string[] = [];
    
    const mockController = {
      enqueue: (data: Uint8Array) => {
        messages.push(new TextDecoder().decode(data));
      },
      close: () => {}
    } as any;
    
    // Add client WITH restaurantId filter
    await sseConnectionManager.addClient(clientId, mockController, restaurantId);
    
    // Broadcast with SAME restaurantId
    await broadcastDeliveryEvent(
      'order_delivered',
      { orderId: 'order-789' },
      restaurantId // Match the client's restaurantId
    );
    
    if (messages.length === 0) {
      throw new Error('Message should have been sent');
    }
    
    await sseConnectionManager.removeClient(clientId);
  })();
  
  await test('2.8 SSE Broadcaster - Statistics', () => {
    const stats = sseBroadcaster.getStats();
    
    if (typeof stats.eventCounter !== 'number') {
      throw new Error('Stats should include eventCounter');
    }
    
    if (typeof stats.subscriptionActive !== 'boolean') {
      throw new Error('Stats should include subscriptionActive');
    }
  })();
  
  // ============================================
  // Results Summary
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST RESULTS SUMMARY\n');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`   - ${t.name}`);
        if (t.error) {
          console.log(`     Error: ${t.error}`);
        }
      });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
