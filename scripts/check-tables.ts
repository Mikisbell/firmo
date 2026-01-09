import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        // Check if tables exist by trying to count
        const loginAttempts = await prisma.login_attempts.count();
        console.log('login_attempts count:', loginAttempts);
        
        const adminLogs = await prisma.admin_access_logs.count();
        console.log('admin_access_logs count:', adminLogs);
        
        const sessions = await prisma.sessions.count();
        console.log('sessions count:', sessions);
        
        // Check employees
        const employees = await prisma.employees.findMany({ take: 5 });
        console.log('Employees:', employees.map(e => ({ name: e.name, role: e.role, pin_hash: e.pin_hash?.slice(0, 10) })));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

check();
