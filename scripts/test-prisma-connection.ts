#!/usr/bin/env npx tsx

/**
 * Test Prisma Connection
 */

import { PrismaClient } from '@prisma/client';

async function test() {
  console.log('\n🔐 Testing Prisma connection...\n');

  const prisma = new PrismaClient();

  try {
    console.log('Connecting...\n');
    
    // Test query
    const result = await prisma.$queryRaw`SELECT current_user, current_database()`;
    console.log('✅ Connected!\n');
    console.log('Query result:', result);
    console.log();

  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

test().catch(console.error);
