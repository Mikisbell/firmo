/**
 * Create Test Terminal for Device ID Testing
 */

import prisma from '@/src/core/db/prisma';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createTestTerminal() {
  const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  
  try {
    console.log('Creating test terminal...');
    
    const terminal = await prisma.terminal_devices.create({
      data: {
        id: generateUUID(),
        tenant_id: TENANT_ID,
        terminal_id: 'TEST_CAJA_01',
        role: 'CASHIER',
        location_id: 'LOC01',
        device_name: 'Test Terminal',
        status: 'inactive',
        fingerprint_salt: 'test-salt-001',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    
    console.log('✅ Terminal created:', terminal.terminal_id);
    
    // Create activation code
    const code = await prisma.activation_codes.create({
      data: {
        id: generateUUID(),
        tenant_id: TENANT_ID,
        terminal_id: 'TEST_CAJA_01',
        code: '123456',
        used: false,
        created_by: 'system',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    
    console.log('✅ Activation code created:', code.code);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestTerminal();
