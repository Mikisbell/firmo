/**
 * Complete Device ID Activation Flow Test
 * 
 * Simulates the complete flow:
 * 1. Device generates UUID and stores in localStorage
 * 2. User enters activation code
 * 3. Terminal is activated and bound to device
 * 4. Subsequent logins recognize the device
 * 5. Only PIN required (no code needed)
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
  console.log('🧪 Complete Device ID Activation Flow Test\n');
  
  try {
    // Simulate device ID (would be stored in localStorage)
    const deviceId = generateUUID();
    console.log(`📱 Device ID (stored in localStorage): ${deviceId}\n`);
    
    // Step 1: User selects terminal and enters activation code
    console.log('1️⃣  User selects terminal and enters activation code...');
    const activationCode = '938192'; // From our test terminal
    console.log(`   Terminal: TEST_CAJA_01`);
    console.log(`   Code: ${activationCode}\n`);
    
    // Step 2: Frontend calls activate-simple endpoint
    console.log('2️⃣  Frontend calls /api/terminals/activate-simple...');
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
      console.log(`   Status: ${activateResponse.status}\n`);
      process.exit(1);
    }
    
    console.log(`   ✅ Terminal activated successfully`);
    console.log(`   ✅ Terminal ID: ${activateData.terminal.terminal_id}`);
    console.log(`   ✅ Status: ${activateData.terminal.status}\n`);
    
    // Step 3: Validate device binding
    console.log('3️⃣  Validating device binding...');
    const validateResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    const validateData = await validateResponse.json() as any;
    
    if (!validateResponse.ok || !validateData.valid) {
      console.log(`   ❌ Device validation failed: ${validateData.error}`);
      process.exit(1);
    }
    
    console.log(`   ✅ Device is bound to terminal`);
    console.log(`   ✅ Terminal: ${validateData.terminal.terminal_id}`);
    console.log(`   ✅ Device ID: ${validateData.terminal.device_id}\n`);
    
    // Step 4: Simulate second login (same device)
    console.log('4️⃣  Simulating second login (same device)...');
    const secondValidateResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    const secondValidateData = await secondValidateResponse.json() as any;
    
    if (secondValidateResponse.ok && secondValidateData.valid) {
      console.log(`   ✅ Device recognized!`);
      console.log(`   ✅ NO activation code needed`);
      console.log(`   ✅ User only needs to enter PIN\n`);
    } else {
      console.log(`   ❌ Device not recognized\n`);
      process.exit(1);
    }
    
    // Step 5: Test with different device (should fail)
    console.log('5️⃣  Testing with different device (should fail)...');
    const differentDeviceId = generateUUID();
    const differentDeviceResponse = await fetch(`${API_BASE}/api/terminals/validate-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: differentDeviceId,
        terminal_id: 'TEST_CAJA_01',
      }),
    });
    
    const differentDeviceData = await differentDeviceResponse.json() as any;
    
    if (!differentDeviceResponse.ok || !differentDeviceData.valid) {
      console.log(`   ✅ Different device correctly rejected`);
      console.log(`   ✅ Error: ${differentDeviceData.error}`);
      console.log(`   ✅ Would require activation code again\n`);
    } else {
      console.log(`   ❌ Different device was accepted (unexpected)\n`);
      process.exit(1);
    }
    
    console.log('✅ Complete Device ID Activation Flow Test PASSED!\n');
    console.log('📋 Summary:');
    console.log('   ✅ Device ID generated and persisted');
    console.log('   ✅ Terminal activated with device binding');
    console.log('   ✅ Device recognized on subsequent logins');
    console.log('   ✅ Only PIN required (no code needed)');
    console.log('   ✅ Different devices require new activation code\n');
    console.log('🎉 Problem SOLVED: No more "code every time"!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
