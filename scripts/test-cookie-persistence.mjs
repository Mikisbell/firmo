#!/usr/bin/env node

/**
 * Test cookie persistence with proper Node.js cookie jar
 * This simulates a real browser cookie jar
 */

import http from 'http';

const BASE_URL = 'http://localhost:3000';

// Simple cookie jar
const cookies = {};

function setCookieFromHeader(setCookieHeader) {
  if (!setCookieHeader) return;
  
  // Parse Set-Cookie header
  const parts = setCookieHeader.split(';');
  const [nameValue] = parts;
  const [name, value] = nameValue.split('=');
  
  cookies[name.trim()] = value.trim();
  console.log(`  🍪 Cookie stored: ${name.trim()}=${value.substring(0, 50)}...`);
}

function getCookieHeader() {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function makeRequest(method, path, body = null) {
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

    // Add cookies to request
    const cookieHeader = getCookieHeader();
    if (cookieHeader) {
      options.headers['Cookie'] = cookieHeader;
      console.log(`  📤 Sending cookies: ${cookieHeader.substring(0, 50)}...`);
    }

    const req = http.request(options, (res) => {
      let data = '';

      // Check for Set-Cookie header
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        console.log(`  📥 Received Set-Cookie header`);
        if (Array.isArray(setCookie)) {
          setCookie.forEach(setCookieFromHeader);
        } else {
          setCookieFromHeader(setCookie);
        }
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null,
        });
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
  console.log('🔐 Testing Cookie Persistence with Node.js\n');

  try {
    // Step 1: POST to login
    console.log('📝 Step 1: POST /api/auth/session (Login)');
    console.log('─'.repeat(50));
    const loginResponse = await makeRequest('POST', '/api/auth/session', {
      pin: '1234',
      allowedRoles: ['ADMIN', 'OWNER'],
    });

    console.log(`  Status: ${loginResponse.status}`);
    console.log(`  Response: ${JSON.stringify(loginResponse.body, null, 2)}`);

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed');
      return;
    }

    console.log('✅ Login successful\n');

    // Step 2: GET to verify session
    console.log('📝 Step 2: GET /api/auth/session (Verify)');
    console.log('─'.repeat(50));
    const verifyResponse = await makeRequest('GET', '/api/auth/session');

    console.log(`  Status: ${verifyResponse.status}`);
    console.log(`  Response: ${JSON.stringify(verifyResponse.body, null, 2)}`);

    if (verifyResponse.status === 200 && verifyResponse.body.valid) {
      console.log('✅ Cookie persisted correctly!\n');
      console.log('🎉 The issue is NOT with the server or cookies.');
      console.log('   The problem is likely in the browser or frontend code.');
    } else {
      console.log('❌ Cookie did NOT persist\n');
      console.log('🔴 The server is NOT setting cookies correctly.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
