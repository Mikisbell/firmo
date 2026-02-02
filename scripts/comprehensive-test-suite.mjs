/**
 * Comprehensive Test Suite for Admin Login
 * Tests: Frontend, Backend, Database, and Integration
 */

const BASE_URL = 'http://localhost:3000';
const TESTS = [];
let passedTests = 0;
let failedTests = 0;

// Helper functions
function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
  TESTS.push({ name, status, details });
  if (status === 'PASS') passedTests++;
  else failedTests++;
}

async function testBackendEndpoint() {
  console.log('\n📡 BACKEND TESTS\n');
  console.log('─'.repeat(60));

  // Test 1: Valid PIN
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
    });

    if (response.status === 200) {
      const data = await response.json();
      if (data.success && data.employee) {
        logTest('Backend: Valid PIN (1234)', 'PASS', `Employee: ${data.employee.name}`);
      } else {
        logTest('Backend: Valid PIN (1234)', 'FAIL', 'Response missing success or employee');
      }
    } else {
      logTest('Backend: Valid PIN (1234)', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: Valid PIN (1234)', 'FAIL', error.message);
  }

  // Test 2: Invalid PIN
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '9999',
        allowedRoles: ['ADMIN'],
      }),
    });

    if (response.status === 401) {
      const data = await response.json();
      if (data.error && data.errorCode === 'INVALID_PIN') {
        logTest('Backend: Invalid PIN (9999)', 'PASS', 'Correctly rejected');
      } else {
        logTest('Backend: Invalid PIN (9999)', 'FAIL', 'Wrong error response');
      }
    } else {
      logTest('Backend: Invalid PIN (9999)', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: Invalid PIN (9999)', 'FAIL', error.message);
  }

  // Test 3: Missing PIN
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowedRoles: ['ADMIN'],
      }),
    });

    if (response.status === 400) {
      logTest('Backend: Missing PIN validation', 'PASS', 'Correctly rejected');
    } else {
      logTest('Backend: Missing PIN validation', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: Missing PIN validation', 'FAIL', error.message);
  }

  // Test 4: Missing roles
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
      }),
    });

    if (response.status === 400) {
      logTest('Backend: Missing roles validation', 'PASS', 'Correctly rejected');
    } else {
      logTest('Backend: Missing roles validation', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: Missing roles validation', 'FAIL', error.message);
  }

  // Test 5: GET session (no auth)
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      logTest('Backend: GET session without auth', 'PASS', 'Correctly rejected');
    } else {
      logTest('Backend: GET session without auth', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: GET session without auth', 'FAIL', error.message);
  }

  // Test 6: Cookie handling
  try {
    const response = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
      credentials: 'include',
    });

    if (response.status === 200) {
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader && setCookieHeader.includes('auth_token')) {
        logTest('Backend: Cookie set correctly', 'PASS', 'auth_token cookie present');
      } else {
        logTest('Backend: Cookie set correctly', 'FAIL', 'auth_token cookie missing');
      }
    } else {
      logTest('Backend: Cookie set correctly', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Backend: Cookie set correctly', 'FAIL', error.message);
  }
}

async function testFrontendPages() {
  console.log('\n🖥️  FRONTEND TESTS\n');
  console.log('─'.repeat(60));

  // Test 1: Admin page loads
  try {
    const response = await fetch(`${BASE_URL}/admin`);
    if (response.status === 200) {
      const html = await response.text();
      if (html.includes('<!DOCTYPE') || html.includes('<html')) {
        logTest('Frontend: Admin page loads', 'PASS', 'HTML received');
      } else {
        logTest('Frontend: Admin page loads', 'FAIL', 'Invalid HTML');
      }
    } else {
      logTest('Frontend: Admin page loads', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Frontend: Admin page loads', 'FAIL', error.message);
  }

  // Test 2: Home page loads
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.status === 200) {
      logTest('Frontend: Home page loads', 'PASS', 'Status 200');
    } else {
      logTest('Frontend: Home page loads', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Frontend: Home page loads', 'FAIL', error.message);
  }

  // Test 3: API health check
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.status === 200) {
      const data = await response.json();
      if (data.status === 'ok') {
        logTest('Frontend: API health check', 'PASS', 'API is healthy');
      } else {
        logTest('Frontend: API health check', 'FAIL', 'Unhealthy status');
      }
    } else {
      logTest('Frontend: API health check', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Frontend: API health check', 'FAIL', error.message);
  }
}

async function testDatabase() {
  console.log('\n🗄️  DATABASE TESTS\n');
  console.log('─'.repeat(60));

  // Test 1: Check admin employee exists
  try {
    const response = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: 'GET',
      credentials: 'include',
    });

    // This will fail without auth, but we're just checking if the endpoint exists
    if (response.status === 401 || response.status === 200) {
      logTest('Database: Admin employees endpoint exists', 'PASS', `Status: ${response.status}`);
    } else {
      logTest('Database: Admin employees endpoint exists', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Database: Admin employees endpoint exists', 'FAIL', error.message);
  }

  // Test 2: Check products endpoint
  try {
    const response = await fetch(`${BASE_URL}/api/products`);
    if (response.status === 200) {
      const data = await response.json();
      if (Array.isArray(data)) {
        logTest('Database: Products endpoint works', 'PASS', `${data.length} products`);
      } else {
        logTest('Database: Products endpoint works', 'FAIL', 'Invalid response format');
      }
    } else {
      logTest('Database: Products endpoint works', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Database: Products endpoint works', 'FAIL', error.message);
  }

  // Test 3: Check orders endpoint
  try {
    const response = await fetch(`${BASE_URL}/api/orders`);
    if (response.status === 200) {
      logTest('Database: Orders endpoint works', 'PASS', 'Status 200');
    } else if (response.status === 401) {
      logTest('Database: Orders endpoint works', 'PASS', 'Requires auth (expected)');
    } else {
      logTest('Database: Orders endpoint works', 'FAIL', `Status: ${response.status}`);
    }
  } catch (error) {
    logTest('Database: Orders endpoint works', 'FAIL', error.message);
  }
}

async function testIntegration() {
  console.log('\n🔗 INTEGRATION TESTS\n');
  console.log('─'.repeat(60));

  // Test 1: Full login flow
  try {
    // Step 1: Login
    const loginResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: '1234',
        allowedRoles: ['ADMIN'],
      }),
      credentials: 'include',
    });

    if (loginResponse.status === 200) {
      const loginData = await loginResponse.json();
      
      // Step 2: Check session
      const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
        method: 'GET',
        credentials: 'include',
      });

      if (sessionResponse.status === 200) {
        const sessionData = await sessionResponse.json();
        if (sessionData.valid && sessionData.employee) {
          logTest('Integration: Full login flow', 'PASS', 'Login → Session check successful');
        } else {
          logTest('Integration: Full login flow', 'FAIL', 'Session check failed');
        }
      } else {
        logTest('Integration: Full login flow', 'FAIL', `Session check status: ${sessionResponse.status}`);
      }
    } else {
      logTest('Integration: Full login flow', 'FAIL', `Login status: ${loginResponse.status}`);
    }
  } catch (error) {
    logTest('Integration: Full login flow', 'FAIL', error.message);
  }

  // Test 2: Logout flow
  try {
    const logoutResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (logoutResponse.status === 200) {
      logTest('Integration: Logout flow', 'PASS', 'Logout successful');
    } else {
      logTest('Integration: Logout flow', 'FAIL', `Status: ${logoutResponse.status}`);
    }
  } catch (error) {
    logTest('Integration: Logout flow', 'FAIL', error.message);
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + '🧪 COMPREHENSIVE TEST SUITE 🧪' + ' '.repeat(17) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nBase URL: ${BASE_URL}\n`);

  await testBackendEndpoint();
  await testFrontendPages();
  await testDatabase();
  await testIntegration();

  // Summary
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(20) + '📊 TEST SUMMARY 📊' + ' '.repeat(20) + '║');
  console.log('╠' + '═'.repeat(58) + '╣');
  console.log(`║ ✅ Passed: ${passedTests}${' '.repeat(50 - passedTests.toString().length)}║`);
  console.log(`║ ❌ Failed: ${failedTests}${' '.repeat(50 - failedTests.toString().length)}║`);
  console.log(`║ 📈 Total:  ${TESTS.length}${' '.repeat(50 - TESTS.length.toString().length)}║`);
  console.log('╠' + '═'.repeat(58) + '╣');

  const percentage = Math.round((passedTests / TESTS.length) * 100);
  const status = percentage === 100 ? '✅ ALL TESTS PASSED' : `⚠️  ${percentage}% PASSED`;
  console.log(`║ ${status}${' '.repeat(58 - status.length - 1)}║`);
  console.log('╚' + '═'.repeat(58) + '╝\n');

  // Detailed results
  if (failedTests > 0) {
    console.log('Failed Tests:');
    TESTS.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ❌ ${t.name}`);
      if (t.details) console.log(`     ${t.details}`);
    });
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});
