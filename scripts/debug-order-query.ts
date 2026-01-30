import prisma from '@/src/core/db/prisma';

async function main() {
  const order = await prisma.delivery_orders.findUnique({
    where: { id: '00000000-0000-0000-0000-000000000094' },
    include: {
      orders: {
        include: {
          customers: true,
          locations: true,
        },
      },
    },
  });

  console.log('Delivery Order:', JSON.stringify(order, null, 2));
  
  if (order) {
    console.log('\norder.orders:', order.orders);
    console.log('order.orders?.order_number:', order.orders?.order_number);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
