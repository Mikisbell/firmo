#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const SALT = 'PARK_POS_2026_';

function hashPin(pin: string): string {
    return createHash('sha256').update(SALT + pin).digest('hex');
}

async function check() {
    const admin = await prisma.employees.findFirst({
        where: { role: 'ADMIN' }
    });

    console.log('\n🔍 Verificando PIN del Admin...\n');
    console.log('Admin encontrado:', admin?.name);
    console.log('ID:', admin?.id);
    console.log('\nPIN hash en DB:', admin?.pin_hash);
    console.log('PIN hash esperado (1234):', hashPin('1234'));
    console.log('\n¿Coinciden?:', admin?.pin_hash === hashPin('1234') ? '✅ SÍ' : '❌ NO');

    if (admin?.pin_hash !== hashPin('1234')) {
        console.log('\n⚠️  El PIN hash NO coincide. Actualizando...');
        await prisma.employees.update({
            where: { id: admin!.id },
            data: { pin_hash: hashPin('1234') }
        });
        console.log('✅ PIN actualizado correctamente');
    }

    await prisma.$disconnect();
}

check().catch(console.error);
