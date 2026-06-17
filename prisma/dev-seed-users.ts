/**
 * dev-seed-users.ts
 * Garantiza que los usuarios de desarrollo existan con PINs conocidos
 * en el tenant real (DEFAULT_TENANT_ID).
 *
 * Uso: npx tsx prisma/dev-seed-users.ts
 *
 * Tabla de usuarios de desarrollo:
 * ┌─────────────────┬────────────┬─────────┬──────────────────┐
 * │ Nombre          │ Rol        │ PIN     │ Terminal         │
 * ├─────────────────┼────────────┼─────────┼──────────────────┤
 * │ Admin Principal │ ADMIN      │ 160902  │ Panel Admin      │
 * │ María García    │ CASHIER    │ 1111    │ CAJA_01 / POS    │
 * │ Carlos López    │ WAITER     │ 2222    │ MOZO_01          │
 * │ Ana Torres      │ WAITER     │ 3333    │ MOZO_02          │
 * │ Pedro Ruiz      │ KITCHEN    │ 4444    │ SPC_HORNO        │
 * │ Luis Mendoza    │ KITCHEN    │ 5555    │ SPC_COCINA       │
 * │ Rosa Flores     │ MANAGER    │ 0000    │ Admin / POS      │
 * │ Jorge Díaz      │ BAR        │ 6666    │ SPC_BAR          │
 * │ Carmen Vega     │ WAITER     │ 7777    │ MOZO_03          │
 * │ Miguel Soto     │ DRIVER     │ 8888    │ Delivery         │
 * │ Test E2E User   │ ADMIN      │ 9999    │ E2E tests        │
 * └─────────────────┴────────────┴─────────┴──────────────────┘
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

function hashPin(pin: string): string {
    return createHash('sha256').update(SALT + pin).digest('hex');
}

const DEV_EMPLOYEES = [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Admin Principal', role: 'ADMIN',   pin: '160902', dni: '43708661' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'María García',    role: 'CASHIER', pin: '1111' },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Carlos López',    role: 'WAITER',  pin: '2222' },
    { id: '00000000-0000-0000-0000-000000000008', name: 'Ana Torres',      role: 'WAITER',  pin: '3333' },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Pedro Ruiz',      role: 'KITCHEN', pin: '4444' },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Luis Mendoza',    role: 'KITCHEN', pin: '5555' },
    { id: '00000000-0000-0000-0000-000000000007', name: 'Rosa Flores',     role: 'MANAGER', pin: '0000' },
    { id: '00000000-0000-0000-0000-000000000006', name: 'Jorge Díaz',      role: 'BAR',     pin: '6666' },
    { id: '00000000-0000-0000-0000-000000000009', name: 'Carmen Vega',     role: 'WAITER',  pin: '7777' },
    { id: '00000000-0000-0000-0000-000000000010', name: 'Miguel Soto',     role: 'DRIVER',  pin: '8888' },
    { id: '00000000-0000-0000-0000-000000000099', name: 'Test E2E User',   role: 'ADMIN',   pin: '9999' },
] as const;

async function main() {
    console.log(`\n🌱 Dev seed — Tenant: ${TENANT_ID}\n`);

    let created = 0;
    let updated = 0;

    for (const emp of DEV_EMPLOYEES) {
        const pin_hash = hashPin(emp.pin);

        // Check if this exact ID exists (could be in another tenant from test seeds)
        const byId = await prisma.employees.findUnique({ where: { id: emp.id } });

        if (byId) {
            if (byId.tenant_id !== TENANT_ID) {
                // ID taken by another tenant's test data — generate a new UUID for this tenant
                // but still upsert by name+tenant for idempotency
                const byName = await prisma.employees.findFirst({
                    where: { tenant_id: TENANT_ID, name: emp.name },
                });

                if (byName) {
                    await prisma.employees.update({
                        where: { id: byName.id },
                        data: { pin_hash, is_active: true, role: emp.role },
                    });
                    updated++;
                    console.log(`  ↻ Updated  ${emp.role.padEnd(8)} | ${emp.name.padEnd(20)} | PIN: ${emp.pin}`);
                } else {
                    await prisma.employees.create({
                        data: {
                            id: uuidv4(),
                            tenant_id: TENANT_ID,
                            name: emp.name,
                            role: emp.role,
                            pin_hash,
                            is_active: true,
                            ...('dni' in emp && emp.dni ? { dni: emp.dni } : {}),
                        },
                    });
                    created++;
                    console.log(`  + Created  ${emp.role.padEnd(8)} | ${emp.name.padEnd(20)} | PIN: ${emp.pin}`);
                }
            } else {
                // Same tenant — just update pin_hash and is_active
                await prisma.employees.update({
                    where: { id: emp.id },
                    data: { pin_hash, is_active: true, role: emp.role },
                });
                updated++;
                console.log(`  ↻ Updated  ${emp.role.padEnd(8)} | ${emp.name.padEnd(20)} | PIN: ${emp.pin}`);
            }
        } else {
            // ID doesn't exist — create with the canonical ID
            await prisma.employees.create({
                data: {
                    id: emp.id,
                    tenant_id: TENANT_ID,
                    name: emp.name,
                    role: emp.role,
                    pin_hash,
                    is_active: true,
                    ...('dni' in emp && emp.dni ? { dni: emp.dni } : {}),
                },
            });
            created++;
            console.log(`  + Created  ${emp.role.padEnd(8)} | ${emp.name.padEnd(20)} | PIN: ${emp.pin}`);
        }
    }

    console.log(`\n✅ Done — ${created} creados, ${updated} actualizados`);
    console.log(`\n📋 Credenciales de desarrollo:`);
    console.log(`   Admin Panel:  Admin Principal  → PIN 160902`);
    console.log(`   Caja / POS:   María García     → PIN 1111`);
    console.log(`   Mozo:         Carlos López     → PIN 2222`);
    console.log(`   Cocina:       Luis Mendoza     → PIN 5555`);
    console.log(`   Manager:      Rosa Flores      → PIN 0000`);

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
