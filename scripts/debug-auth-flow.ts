// scripts/debug-auth-flow.ts
// Debug the complete authentication flow

import prisma from '../src/core/db/prisma';
import { hashPin } from '../src/core/auth/auth.service';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_PIN = '1234';

async function debugAuthFlow() {
    console.log('\n🔍 DEBUGGING AUTHENTICATION FLOW\n');
    console.log('============================================================\n');

    // Step 1: Hash the PIN
    const pinHash = hashPin(TEST_PIN);
    console.log(`1. PIN Hash Generation:`);
    console.log(`   Input PIN: "${TEST_PIN}"`);
    console.log(`   Generated Hash: ${pinHash}\n`);

    // Step 2: Find employee with this hash
    console.log(`2. Database Lookup:`);
    const employee = await prisma.employees.findFirst({
        where: {
            tenant_id: TENANT_ID,
            pin_hash: pinHash,
        },
        select: {
            id: true,
            name: true,
            role: true,
            is_active: true,
            pin_hash: true,
        },
    });

    if (employee) {
        console.log(`   ✅ Employee found!`);
        console.log(`   Name: ${employee.name}`);
        console.log(`   Role: ${employee.role}`);
        console.log(`   Active: ${employee.is_active}`);
        console.log(`   PIN Hash in DB: ${employee.pin_hash}`);
        console.log(`   Hashes match: ${employee.pin_hash === pinHash ? '✅ YES' : '❌ NO'}\n`);
    } else {
        console.log(`   ❌ No employee found with this PIN hash\n`);
        
        // Check if there's an employee with a different hash
        const allEmployees = await prisma.employees.findMany({
            where: { tenant_id: TENANT_ID },
            select: { id: true, name: true, role: true, pin_hash: true },
        });
        
        console.log(`   Found ${allEmployees.length} employees in tenant:`);
        for (const emp of allEmployees) {
            console.log(`   - ${emp.name} (${emp.role}): ${emp.pin_hash?.substring(0, 16)}...`);
        }
        console.log('');
    }

    // Step 3: Check recent login attempts
    console.log(`3. Recent Login Attempts:`);
    const recentAttempts = await prisma.login_attempts.findMany({
        where: {
            tenant_id: TENANT_ID,
            created_at: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
    });

    console.log(`   Found ${recentAttempts.length} attempts in last 10 minutes:`);
    for (const attempt of recentAttempts) {
        const time = attempt.created_at.toLocaleTimeString('es-PE');
        const status = attempt.success ? '✅' : '❌';
        console.log(`   ${status} ${time} - Hash: ${attempt.pin_hash?.substring(0, 16)}...`);
    }

    console.log('\n============================================================\n');

    await prisma.$disconnect();
}

debugAuthFlow().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
