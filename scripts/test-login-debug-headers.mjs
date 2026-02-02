/**
 * Test Login Flow - Debug Headers
 */

import http from 'http';

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3000');
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
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

async function test() {
  console.log('\n🔐 Testing Login - Debug Headers\n');

  const response = await makeRequest('POST', '/api/auth/session', {
    pin: '1234',
    allowedRoles: ['ADMIN'],
  });

  console.log('Status:', response.status);
  console.log('\nHeaders:');
  Object.entries(response.headers).forEach(([key, value]) => {
    if (key === 'set-cookie') {
      console.log(`  ${key}:`, Array.isArray(value) ? value : [value]);
    } else {
      console.log(`  ${key}:`, value);
    }
  });

  console.log('\nBody:', JSON.stringify(response.body, null, 2));

  if (response.headers['set-cookie']) {
    console.log('\n✅ Set-Cookie header present');
    const cookies = Array.isArray(response.headers['set-cookie']) 
      ? response.headers['set-cookie'] 
      : [response.headers['set-cookie']];
    cookies.forEach(cookie => {
      console.log(`   ${cookie.substring(0, 100)}...`);
    });
  } else {
    console.log('\n❌ Set-Cookie header NOT present');
  }
}

test().catch(console.error);
