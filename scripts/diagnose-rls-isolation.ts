/**
 * Script de diagnóstico para investigar problema de aislamiento RLS
 * 
 * Ejecutar: npx tsx scripts/diagnose-rls-isolation.ts
 */

import prisma from '../src/core/db/prisma';

const TENANT_1_ID = '11111111-1111-1111-1111-111111111111';
const TENANT_2_ID = '22222222-2222-2222-2222-222222222222';

async function main() {
  console.log('\n========== DIAGNÓSTICO RLS ISOLATION ==========\n');

  // 1. Verificar que existen ambos tenants
  console.log('1. Verificando tenants...');
  const tenant1 = await prisma.tenants.findUnique({
    where: { id: TENANT_1_ID },
  });
  const tenant2 = await prisma.tenants.findUnique({
    where: { id: TENANT_2_ID },
  });

  console.log(`   Tenant 1: ${tenant1 ? '✅ Existe' : '❌ NO existe'}`);
  console.log(`   Tenant 2: ${tenant2 ? '✅ Existe' : '❌ NO existe'}`);

  if (!tenant1 || !tenant2) {
    console.log('\n❌ ERROR: Faltan tenants. Ejecutar: npx tsx scripts/provision-e2e-test-tenants.ts');
    process.exit(1);
  }

  // 2. Contar employees por tenant
  console.log('\n2. Contando employees por tenant...');
  const tenant1EmployeesCount = await prisma.employees.count({
    where: { tenant_id: TENANT_1_ID },
  });
  const tenant2EmployeesCount = await prisma.employees.count({
    where: { tenant_id: TENANT_2_ID },
  });

  console.log(`   Tenant 1: ${tenant1EmployeesCount} employees`);
  console.log(`   Tenant 2: ${tenant2EmployeesCount} employees`);

  // 3. Listar employees de Tenant 1
  console.log('\n3. Employees de Tenant 1:');
  const tenant1Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_1_ID },
    select: {
      id: true,
      name: true,
      role: true,
      tenant_id: true,
    },
  });

  tenant1Employees.forEach((emp) => {
    console.log(`   - ${emp.name} (${emp.role}) [tenant: ${emp.tenant_id}]`);
  });

  // 4. Listar employees de Tenant 2
  console.log('\n4. Employees de Tenant 2:');
  const tenant2Employees = await prisma.employees.findMany({
    where: { tenant_id: TENANT_2_ID },
    select: {
      id: true,
      name: true,
      role: true,
      tenant_id: true,
    },
  });

  tenant2Employees.forEach((emp) => {
    console.log(`   - ${emp.name} (${emp.role}) [tenant: ${emp.tenant_id}]`);
  });

  // 5. Verificar si hay employees sin tenant_id
  console.log('\n5. Verificando employees sin tenant_id...');
  const employeesWithoutTenant = await prisma.employees.count({
    where: { tenant_id: null },
  });

  console.log(`   Employees sin tenant_id: ${employeesWithoutTenant}`);

  // 6. Verificar si hay employees con tenant_id incorrecto
  console.log('\n6. Verificando employees con tenant_id incorrecto...');
  const allEmployees = await prisma.employees.findMany({
    select: {
      id: true,
      name: true,
      tenant_id: true,
    },
  });

  const invalidTenantIds = allEmployees.filter(
    (emp) => emp.tenant_id !== TENANT_1_ID && emp.tenant_id !== TENANT_2_ID
  );

  if (invalidTenantIds.length > 0) {
    console.log(`   ⚠️ Encontrados ${invalidTenantIds.length} employees con tenant_id inválido:`);
    invalidTenantIds.forEach((emp) => {
      console.log(`      - ${emp.name} [tenant: ${emp.tenant_id}]`);
    });
  } else {
    console.log(`   ✅ Todos los employees tienen tenant_id válido`);
  }

  // 7. Simular consulta de API con filtro de tenant
  console.log('\n7. Simulando consulta de API con filtro de tenant...');
  console.log('   WHERE: { tenant_id: TENANT_1_ID }');
  
  const apiResult = await prisma.employees.findMany({
    where: { tenant_id: TENANT_1_ID },
    select: {
      id: true,
      name: true,
      role: true,
      tenant_id: true,
    },
  });

  console.log(`   Resultado: ${apiResult.length} employees`);
  apiResult.forEach((emp) => {
    const isCorrectTenant = emp.tenant_id === TENANT_1_ID;
    const icon = isCorrectTenant ? '✅' : '❌';
    console.log(`   ${icon} ${emp.name} (${emp.role}) [tenant: ${emp.tenant_id}]`);
  });

  // 8. Verificar si hay problema de caché
  console.log('\n8. Verificando caché...');
  console.log('   (Este script no usa caché, consulta directa a DB)');

  // 9. Verificar productos
  console.log('\n9. Verificando productos...');
  const tenant1ProductsCount = await prisma.products.count({
    where: { tenant_id: TENANT_1_ID },
  });
  const tenant2ProductsCount = await prisma.products.count({
    where: { tenant_id: TENANT_2_ID },
  });

  console.log(`   Tenant 1: ${tenant1ProductsCount} productos`);
  console.log(`   Tenant 2: ${tenant2ProductsCount} productos`);

  // 10. Resumen
  console.log('\n========== RESUMEN ==========');
  console.log(`Tenant 1: ${tenant1EmployeesCount} employees, ${tenant1ProductsCount} productos`);
  console.log(`Tenant 2: ${tenant2EmployeesCount} employees, ${tenant2ProductsCount} productos`);
  console.log(`Employees sin tenant: ${employeesWithoutTenant}`);
  console.log(`Employees con tenant inválido: ${invalidTenantIds.length}`);

  if (apiResult.some((emp) => emp.tenant_id !== TENANT_1_ID)) {
    console.log('\n❌ PROBLEMA DETECTADO: La consulta con filtro de tenant retorna datos de otro tenant');
  } else {
    console.log('\n✅ CONSULTA CORRECTA: La consulta con filtro de tenant solo retorna datos del tenant correcto');
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
