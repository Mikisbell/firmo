// scripts/check-login-attempts.ts
// Check all login attempts in database

import prisma from '../src/core/db/prisma';

async function checkLoginAttempts() {
    console.log('\n🔍 CHECKING LOGIN ATTEMPTS\n');
    console.log('============================================================\n');

    // Get all login attempts (last 24 hours)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const attempts = await prisma.login_attempts.findMany({
        where: {
            created_at: { gte: since },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
    });

    console.log(`Found ${attempts.length} login attempts in last 24 hours:\n`);

    for (const attempt of attempts) {
        const time = attempt.created_at.toLocaleTimeString('es-PE');
        const status = attempt.success ? '✅ Success' : '❌ Failed';
        console.log(`${time} - ${status}`);
        console.log(`   Tenant: ${attempt.tenant_id}`);
        console.log(`   Employee: ${attempt.employee_id || 'N/A'}`);
        console.log(`   PIN Hash: ${attempt.pin_hash?.substring(0, 16)}...`);
        console.log(`   IP: ${attempt.ip_address || 'N/A'}`);
        console.log('');
    }

    // Check for any lockouts
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentFailed = attempts.filter(a => !a.success && a.created_at >= fiveMinutesAgo);
    
    if (recentFailed.length >= 3) {
        console.log('⚠️  WARNING: 3+ failed attempts in last 5 minutes - account may be locked\n');
    }

    console.log('============================================================\n');

    await prisma.$disconnect();
}

checkLoginAttempts().catch((error) => {
    console.error('Error checking login attempts:', error);
    process.exit(1);
});
