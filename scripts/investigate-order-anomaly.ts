import prisma from '@/src/core/db/prisma';

async function investigateOrderAnomaly() {
  try {
    // Find order #29881
    const order = await prisma.orders.findFirst({
      where: { order_number: 29881 },
    });

    if (!order) {
      console.log('Order #29881 not found');
      return;
    }

    console.log('Order #29881:');
    console.log(JSON.stringify(order, null, 2));

    // Find all orders with total_cents = 0
    const zeroTotalOrders = await prisma.orders.findMany({
      where: { total_cents: 0 },
      select: {
        id: true,
        order_number: true,
        order_status: true,
        total_cents: true,
        subtotal_cents: true,
        discount_cents: true,
        created_at: true,
      },
    });

    console.log(\nFound $\{zeroTotalOrders.length\} orders with total_cents = 0:);
    console.log(JSON.stringify(zeroTotalOrders, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.\();
  }
}

investigateOrderAnomaly();
