/**
 * Generate New Activation Code
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

async function generateCode() {
  try {
    // Generate random 6-digit code
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    
    console.log('Creating new activation code...');
    
    const activationCode = await prisma.activation_codes.create({
      data: {
        id: generateUUID(),
        terminal_id: 'TEST_CAJA_01',
        code: code,
        used: false,
        created_by: generateUUID(),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
    
    console.log(`✅ Code created: ${activationCode.code}`);
    console.log(`✅ Expires at: ${activationCode.expires_at}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateCode();
