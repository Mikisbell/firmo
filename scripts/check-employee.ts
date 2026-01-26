// scripts/check-employee.ts
// Check employee details

import prisma from '../src/core/db/prisma';
import { hashPin } from '../src/core/auth/auth.service';

async function checkEmployee() {
    console.log('\n👤 CHECKING EMPLOYEE DETAILS\n');
    console.log('============================================================\n');

    const testPin = '1234';
    const expectedHash = hashPin(testPin);

    console.log(`Expected PIN hash for "1234": ${expectedHash}\n`);

    // Find all employees with this PIN hash
    const employees = await prisma.employees.findMany({
        where: {
            pin_hash: expectedHash,
        },
    });

    console.log(`Found ${employees.length} employee(s) with PIN 1234:\n`);

    for (const emp of employees) {
        console.log(`Name: ${emp.name}`);
        console.log(`ID: ${emp.id}`);
        console.log(`Tenant ID: ${emp.tenant_id}`);
        console.log(`Role: ${emp.role}`);
        console.log(`Active: ${emp.is_active}`);
        console.log(`PIN Hash: ${emp.pin_hash}`);
        console.log('');
    }

    // Also check what tenant_id is being used in login attempts
    const recentAttempt = await prisma.login_attempts.findFirst({
        orderBy: { created_at: 'desc' },
    });

    if (recentAttempt) {
        console.log('Most recent login attempt:');
        console.log(`   Tenant ID: ${recentAttempt.tenant_id}`);
        console.log(`   PIN Hash: ${recentAttempt.pin_hash}`);
        console.log('');
    }

    console.log('============================================================\n');

    await prisma.$disconnect();
}

checkEmployee().catch((error) => {
    console.error('Error checking employee:', error);
    process.exit(1);
});
