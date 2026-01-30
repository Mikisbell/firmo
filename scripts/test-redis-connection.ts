/**
 * Redis Connection Test
 * 
 * Verifica que Redis esté configurado correctamente y funcionando.
 * 
 * Usage:
 *   npx tsx scripts/test-redis-connection.ts
 */

import { deliveryRedisService } from '../src/core/delivery/redis-connection';

async function testRedis() {
  console.log('🧪 REDIS CONNECTION TEST\n');
  console.log('============================================================\n');
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Check connection type
    const type = deliveryRedisService.getType();
    const isAvailable = deliveryRedisService.isAvailable();
    
    console.log(`📊 Connection Info:`);
    console.log(`   Type: ${type}`);
    console.log(`   Available: ${isAvailable}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Not set'}\n`);
    
    if (type === 'memory') {
      console.log('⚠️  WARNING: Using in-memory fallback');
      console.log('   This is OK for development but NOT for production.\n');
    }
    
    // Test 1: Basic Set/Get
    console.log('Test 1: Basic Set/Get');
    try {
      await deliveryRedisService.setex('test:basic', 60, 'test:value');
      const value = await deliveryRedisService.get('test:basic');
      
      if (value === 'test:value') {
        console.log('✅ PASS - Set/Get working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Expected 'test:value', got '${value}'\n`);
        failed++;
      }
      
      await deliveryRedisService.del('test:basic');
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 2: List Operations
    console.log('Test 2: List Operations (Queue)');
    try {
      await deliveryRedisService.rpush('test:list', 'item1');
      await deliveryRedisService.rpush('test:list', 'item2');
      await deliveryRedisService.rpush('test:list', 'item3');
      
      const length = await deliveryRedisService.llen('test:list');
      const item = await deliveryRedisService.lpop('test:list');
      const newLength = await deliveryRedisService.llen('test:list');
      
      if (length === 3 && item === 'item1' && newLength === 2) {
        console.log('✅ PASS - List operations working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Length: ${length}, Item: ${item}, New length: ${newLength}\n`);
        failed++;
      }
      
      await deliveryRedisService.del('test:list');
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 3: Expiration
    console.log('Test 3: TTL/Expiration');
    try {
      await deliveryRedisService.setex('test:expire', 1, 'will:expire');
      const beforeExpire = await deliveryRedisService.get('test:expire');
      
      console.log('   Waiting 1.5 seconds for expiration...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const afterExpire = await deliveryRedisService.get('test:expire');
      
      if (beforeExpire === 'will:expire' && afterExpire === null) {
        console.log('✅ PASS - TTL/Expiration working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Before: ${beforeExpire}, After: ${afterExpire}\n`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 4: Increment/Decrement
    console.log('Test 4: Increment/Decrement');
    try {
      const val1 = await deliveryRedisService.incr('test:counter');
      const val2 = await deliveryRedisService.incr('test:counter');
      const val3 = await deliveryRedisService.decr('test:counter');
      
      if (val1 === 1 && val2 === 2 && val3 === 1) {
        console.log('✅ PASS - Increment/Decrement working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Values: ${val1}, ${val2}, ${val3}\n`);
        failed++;
      }
      
      await deliveryRedisService.del('test:counter');
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 5: Hash Operations
    console.log('Test 5: Hash Operations');
    try {
      await deliveryRedisService.hincrby('test:hash', 'field1', 10);
      await deliveryRedisService.hincrby('test:hash', 'field2', 20);
      const hash = await deliveryRedisService.hgetall('test:hash');
      
      if (hash.field1 === '10' && hash.field2 === '20') {
        console.log('✅ PASS - Hash operations working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Hash: ${JSON.stringify(hash)}\n`);
        failed++;
      }
      
      await deliveryRedisService.del('test:hash');
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 6: Keys Pattern Matching
    console.log('Test 6: Keys Pattern Matching');
    try {
      await deliveryRedisService.setex('driver:123:location', 60, 'data1');
      await deliveryRedisService.setex('driver:456:location', 60, 'data2');
      await deliveryRedisService.setex('driver:789:location', 60, 'data3');
      
      const keys = await deliveryRedisService.keys('driver:*:location');
      
      if (keys.length === 3) {
        console.log('✅ PASS - Pattern matching working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Expected 3 keys, got ${keys.length}\n`);
        failed++;
      }
      
      // Cleanup
      for (const key of keys) {
        await deliveryRedisService.del(key);
      }
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Test 7: Real-world Scenario (Driver Location)
    console.log('Test 7: Real-world Scenario (Driver Location)');
    try {
      const driverId = 'test-driver-123';
      const location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date().toISOString(),
      };
      
      // Store location
      await deliveryRedisService.setex(
        `driver:${driverId}:location`,
        300, // 5 minutes
        JSON.stringify(location)
      );
      
      // Retrieve location
      const stored = await deliveryRedisService.get(`driver:${driverId}:location`);
      const parsed = stored ? JSON.parse(stored) : null;
      
      if (parsed && parsed.latitude === location.latitude && parsed.longitude === location.longitude) {
        console.log('✅ PASS - Driver location storage working correctly\n');
        passed++;
      } else {
        console.log(`❌ FAIL - Location mismatch\n`);
        failed++;
      }
      
      await deliveryRedisService.del(`driver:${driverId}:location`);
    } catch (error) {
      console.log(`❌ FAIL - ${error instanceof Error ? error.message : String(error)}\n`);
      failed++;
    }
    
    // Summary
    console.log('============================================================\n');
    console.log('📊 TEST SUMMARY\n');
    console.log(`Total Tests: ${passed + failed}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);
    
    if (type === 'redis') {
      console.log('✅ Redis connection is working correctly!');
      console.log('   System is ready for production.\n');
    } else if (type === 'memory') {
      console.log('⚠️  Using in-memory fallback.');
      console.log('   Configure REDIS_URL for production use.\n');
    }
    
    if (failed > 0) {
      console.log('⚠️  Some tests failed. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('✅ All tests passed!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

testRedis();
