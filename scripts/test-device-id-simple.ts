/**
 * Simple Device ID Validation Test
 * 
 * Tests just the device validation endpoint
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

// Generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function test() {
  console.log('🧪 Testing Device ID Validation\n');
  
  try {
    const deviceId = generateUUID();
    console.log(`Device ID: ${deviceId}\n`);
    
    // Test 1: Validate device with TEST_CAJA_01
    console.log('1️⃣  Validating device with TEST_CAJA_01...');
    const response1 = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    console.log(`   Status: ${response1.status}`);
    const data1 = await response1.json() as any;
    console.log(`   Response:`, JSON.stringify(data1, null, 2));
    
    if (response1.ok) {
      console.log(`   ✅ Device validation successful\n`);
    } else {
      console.log(`   ⚠️  Device not bound (expected for new device)\n`);
    }
    
    // Test 2: Try with different device
    console.log('2️⃣  Validating different device with TEST_CAJA_01...');
    const differentDeviceId = generateUUID();
    const response2 = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: differentDeviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    console.log(`   Status: ${response2.status}`);
    const data2 = await response2.json() as any;
    console.log(`   Response:`, JSON.stringify(data2, null, 2));
    
    if (!response2.ok) {
      console.log(`   ✅ Different device correctly rejected\n`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
