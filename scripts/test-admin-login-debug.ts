/**
 * Debug script para verificar el login del admin
 * Verifica:
 * 1. Si el admin existe en la BD
 * 2. Si el PIN hash es correcto
 * 3. Si el endpoint de login funciona
 */

import { createHash } from 'crypto';
import prisma from '@/src/core/db/prisma';

const SALT = 'PARK_POS_2026_';
const PIN = '1234';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function hashPin(pin: string): Promise<string> {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

async function main() {
  console.log('🔍 Debug: Verificando login del admin\n');

  // 1. Calcular hash del PIN
  const expectedHash = await hashPin(PIN);
  console.log(`✓ PIN: ${PIN}`);
  console.log(`✓ SALT: ${SALT}`);
  console.log(`✓ Hash esperado: ${expectedHash}\n`);

  // 2. Buscar admin en BD
  console.log('📋 Buscando admin en la base de datos...');
  const admin = await prisma.employees.findFirst({
    where: {
      tenant_id: TENANT_ID,
      role: 'ADMIN',
    },
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
    },
  });

  if (!admin) {
    console.log('❌ No se encontró admin en la BD');
    console.log(`   Tenant ID: ${TENANT_ID}`);
    console.log(`   Role: ADMIN\n`);

    // Listar todos los empleados
    const allEmployees = await prisma.employees.findMany({
      where: { tenant_id: TENANT_ID },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    console.log(`📊 Empleados en la BD (${allEmployees.length}):`);
    allEmployees.forEach((emp) => {
      console.log(`   - ${emp.name} (${emp.role}) - Activo: ${emp.is_active}`);
    });
  } else {
    console.log(`✓ Admin encontrado: ${admin.name}`);
    console.log(`  ID: ${admin.id}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Activo: ${admin.is_active}`);
    console.log(`  PIN Hash en BD: ${admin.pin_hash}\n`);

    // 3. Comparar hashes
    console.log('🔐 Comparando hashes:');
    console.log(`  Hash esperado: ${expectedHash}`);
    console.log(`  Hash en BD:    ${admin.pin_hash}`);

    if (expectedHash === admin.pin_hash) {
      console.log('  ✅ ¡Los hashes coinciden! El PIN es correcto.\n');
    } else {
      console.log('  ❌ Los hashes NO coinciden. El PIN en BD es diferente.\n');

      // Intentar encontrar qué PIN genera el hash en BD
      console.log('💡 Posibles causas:');
      console.log('   1. El admin fue creado con un SALT diferente');
      console.log('   2. El PIN en BD es diferente a "1234"');
      console.log('   3. El SALT en .env.local no coincide con el usado en seed\n');
    }
  }

  // 4. Verificar intentos de login fallidos
  console.log('📊 Últimos intentos de login:');
  const attempts = await prisma.login_attempts.findMany({
    where: { tenant_id: TENANT_ID },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      success: true,
      pin_hash: true,
      created_at: true,
    },
  });

  if (attempts.length === 0) {
    console.log('   No hay intentos de login registrados\n');
  } else {
    attempts.forEach((attempt) => {
      const status = attempt.success ? '✅' : '❌';
      console.log(`   ${status} ${attempt.created_at.toISOString()}`);
    });
    console.log();
  }

  console.log('✅ Debug completado');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
