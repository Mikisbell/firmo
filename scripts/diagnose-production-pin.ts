/**
 * Script para diagnosticar el problema del PIN en producción
 * Compara hashes locales vs producción
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function diagnosePinIssue() {
  console.log('🔍 Diagnóstico del Problema de PIN\n');
  console.log('═'.repeat(80));

  const PIN = '1234';
  const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

  // 1. Verificar SALT local
  console.log('\n1️⃣ Verificando SALT local:');
  const localSalt = process.env.PIN_SALT || 'PARK_POS_2026_';
  console.log(`   PIN_SALT: "${localSalt}"`);

  // 2. Calcular hash local
  console.log('\n2️⃣ Calculando hash local:');
  const localHash = crypto.createHash('sha256').update(localSalt + PIN).digest('hex');
  console.log(`   Hash calculado: ${localHash}`);

  // 3. Obtener hash de producción
  console.log('\n3️⃣ Obteniendo hash de producción:');
  const admin = await prisma.employees.findUnique({
    where: { id: ADMIN_ID },
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
    },
  });

  if (!admin) {
    console.log('   ❌ Admin no encontrado');
    return;
  }

  console.log(`   Nombre: ${admin.name}`);
  console.log(`   Rol: ${admin.role}`);
  console.log(`   Activo: ${admin.is_active}`);
  console.log(`   Hash en DB: ${admin.pin_hash}`);

  // 4. Comparar hashes
  console.log('\n4️⃣ Comparando hashes:');
  const hashMatch = localHash === admin.pin_hash;
  console.log(`   Local:  ${localHash}`);
  console.log(`   DB:     ${admin.pin_hash}`);
  console.log(`   Match:  ${hashMatch ? '✅ SÍ' : '❌ NO'}`);

  if (!hashMatch) {
    console.log('\n⚠️ PROBLEMA ENCONTRADO:');
    console.log('   El hash local NO coincide con el hash en producción.');
    console.log('   Esto significa que el PIN_SALT en Vercel es diferente.');
    console.log('\n💡 SOLUCIÓN:');
    console.log('   1. Verificar PIN_SALT en Vercel environment variables');
    console.log('   2. Debe ser exactamente: "PARK_POS_2026_"');
    console.log('   3. O regenerar el hash del admin con el SALT correcto');
  }

  // 5. Verificar intentos fallidos
  console.log('\n5️⃣ Verificando intentos fallidos recientes:');
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const failedAttempts = await prisma.login_attempts.findMany({
    where: {
      employee_id: ADMIN_ID,
      success: false,
      attempted_at: { gte: fiveMinutesAgo },
    },
    orderBy: { attempted_at: 'desc' },
    take: 5,
  });

  console.log(`   Intentos fallidos (últimos 5 min): ${failedAttempts.length}`);
  if (failedAttempts.length > 0) {
    console.log('   Últimos intentos:');
    failedAttempts.forEach((attempt, i) => {
      console.log(`     ${i + 1}. ${attempt.attempted_at.toISOString()} - Hash: ${attempt.pin_hash.substring(0, 20)}...`);
    });
  }

  // 6. Calcular hash con diferentes SALTs comunes
  console.log('\n6️⃣ Probando SALTs comunes:');
  const commonSalts = [
    'PARK_POS_2026_',
    'dev-pin-salt-for-local-testing-only-change-in-production',
    '',
    'PARK_POS_',
  ];

  for (const salt of commonSalts) {
    const testHash = crypto.createHash('sha256').update(salt + PIN).digest('hex');
    const matches = testHash === admin.pin_hash;
    console.log(`   SALT: "${salt}"`);
    console.log(`   Hash: ${testHash.substring(0, 40)}...`);
    console.log(`   Match: ${matches ? '✅ SÍ' : '❌ NO'}`);
    if (matches) {
      console.log(`   🎯 ENCONTRADO! El SALT correcto es: "${salt}"`);
    }
    console.log();
  }

  console.log('═'.repeat(80));

  await prisma.$disconnect();
}

diagnosePinIssue()
  .then(() => {
    console.log('\n✅ Diagnóstico completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
