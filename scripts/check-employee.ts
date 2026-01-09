import { PrismaClient } from '@prisma/client';
import { hashPin } from '../src/core/auth/pin';

const prisma = new PrismaClient();

async function check() {
    // Check terminals
    const terminals = await prisma.terminals.findMany({ take: 10 });
    console.log("=== TERMINALS ===");
    terminals.forEach(t => {
        console.log(`  ${t.terminal_id} | station: ${t.station_id} | allowed: ${t.is_allowed}`);
    });

    // Check employees with PIN 1234
    const pin1234Hash = await hashPin('1234');
    console.log("\n=== PIN 1234 HASH ===");
    console.log(`  Hash: ${pin1234Hash}`);

    const employees = await prisma.employees.findMany({ 
        where: { is_active: true },
        take: 10 
    });
    console.log("\n=== EMPLOYEES (first 10) ===");
    employees.forEach(e => {
        console.log(`  ${e.name} | ${e.role} | pin_hash: ${e.pin_hash?.slice(0, 20)}...`);
    });

    // Find employee with PIN 1234
    const emp1234 = await prisma.employees.findFirst({
        where: { pin_hash: pin1234Hash, is_active: true }
    });
    console.log("\n=== EMPLOYEE WITH PIN 1234 ===");
    console.log(emp1234 ? `  Found: ${emp1234.name}` : "  NOT FOUND");

    await prisma.$disconnect();
}

check();
