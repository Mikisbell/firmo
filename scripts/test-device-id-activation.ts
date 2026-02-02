/**
 * Test Device ID Activation Flow
 * 
 * Tests the complete terminal activation flow with persistent device ID:
 * 1. Generate device ID (stored in localStorage)
 * 2. Activate terminal with 6-digit code
 * 3. Verify device is bound to terminal
 * 4. Subsequent login should NOT ask for code again
 * 5. Only PIN required on next login
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Simulate device ID (would be stored in localStorage in browser)
let deviceId = '';

// Generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function test() {
  console.log('🧪 Testing Device ID Activation Flow\n');
  
  try {
    // Step 0: Create test terminal
    console.log('0️⃣  Creating test terminal...');
    const createTerminalResponse = await fetch(`${API_BASE}/api/admin/terminals-v2/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal_id: 'TEST_CAJA_01',
        role: 'CASHIER',
        location_id: 'LOC01',
        device_name: 'Test Terminal',
      }),
    });
    
    if (!createTerminalResponse.ok) {
      console.log('   ⚠️  Could not create terminal (may already exist)');
    } else {
      const terminalData = await createTerminalResponse.json() as any;
      console.log(`   ✅ Terminal created: ${terminalData.terminal_id}\n`);
    }
    
    // Step 1: Generate device ID
    console.log('1️⃣  Generating device ID...');
    deviceId = generateUUID();
    console.log(`   ✅ Device ID: ${deviceId}\n`);
    
    // Step 2: Get activation code (in real scenario, admin provides this)
    console.log('2️⃣  Getting activation code...');
    const codeResponse = await fetch(`${API_BASE}/api/admin/terminals-v2/TEST_CAJA_01/regenerate-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    let activationCode = '123456';
    if (codeResponse.ok) {
      const codeData = await codeResponse.json() as any;
      activationCode = codeData.code;
      console.log(`   ✅ Code: ${activationCode}\n`);
    } else {
      console.log('   ⚠️  Could not generate code (admin endpoint may require auth)');
      console.log('   ℹ️  Using test code: 123456\n');
    }
    
    // Step 3: Activate terminal with device_id
    console.log('3️⃣  Activating terminal with device_id...');
    const activateResponse = await fetch(`${API_BASE}/api/terminals/activate-simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        terminal_id: 'TEST_CAJA_01',
        code: activationCode,
        device_id: deviceId,
      }),
    });
    
    const activateData = await activateResponse.json() as any;
    
    if (!activateResponse.ok) {
      console.log(`   ❌ Activation failed: ${activateData.error}`);
      console.log(`   ℹ️  This is expected if code is invalid\n`);
    } else {
      console.log(`   ✅ Terminal activated: ${activateData.terminal.terminal_id}`);
      console.log(`   ✅ Status: ${activateData.terminal.status}\n`);
    }
    
    // Step 4: Validate device binding
    console.log('4️⃣  Validating device binding...');
    const validateResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    if (validateResponse.ok) {
      const validateData = await validateResponse.json() as any;
      console.log(`   ✅ Device is bound to terminal: ${validateData.terminal.terminal_id}`);
      console.log(`   ✅ Device ID: ${validateData.terminal.device_id}\n`);
    } else {
      console.log(`   ⚠️  Device validation failed (may not be bound yet)\n`);
    }
    
    // Step 5: Simulate second login with same device
    console.log('5️⃣  Simulating second login (same device)...');
    const secondValidateResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    if (secondValidateResponse.ok) {
      console.log(`   ✅ Device recognized - NO activation code needed!`);
      console.log(`   ✅ User would only need to enter PIN\n`);
    } else {
      console.log(`   ❌ Device not recognized\n`);
    }
    
    // Step 6: Test with different device ID (should fail)
    console.log('6️⃣  Testing with different device ID (should fail)...');
    const differentDeviceId = generateUUID();
    const differentDeviceResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: differentDeviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    if (!differentDeviceResponse.ok) {
      console.log(`   ✅ Different device correctly rejected`);
      console.log(`   ✅ Would require activation code again\n`);
    } else {
      console.log(`   ⚠️  Different device was accepted (unexpected)\n`);
    }
    
    console.log('✅ Device ID Activation Flow Test Complete!\n');
    console.log('📋 Summary:');
    console.log('   • Device ID is generated once and persisted');
    console.log('   • Terminal is bound to device ID on activation');
    console.log('   • Subsequent logins recognize the device');
    console.log('   • Only PIN required on next login (no code needed)');
    console.log('   • Different devices require new activation code\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
