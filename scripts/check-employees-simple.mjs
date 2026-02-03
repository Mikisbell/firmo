import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employees.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      pin_hash: true,
      is_active: true,
      tenant_id: true,
    },
    take: 20,
  });

  console.log('Empleados en la base de datos:');
  console.log(JSON.stringify(employees, null, 2));
  
  console.log(`\nTotal: ${employees.length} empleados`);
  
  // Check if admin exists
  const admin = employees.find(e => e.role === 'ADMIN');
  if (admin) {
    console.log('\n✅ ADMIN encontrado:');
    console.log(`  Name: ${admin.name}`);
    console.log(`  PIN Hash: ${admin.pin_hash}`);
    console.log(`  Active: ${admin.is_active}`);
  } else {
    console.log('\n❌ No ADMIN encontrado');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
