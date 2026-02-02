/**
 * Test Admin Login Endpoint Directly
 * 
 * This script tests the /api/auth/session endpoint directly
 * to verify PIN authentication is working
 */

const BASE_URL = 'http://localhost:3000';

async function testLoginEndpoint() {
  console.log('🔐 Testing Admin Login Endpoint\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Endpoint: POST /api/auth/session\n`);

  try {
    // Test 1: Valid PIN
    console.log('📝 Test 1: Valid PIN (1234)');
    console.log('─'.repeat(50));
    
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
    });

    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    
    if (response.status === 200 && data.success) {
      console.log('✅ Login successful!');
      console.log(`   Employee: ${data.employee.name} (${data.employee.role})`);
      console.log(`   Token: ${data.token?.substring(0, 20)}...`);
    } else {
      console.log('❌ Login failed');
      console.log(`   Error: ${data.error}`);
      console.log(`   Error Code: ${data.errorCode}`);
    }

    console.log('\n');

    // Test 2: Invalid PIN
    console.log('📝 Test 2: Invalid PIN (9999)');
    console.log('─'.repeat(50));
    
    const response2 = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pin: '9999',
        allowedRoles: ['ADMIN'],
      }),
    });

    const data2 = await response2.json();
    
    console.log(`Status: ${response2.status}`);
    console.log(`Response:`, JSON.stringify(data2, null, 2));
    
    if (response2.status === 401) {
      console.log('✅ Correctly rejected invalid PIN');
    } else {
      console.log('❌ Unexpected response');
    }

    console.log('\n');

    // Test 3: Missing PIN
    console.log('📝 Test 3: Missing PIN');
    console.log('─'.repeat(50));
    
    const response3 = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allowedRoles: ['ADMIN'],
      }),
    });

    const data3 = await response3.json();
    
    console.log(`Status: ${response3.status}`);
    console.log(`Response:`, JSON.stringify(data3, null, 2));
    
    if (response3.status === 400) {
      console.log('✅ Correctly rejected missing PIN');
    } else {
      console.log('❌ Unexpected response');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n⚠️  Make sure the dev server is running: npm run dev');
  }
}

testLoginEndpoint();
