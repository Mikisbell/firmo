import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const rs = await prisma.tables.findMany({ where: { number: '1' } });
  console.log('Mesa 1 ID:', rs);
  await prisma.$disconnect();
}
main().catch(console.error);
