/**
 * Frontend SSE Test Script
 * 
 * Tests the SSE endpoint and test page accessibility.
 * 
 * Run: npx tsx scripts/test-delivery-frontend-sse.ts
 */

const BASE_URL = 'http://localhost:3001';

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
  console.log('\n🧪 DELIVERY SSE FRONTEND TESTS\n');
  console.log('='.repeat(60));
  console.log(`Testing against: ${BASE_URL}\n`);
  
  console.log('📡 API Endpoint Tests\n');
  
  await test('1. SSE Endpoint - Accessible', async () => {
    const response = await fetch(`${BASE_URL}/api/deliveries/stream`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    if (response.headers.get('content-type') !== 'text/event-stream') {
      throw new Error(`Expected text/event-stream, got ${response.headers.get('content-type')}`);
    }
    
    response.body?.cancel();
  })();
  
  await test('2. SSE Endpoint - Correct Headers', async () => {
    const response = await fetch(`${BASE_URL}/api/deliveries/stream`);
    
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    const connection = response.headers.get('connection');
    
    if (contentType !== 'text/event-stream') {
      throw new Error(`Wrong content-type: ${contentType}`);
    }
    
    if (!cacheControl?.includes('no-cache')) {
      throw new Error(`Wrong cache-control: ${cacheControl}`);
    }
    
    if (connection !== 'keep-alive') {
      throw new Error(`Wrong connection: ${connection}`);
    }
    
    response.body?.cancel();
  })();
  
  await test('3. SSE Endpoint - Filter by Restaurant ID', async () => {
    const restaurantId = 'test-restaurant-123';
    const response = await fetch(
      `${BASE_URL}/api/deliveries/stream?restaurantId=${restaurantId}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    response.body?.cancel();
  })();
  
  await test('4. SSE Endpoint - Filter by Driver ID', async () => {
    const driverId = 'test-driver-456';
    const response = await fetch(
      `${BASE_URL}/api/deliveries/stream?driverId=${driverId}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    response.body?.cancel();
  })();
  
  await test('5. Broadcast API - Send Test Event', async () => {
    const response = await fetch(`${BASE_URL}/api/test/broadcast-delivery-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order_created',
        data: {
          orderId: 'test-order-123',
          customerName: 'Test Customer',
          status: 'PENDING'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error('Broadcast API returned success: false');
    }
  })();
  
  await test('6. Broadcast API - Validation (Missing Type)', async () => {
    const response = await fetch(`${BASE_URL}/api/test/broadcast-delivery-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { orderId: 'test' }
      })
    });
    
    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.error) {
      throw new Error('Expected error message');
    }
  })();
  
  await test('7. Broadcast API - Validation (Missing Data)', async () => {
    const response = await fetch(`${BASE_URL}/api/test/broadcast-delivery-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'order_created'
      })
    });
    
    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.error) {
      throw new Error('Expected error message');
    }
  })();
  
  await test('8. Test Page - Accessible', async () => {
    const response = await fetch(`${BASE_URL}/test-delivery-sse`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    if (!html.includes('Delivery SSE Test Page')) {
      throw new Error('Test page content not found');
    }
  })();
  
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
  console.log('\n✨ Frontend SSE tests complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Open http://localhost:3001/test-delivery-sse in your browser');
  console.log('   2. Click "Send Test Event" to manually test');
  console.log('   3. Open multiple tabs to test multi-client broadcasting');
  console.log('   4. Check browser console for detailed logs\n');
  
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
