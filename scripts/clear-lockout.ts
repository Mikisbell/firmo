// scripts/clear-lockout.ts
// Clear login lockout and failed attempts

import prisma from '../src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function clearLockout() {
    console.log('\n🔓 CLEARING LOGIN LOCKOUT\n');
    console.log('============================================================\n');

    // Delete all login attempts for this tenant
    const deleted = await prisma.login_attempts.deleteMany({
        where: {
            tenant_id: TENANT_ID,
        },
    });

    console.log(`✅ Deleted ${deleted.count} login attempts`);
    console.log('\n✅ Lockout cleared! You can now try logging in again.\n');
    console.log('============================================================\n');

    await prisma.$disconnect();
}

clearLockout().catch((error) => {
    console.error('Error clearing lockout:', error);
    process.exit(1);
});
