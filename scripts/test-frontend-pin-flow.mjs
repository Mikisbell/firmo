#!/usr/bin/env node

/**
 * Test script to simulate exactly what the frontend does
 * This helps debug the PIN modal flow
 */

const BASE_URL = 'http://localhost:3000';

async function testFrontendFlow() {
  console.log('🔐 Testing Frontend PIN Flow (Simulating PinModal.tsx)\n');

  // Step 1: Simulate what PinModal does
  console.log('📝 Step 1: Frontend sends POST to /api/auth/session');
  console.log('   Method: POST');
  console.log('   Headers: Content-Type: application/json');
  console.log('   Credentials: include (for cookies)');
  console.log('   Body: { pin: "1234", allowedRoles: ["ADMIN", "OWNER"] }\n');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        pin: '1234', 
        allowedRoles: ['ADMIN', 'OWNER'] 
      }),
      credentials: 'include', // Important: include cookies
    });

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Headers:`);
    
    // Check for Set-Cookie header
    const setCookie = response.headers.get('set-cookie');
    console.log(`   Set-Cookie: ${setCookie ? '✅ Present' : '❌ Missing'}`);
    if (setCookie) {
      console.log(`   Value: ${setCookie.substring(0, 100)}...`);
    }

    const data = await response.json();
    console.log(`\n📊 Response Body:`);
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Frontend would call onSuccess() with employee data');
      console.log(`   Employee: ${data.employee.name} (${data.employee.role})`);
      console.log('\n✅ Modal should close and user should be logged in');
    } else {
      console.log('\n❌ Frontend would show error message');
      console.log(`   Error: ${data.error}`);
    }

    // Step 2: Verify cookie was set by making a GET request
    console.log('\n\n📝 Step 2: Verify cookie persistence (GET /api/auth/session)');
    console.log('   This is what AuthContext.checkSession() does\n');

    const checkResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      credentials: 'include', // Include cookies
    });

    console.log(`📊 Response Status: ${checkResponse.status}`);
    const checkData = await checkResponse.json();
    console.log(`📊 Response Body:`);
    console.log(JSON.stringify(checkData, null, 2));

    if (checkResponse.ok && checkData.valid) {
      console.log('\n✅ Cookie was set correctly and persists');
      console.log(`   Session valid: ${checkData.valid}`);
      console.log(`   Employee: ${checkData.employee.name}`);
    } else {
      console.log('\n❌ Cookie was NOT set or is invalid');
      console.log('   This would cause the user to be logged out immediately');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendFlow();
