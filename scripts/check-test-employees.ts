import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmployees() {
  console.log('🔍 Verificando empleados de test...\n');
  
  const tenant1Id = '11111111-1111-1111-1111-111111111111';
  const tenant2Id = '22222222-2222-2222-2222-222222222222';
  
  const tenant1Employees = await prisma.employee.findMany({
    where: { tenant_id: tenant1Id },
    select: { id: true, name: true, role: true, is_active: true }
  });
  
  const tenant2Employees = await prisma.employee.findMany({
    where: { tenant_id: tenant2Id },
    select: { id: true, name: true, role: true, is_active: true }
  });
  
  console.log(`Tenant 1 (${tenant1Id}):`);
  console.log(`  Total: ${tenant1Employees.length} empleados`);
  tenant1Employees.forEach(e => console.log(`  - ${e.name} (${e.role}) - ${e.is_active ? 'Activo' : 'Inactivo'}`));
  
  console.log(`\nTenant 2 (${tenant2Id}):`);
  console.log(`  Total: ${tenant2Employees.length} empleados`);
  tenant2Employees.forEach(e => console.log(`  - ${e.name} (${e.role}) - ${e.is_active ? 'Activo' : 'Inactivo'}`));
  
  await prisma.$disconnect();
}

checkEmployees().catch(console.error);
