/**
 * Debug Activation Endpoint
 */

import prisma from '@/src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function test() {
  try {
    console.log('🧪 Testing Activation Flow\n');
    
    // Step 1: Find terminal
    console.log('1️⃣  Finding terminal TEST_CAJA_01...');
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: 'TEST_CAJA_01',
        tenant_id: TENANT_ID,
      },
    });
    
    if (!terminal) {
      console.log('   ❌ Terminal not found');
      process.exit(1);
    }
    console.log(`   ✅ Terminal found: ${terminal.terminal_id}\n`);
    
    // Step 2: Find activation code
    console.log('2️⃣  Finding activation code...');
    const activationCode = await prisma.activation_codes.findFirst({
      where: {
        terminal_id: 'TEST_CAJA_01',
        used: false,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    
    if (!activationCode) {
      console.log('   ❌ No activation code found');
      process.exit(1);
    }
    console.log(`   ✅ Code found: ${activationCode.code}`);
    console.log(`   ✅ Expires at: ${activationCode.expires_at}\n`);
    
    // Step 3: Check expiration
    console.log('3️⃣  Checking expiration...');
    if (new Date() > activationCode.expires_at) {
      console.log('   ❌ Code expired');
      process.exit(1);
    }
    console.log('   ✅ Code is valid\n');
    
    // Step 4: Update terminal with device_id
    console.log('4️⃣  Updating terminal with device_id...');
    const deviceId = generateUUID();
    const updated = await prisma.terminal_devices.update({
      where: { id: terminal.id },
      data: {
        device_id: deviceId,
        status: 'active',
        bound_at: new Date(),
        last_seen_at: new Date(),
        updated_at: new Date(),
      },
    });
    console.log(`   ✅ Terminal updated`);
    console.log(`   ✅ Device ID: ${updated.device_id}\n`);
    
    // Step 5: Mark code as used
    console.log('5️⃣  Marking code as used...');
    await prisma.activation_codes.update({
      where: { id: activationCode.id },
      data: { used: true },
    });
    console.log('   ✅ Code marked as used\n');
    
    // Step 6: Validate device binding
    console.log('6️⃣  Validating device binding...');
    const validated = await prisma.terminal_devices.findFirst({
      where: {
        device_id: deviceId,
        tenant_id: TENANT_ID,
      },
    });
    
    if (validated) {
      console.log(`   ✅ Device is bound to terminal: ${validated.terminal_id}\n`);
    } else {
      console.log('   ❌ Device binding failed\n');
    }
    
    console.log('✅ Activation flow test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
