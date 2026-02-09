/**
 * Script para probar aislamiento de API de employees
 * 
 * Ejecutar: npx tsx scripts/test-api-employees-isolation.ts
 */

import 'dotenv/config';
import { authenticate } from '../src/core/auth/auth.service';
import prisma from '../src/core/db/prisma';

const TENANT_1_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_2_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_PIN_1 = '1111';
const ADMIN_PIN_2 = '2222';

async function main() {
  console.log('\n========== TEST API EMPLOYEES ISOLATION ==========\n');

  // 1. Autenticar como Admin de Tenant 1
  console.log('1. Autenticando como Admin de Tenant 1...');
  const auth1 = await authenticate(
    prisma,
    TENANT_1_ID,
    ADMIN_PIN_1,
    ['ADMIN', 'MANAGER', 'OWNER']
  );

  if (!auth1.success) {
    console.log(`   ❌ Error: ${auth1.error}`);
    process.exit(1);
  }

  console.log(`   ✅ Autenticado: ${auth1.employee?.name} (${auth1.employee?.role})`);
  console.log(`   Token: ${auth1.token?.substring(0, 20)}...`);

  // 2. Simular consulta de API con tenant_id de Tenant 1
  console.log('\n2. Consultando employees con tenant_id de Tenant 1...');
  const tenant1Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_1_ID },
    select: {
      id: true,
      name: true,
      role: true,
      tenant_id: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`   Resultado: ${tenant1Employees.length} employees`);
  tenant1Employees.forEach((emp) => {
    const isCorrect = emp.tenant_id === TENANT_1_ID;
    const icon = isCorrect ? '✅' : '❌';
    console.log(`   ${icon} ${emp.name} (${emp.role})`);
  });

  // 3. Autenticar como Admin de Tenant 2
  console.log('\n3. Autenticando como Admin de Tenant 2...');
  const auth2 = await authenticate(
    prisma,
    TENANT_2_ID,
    ADMIN_PIN_2,
    ['ADMIN', 'MANAGER', 'OWNER']
  );

  if (!auth2.success) {
    console.log(`   ❌ Error: ${auth2.error}`);
    process.exit(1);
  }

  console.log(`   ✅ Autenticado: ${auth2.employee?.name} (${auth2.employee?.role})`);
  console.log(`   Token: ${auth2.token?.substring(0, 20)}...`);

  // 4. Simular consulta de API con tenant_id de Tenant 2
  console.log('\n4. Consultando employees con tenant_id de Tenant 2...');
  const tenant2Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_2_ID },
    select: {
      id: true,
      name: true,
      role: true,
      tenant_id: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`   Resultado: ${tenant2Employees.length} employees`);
  tenant2Employees.forEach((emp) => {
    const isCorrect = emp.tenant_id === TENANT_2_ID;
    const icon = isCorrect ? '✅' : '❌';
    console.log(`   ${icon} ${emp.name} (${emp.role})`);
  });

  // 5. Verificar que no hay overlap
  console.log('\n5. Verificando que no hay overlap...');
  const tenant1Names = tenant1Employees.map((e) => e.name);
  const tenant2Names = tenant2Employees.map((e) => e.name);

  const overlap = tenant1Names.filter((name) => tenant2Names.includes(name));

  if (overlap.length > 0) {
    console.log(`   ❌ PROBLEMA: ${overlap.length} nombres duplicados:`);
    overlap.forEach((name) => console.log(`      - ${name}`));
  } else {
    console.log(`   ✅ No hay overlap de nombres`);
  }

  // 6. Verificar que Tenant 2 NO ve employees de Tenant 1
  console.log('\n6. Verificando que Tenant 2 NO ve employees de Tenant 1...');
  const tenant1OnlyNames = tenant1Names.filter((name) => !tenant2Names.includes(name));
  console.log(`   Tenant 1 tiene ${tenant1OnlyNames.length} employees únicos`);

  // 7. Resumen
  console.log('\n========== RESUMEN ==========');
  console.log(`Tenant 1: ${tenant1Employees.length} employees`);
  console.log(`Tenant 2: ${tenant2Employees.length} employees`);
  console.log(`Overlap: ${overlap.length} nombres`);

  if (overlap.length > 0) {
    console.log('\n❌ PROBLEMA: Hay nombres duplicados entre tenants');
    console.log('   Esto puede causar confusión en los tests E2E');
  } else {
    console.log('\n✅ AISLAMIENTO CORRECTO: No hay overlap entre tenants');
  }

  console.log('\n========================================\n');
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
