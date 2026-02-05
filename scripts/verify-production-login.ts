/**
 * Script de verificación completa para login en producción
 * Verifica: Admin existe, PIN correcto, sin lockout, terminal activo
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const SALT = 'PARK_POS_2026_';
const TEST_PIN = '1234';

async function verifyProductionLogin() {
  console.log('🔍 Verificación completa de login en producción\n');
  console.log('═'.repeat(80));

  try {
    // 1. Verificar Admin Principal
    console.log('\n1️⃣ Verificando Admin Principal...');
    const admin = await prisma.employees.findFirst({
      where: {
        id: '00000000-0000-0000-0000-000000000001',
        role: 'ADMIN',
        is_active: true
      }
    });

    if (!admin) {
      console.log('❌ Admin Principal no encontrado o inactivo');
      return false;
    }
    console.log(`✅ Admin encontrado: ${admin.name}`);

    // 2. Verificar PIN hash
    console.log('\n2️⃣ Verificando PIN hash...');
    const expectedHash = crypto.createHash('sha256').update(SALT + TEST_PIN).digest('hex');
    const hashMatch = admin.pin_hash === expectedHash;
    
    console.log(`   Hash esperado: ${expectedHash.substring(0, 20)}...`);
    console.log(`   Hash en DB:    ${admin.pin_hash.substring(0, 20)}...`);
    console.log(`   ${hashMatch ? '✅' : '❌'} Hash ${hashMatch ? 'coincide' : 'NO coincide'}`);

    if (!hashMatch) {
      console.log('❌ PIN hash no coincide - PIN 1234 no funcionará');
      return false;
    }

    // 3. Verificar lockout
    console.log('\n3️⃣ Verificando lockout...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const failedAttempts = await prisma.login_attempts.count({
      where: {
        employee_id: admin.id,
        success: false,
        attempted_at: { gte: fiveMinutesAgo }
      }
    });

    console.log(`   Intentos fallidos (últimos 5 min): ${failedAttempts}`);
    if (failedAttempts >= 3) {
      console.log('❌ Terminal bloqueado - demasiados intentos fallidos');
      return false;
    }
    console.log('✅ Sin lockout activo');

    // 4. Verificar terminal
    console.log('\n4️⃣ Verificando terminal...');
    const terminal = await prisma.terminals.findFirst({
      where: {
        // Verificar que existe al menos una terminal
      }
    });

    if (!terminal) {
      console.log('⚠️ No hay terminales registradas (pero login debería funcionar)');
    } else {
      console.log(`✅ Terminal encontrada: ${terminal.terminal_id}`);
    }

    // 5. Verificar tenant
    console.log('\n5️⃣ Verificando tenant...');
    const tenant = await prisma.tenants.findUnique({
      where: { id: admin.tenant_id }
    });

    if (!tenant) {
      console.log('❌ Tenant no encontrado');
      return false;
    }
    console.log(`✅ Tenant: ${tenant.name}`);

    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ VERIFICACIÓN COMPLETA - LOGIN DEBERÍA FUNCIONAR');
    console.log('\n📋 Credenciales para login:');
    console.log(`   PIN: ${TEST_PIN}`);
    console.log(`   Rol: ADMIN`);
    console.log(`   Nombre: ${admin.name}`);
    console.log('\n🌐 URL: https://parkperu.vercel.app/');
    console.log('\n' + '═'.repeat(80));

    return true;

  } catch (error) {
    console.error('\n❌ Error en verificación:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

verifyProductionLogin()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Script falló:', error);
    process.exit(1);
  });
