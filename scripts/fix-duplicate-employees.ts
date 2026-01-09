import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = 'PARK_POS_2026_';

// Canonical employees with correct data
const EMPLOYEES = [
    { id: "00000000-0000-0000-0000-000000000001", name: "Admin Principal", role: "ADMIN", pin: "1234" },
    { id: "00000000-0000-0000-0000-000000000002", name: "María García", role: "CASHIER", pin: "1111" },
    { id: "00000000-0000-0000-0000-000000000003", name: "Carlos López", role: "WAITER", pin: "2222" },
    { id: "00000000-0000-0000-0000-000000000008", name: "Ana Torres", role: "WAITER", pin: "3333" },
    { id: "00000000-0000-0000-0000-000000000005", name: "Pedro Ruiz", role: "KITCHEN", pin: "4444" },
    { id: "00000000-0000-0000-0000-000000000004", name: "Luis Mendoza", role: "KITCHEN", pin: "5555" },
    { id: "00000000-0000-0000-0000-000000000007", name: "Rosa Flores", role: "MANAGER", pin: "0000" },
    { id: "00000000-0000-0000-0000-000000000006", name: "Jorge Díaz", role: "BAR", pin: "6666" },
    { id: "00000000-0000-0000-0000-000000000009", name: "Carmen Vega", role: "WAITER", pin: "7777" },
    { id: "00000000-0000-0000-0000-000000000010", name: "Miguel Soto", role: "DELIVERY", pin: "8888" },
];

function hashPin(pin: string): string {
    return createHash('sha256').update(SALT + pin).digest('hex');
}

async function main() {
    console.log('🧹 Fixing duplicate employees...\n');
    
    // 1. Get all employees
    const allEmployees = await prisma.employees.findMany({
        where: { tenant_id: TENANT_ID },
        select: { id: true, name: true, role: true }
    });
    console.log(`Found ${allEmployees.length} employees`);
    
    // 2. Group by name to find duplicates
    const byName = new Map<string, string[]>();
    for (const emp of allEmployees) {
        const ids = byName.get(emp.name) || [];
        ids.push(emp.id);
        byName.set(emp.name, ids);
    }
    
    // 3. For each canonical employee, keep one and delete extras
    for (const emp of EMPLOYEES) {
        const existingIds = byName.get(emp.name) || [];
        
        if (existingIds.length === 0) {
            // Create new
            await prisma.employees.create({
                data: {
                    id: emp.id,
                    tenant_id: TENANT_ID,
                    name: emp.name,
                    role: emp.role,
                    pin_hash: hashPin(emp.pin),
                    is_active: true,
                }
            });
            console.log(`✅ Created: ${emp.name} (${emp.role})`);
        } else {
            // Update first one with correct data
            const keepId = existingIds[0];
            await prisma.employees.update({
                where: { id: keepId },
                data: {
                    role: emp.role,
                    pin_hash: hashPin(emp.pin),
                    is_active: true,
                }
            });
            console.log(`✅ Updated: ${emp.name} (${emp.role})`);
            
            // Delete extras (if no FK constraints)
            for (let i = 1; i < existingIds.length; i++) {
                try {
                    await prisma.employees.delete({ where: { id: existingIds[i] } });
                    console.log(`   🗑️ Deleted duplicate: ${existingIds[i].slice(0, 8)}...`);
                } catch {
                    // FK constraint - just deactivate
                    await prisma.employees.update({
                        where: { id: existingIds[i] },
                        data: { is_active: false }
                    });
                    console.log(`   ⚠️ Deactivated duplicate: ${existingIds[i].slice(0, 8)}...`);
                }
            }
        }
    }
    
    // 4. Verify
    const active = await prisma.employees.count({ 
        where: { tenant_id: TENANT_ID, is_active: true } 
    });
    console.log(`\n✅ Active employees: ${active}`);
    
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
