import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.employees.findFirst({
    where: { role: { in: ['ADMIN', 'OWNER', 'MANAGER'] } }
  });
  console.log('Admin:', admin ? { id: admin.id, role: admin.role, tenant: admin.tenant_id } : null);

  if (admin && admin.tenant_id !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') {
    await prisma.employees.update({
      where: { id: admin.id },
      data: { tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    });
    console.log('Admin tenant_id updated to match locations!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
