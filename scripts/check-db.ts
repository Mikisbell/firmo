import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Eventos Agrupados por Tipo ---');
  const eventTypes = await prisma.events.groupBy({
    by: ['type'],
    _count: { id: true },
  });
  console.log(eventTypes);

  console.log('\n--- Órdenes Agrupadas por Estado ---');
  const orderStatuses = await prisma.orders.groupBy({
    by: ['order_status'],
    _count: { id: true },
  });
  console.log(orderStatuses);

  // Traer las ultimas 5 ordenes para ver como están
  const orders = await prisma.orders.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      order_status: true,
      total_cents: true,
      created_at: true
    }
  });
  console.log('\n--- Últimas 5 órdenes ---');
  console.log(orders);
}

run().finally(() => prisma.$disconnect());
