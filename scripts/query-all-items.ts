import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const items = await prisma.order_item_projections.groupBy({
    by: ['name'],
    _sum: { qty: true },
    orderBy: { _sum: { qty: 'desc' } }
  });
  console.log('🍽️  Todos los platos en la BD:');
  items.forEach(i => console.log(`   - ${i.name}: ${i._sum.qty}`));
}
run().finally(() => prisma.$disconnect());
