import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const pollos = await prisma.order_item_projections.aggregate({
    _sum: { qty: true },
    where: { name: { contains: 'pollo', mode: 'insensitive' } }
  });
  console.log('🍗 Total de pollos pedidos (cantidad global):', pollos._sum.qty || 0);

  const items = await prisma.order_item_projections.groupBy({
    by: ['name'],
    _sum: { qty: true },
    where: { name: { contains: 'pollo', mode: 'insensitive' } },
    orderBy: { _sum: { qty: 'desc' } }
  });
  console.log('📋 Detalle por tipo de plato:');
  items.forEach(i => console.log(`   - ${i.name}: ${i._sum.qty}`));
}
run().finally(() => prisma.$disconnect());
