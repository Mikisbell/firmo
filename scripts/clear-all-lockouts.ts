/**
 * Clear ALL login lockouts for ALL tenants
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔓 CLEARING ALL LOGIN LOCKOUTS FOR ALL TENANTS');
  console.log('='.repeat(60));

  // Delete ALL login attempts for ALL tenants
  const result = await prisma.login_attempts.deleteMany({});

  console.log(`✅ Deleted ${result.count} login attempts across all tenants`);
  console.log('✅ All lockouts cleared! You can now try logging in again.');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error clearing lockouts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
