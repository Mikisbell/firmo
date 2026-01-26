#!/usr/bin/env node
/**
 * Test de Autenticación - Login Flow
 * 
 * Prueba el flujo completo de login:
 * 1. Hash del PIN en cliente vs servidor
 * 2. Llamada a API de login
 * 3. Verificación de respuesta
 */

import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SALT = 'PARK_POS_2026_';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Simular hash del servidor (Node.js crypto)
function hashPinServer(pin: string): string {
    return createHash('sha256').update(SALT + pin).digest('hex');
}

// Simular hash del cliente (Web Crypto API)
async function hashPinClient(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(SALT + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function testAuthFlow() {
    console.log('\n🧪 TEST DE AUTENTICACIÓN - LOGIN FLOW\n');
    console.log('='.repeat(60));

    // Test 1: Comparar hashes
    console.log('\n1️⃣  TEST: Comparación de Hashes\n');
    
    const testPin = '1234';
    const serverHash = hashPinServer(testPin);
    const clientHash = await hashPinClient(testPin);
    
    console.log(`PIN de prueba: ${testPin}`);
    console.log(`Hash servidor (Node.js): ${serverHash}`);
    console.log(`Hash cliente (Web Crypto): ${clientHash}`);
    console.log(`¿Coinciden?: ${serverHash === clientHash ? '✅ SÍ' : '❌ NO'}`);

    if (serverHash !== clientHash) {
        console.log('\n⚠️  PROBLEMA DETECTADO: Los hashes NO coinciden');
        console.log('   Causa: Diferencia entre Node.js crypto y Web Crypto API');
        console.log('   Solución: El cliente debe enviar el PIN sin hashear');
    }

    // Test 2: Verificar admin en DB
    console.log('\n2️⃣  TEST: Verificación de Admin en DB\n');
    
    const admin = await prisma.employees.findFirst({
        where: { 
            tenant_id: TENANT_ID,
            role: 'ADMIN' 
        }
    });

    if (!admin) {
        console.log('❌ Admin NO encontrado en DB');
        await prisma.$disconnect();
        return;
    }

    console.log(`✅ Admin encontrado: ${admin.name}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Active: ${admin.is_active}`);
    console.log(`   PIN hash en DB: ${admin.pin_hash}`);

    // Test 3: Verificar coincidencia con hash del servidor
    console.log('\n3️⃣  TEST: Verificación de PIN\n');
    
    const pinHashMatch = admin.pin_hash === serverHash;
    console.log(`Hash en DB coincide con servidor: ${pinHashMatch ? '✅ SÍ' : '❌ NO'}`);

    if (!pinHashMatch) {
        console.log('\n⚠️  PROBLEMA: El hash en DB no coincide con el esperado');
        console.log('   Actualizando hash en DB...');
        
        await prisma.employees.update({
            where: { id: admin.id },
            data: { pin_hash: serverHash }
        });
        
        console.log('   ✅ Hash actualizado correctamente');
    }

    // Test 4: Simular llamada a API
    console.log('\n4️⃣  TEST: Simulación de Login API\n');
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_id: TENANT_ID,
                pin: testPin,
            }),
        });

        const data = await response.json();

        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ LOGIN EXITOSO');
            console.log(`   Employee: ${data.employee?.name}`);
            console.log(`   Role: ${data.employee?.role}`);
            console.log(`   Token: ${data.token ? 'Generado ✅' : 'No generado ❌'}`);
        } else {
            console.log('\n❌ LOGIN FALLIDO');
            console.log(`   Error: ${data.error}`);
            console.log(`   Error Code: ${data.errorCode}`);
        }
    } catch (error) {
        console.log('\n❌ ERROR EN LLAMADA A API');
        console.log(`   ${error instanceof Error ? error.message : 'Error desconocido'}`);
        console.log('\n💡 Asegúrate de que el servidor esté corriendo:');
        console.log('   npm run dev');
    }

    // Test 5: Verificar intentos fallidos
    console.log('\n5️⃣  TEST: Verificación de Intentos Fallidos\n');
    
    const recentAttempts = await prisma.login_attempts.findMany({
        where: {
            tenant_id: TENANT_ID,
            created_at: {
                gte: new Date(Date.now() - 10 * 60 * 1000) // Últimos 10 minutos
            }
        },
        orderBy: { created_at: 'desc' },
        take: 10
    });

    console.log(`Intentos recientes (últimos 10 min): ${recentAttempts.length}`);
    
    if (recentAttempts.length > 0) {
        console.log('\nÚltimos intentos:');
        recentAttempts.forEach((attempt, i) => {
            const status = attempt.success ? '✅ Éxito' : '❌ Fallo';
            const time = new Date(attempt.created_at).toLocaleTimeString('es-PE');
            console.log(`   ${i + 1}. ${time} - ${status} - Employee: ${attempt.employee_id || 'N/A'}`);
        });

        const failedAttempts = recentAttempts.filter(a => !a.success);
        if (failedAttempts.length >= 3) {
            console.log(`\n⚠️  ADVERTENCIA: ${failedAttempts.length} intentos fallidos detectados`);
            console.log('   La cuenta puede estar bloqueada temporalmente');
        }
    } else {
        console.log('   No hay intentos recientes');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETADO\n');

    await prisma.$disconnect();
}

// Ejecutar tests
testAuthFlow().catch((error) => {
    console.error('\n❌ ERROR EN TEST:', error);
    process.exit(1);
});
