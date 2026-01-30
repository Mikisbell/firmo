import prisma from '@/src/core/db/prisma';

async function main() {
  // Check if order exists
  const order = await prisma.orders.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000095' },
  });
  console.log('Order exists:', !!order);
  if (order) {
    console.log('Order:', order);
  }

  // Check if delivery_order exists
  const deliveryOrder = await prisma.delivery_orders.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000094' },
  });
  console.log('\nDelivery Order exists:', !!deliveryOrder);
  if (deliveryOrder) {
    console.log('Delivery Order order_id:', deliveryOrder.order_id);
  }

  // Try to load with include
  const deliveryOrderWithRelation = await prisma.delivery_orders.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000094' },
    include: {
      orders: true,
    },
  });
  console.log('\nDelivery Order with relation:', !!deliveryOrderWithRelation);
  if (deliveryOrderWithRelation) {
    console.log('Has orders relation:', !!deliveryOrderWithRelation.orders);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
