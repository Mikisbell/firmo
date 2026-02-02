/**
 * Test Login Flow with Cookie Handling
 * Simulates browser behavior with cookie persistence
 */

import http from 'http';
import https from 'https';

const BASE_URL = 'http://localhost:3000';

class CookieJar {
  constructor() {
    this.cookies = {};
  }

  setCookie(setCookieHeader) {
    if (!setCookieHeader) return;
    
    const parts = setCookieHeader.split(';');
    const [nameValue] = parts[0].split('=');
    const [name, value] = nameValue.split('=');
    
    if (name && value) {
      this.cookies[name.trim()] = value.trim();
    }
  }

  getCookieHeader() {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

async function makeRequest(method, path, body = null, cookieJar = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (cookieJar && cookieJar.getCookieHeader()) {
      options.headers['Cookie'] = cookieJar.getCookieHeader();
    }

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        // Extract Set-Cookie header
        if (res.headers['set-cookie'] && cookieJar) {
          res.headers['set-cookie'].forEach(cookie => {
            cookieJar.setCookie(cookie);
          });
        }

        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
            rawBody: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testLoginFlow() {
  console.log('\n🔐 Testing Login Flow with Cookie Persistence\n');
  console.log('═'.repeat(60));

  const cookieJar = new CookieJar();

  // Step 1: Login
  console.log('\n📝 Step 1: Login with PIN 1234');
  console.log('─'.repeat(60));

  const loginResponse = await makeRequest('POST', '/api/auth/session', {
    pin: '1234',
    allowedRoles: ['ADMIN'],
  }, cookieJar);

  console.log(`Status: ${loginResponse.status}`);
  console.log(`Response:`, JSON.stringify(loginResponse.body, null, 2));

  if (loginResponse.status === 200 && loginResponse.body.success) {
    console.log('✅ Login successful');
    console.log(`   Employee: ${loginResponse.body.employee.name}`);
    console.log(`   Cookies set: ${Object.keys(cookieJar.cookies).join(', ')}`);
  } else {
    console.log('❌ Login failed');
    return;
  }

  // Step 2: Check session
  console.log('\n📝 Step 2: Check session with cookie');
  console.log('─'.repeat(60));

  const sessionResponse = await makeRequest('GET', '/api/auth/session', null, cookieJar);

  console.log(`Status: ${sessionResponse.status}`);
  console.log(`Response:`, JSON.stringify(sessionResponse.body, null, 2));

  if (sessionResponse.status === 200 && sessionResponse.body.valid) {
    console.log('✅ Session check successful');
    console.log(`   Employee: ${sessionResponse.body.employee.name}`);
  } else {
    console.log('❌ Session check failed');
    console.log(`   Cookies sent: ${cookieJar.getCookieHeader()}`);
  }

  // Step 3: Logout
  console.log('\n📝 Step 3: Logout');
  console.log('─'.repeat(60));

  const logoutResponse = await makeRequest('DELETE', '/api/auth/session', null, cookieJar);

  console.log(`Status: ${logoutResponse.status}`);
  console.log(`Response:`, JSON.stringify(logoutResponse.body, null, 2));

  if (logoutResponse.status === 200) {
    console.log('✅ Logout successful');
  } else {
    console.log('❌ Logout failed');
  }

  // Step 4: Verify session is revoked
  console.log('\n📝 Step 4: Verify session is revoked');
  console.log('─'.repeat(60));

  const revokedResponse = await makeRequest('GET', '/api/auth/session', null, cookieJar);

  console.log(`Status: ${revokedResponse.status}`);
  console.log(`Response:`, JSON.stringify(revokedResponse.body, null, 2));

  if (revokedResponse.status === 401) {
    console.log('✅ Session correctly revoked');
  } else {
    console.log('❌ Session still valid (should be revoked)');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Login flow test completed\n');
}

testLoginFlow().catch(error => {
  console.error('❌ Test error:', error);
  process.exit(1);
});
