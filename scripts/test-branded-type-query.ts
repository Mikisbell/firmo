/**
 * Branded Type Query Test
 * 
 * Tests if Prisma has issues with branded types in where clause
 */

import prisma from '@/src/core/db/prisma';
import { toOrderId, type OrderId } from '@/src/core/delivery/types-2026';

async function queryWithBrandedType(orderId: OrderId) {
  console.log('\n🔍 Query WITH branded type parameter...\n');
  console.log('  orderId type:', typeof orderId);
  console.log('  orderId value:', orderId);
  
  const order = await prisma.delivery_orders.findUnique({
    where: { id: orderId },
    include: {
      orders: {
        include: {
          customers: true,
          locations: true,
        },
      },
    },
  });

  console.log('[DEBUG] Branded type query result:', {
    found: !!order,
    has_orders_relation: !!order?.orders,
  });

  return order;
}

async function queryWithString(orderId: string) {
  console.log('\n🔍 Query WITH string parameter...\n');
  console.log('  orderId type:', typeof orderId);
  console.log('  orderId value:', orderId);
  
  const order = await prisma.delivery_orders.findUnique({
    where: { id: orderId },
    include: {
      orders: {
        include: {
          customers: true,
          locations: true,
        },
      },
    },
  });

  console.log('[DEBUG] String query result:', {
    found: !!order,
    has_orders_relation: !!order?.orders,
  });

  return order;
}

async function queryWithCast(orderId: OrderId) {
  console.log('\n🔍 Query WITH cast to string...\n');
  console.log('  orderId type:', typeof orderId);
  console.log('  orderId value:', orderId);
  
  const order = await prisma.delivery_orders.findUnique({
    where: { id: orderId as string },
    include: {
      orders: {
        include: {
          customers: true,
          locations: true,
        },
      },
    },
  });

  console.log('[DEBUG] Cast query result:', {
    found: !!order,
    has_orders_relation: !!order?.orders,
  });

  return order;
}

async function main() {
  console.log('🧪 BRANDED TYPE QUERY TEST\n');
  console.log('='.repeat(60));

  try {
    // Create test data
    console.log('\n📝 Creating test data...\n');
    
    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: '00000000-0000-0000-0000-000000000001',
          phone: '+51988888888'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000071',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        phone: '+51988888888',
        name: 'Branded Test Customer'
      },
      update: {}
    });

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: '00000000-0000-0000-0000-000000000001',
          code: 'BRANDED_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000072',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        code: 'BRANDED_LOC',
        name: 'Branded Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000073',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_number: 5555,
        order_type: 'DELIVERY',
        terminal_id: 'BRANDED_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000070',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51988888888',
        status: 'PENDING'
      }
    });

    console.log('✅ Test data created');
    console.log('   delivery_order.id:', deliveryOrder.id);

    // Test 1: Query with string
    const result1 = await queryWithString(deliveryOrder.id);

    // Test 2: Query with branded type
    const brandedId = toOrderId(deliveryOrder.id);
    const result2 = await queryWithBrandedType(brandedId);

    // Test 3: Query with cast
    const result3 = await queryWithCast(brandedId);

    // Summary
    console.log('\n📊 SUMMARY\n');
    console.log('String query loaded relation:', !!result1?.orders ? '✅' : '❌');
    console.log('Branded type query loaded relation:', !!result2?.orders ? '✅' : '❌');
    console.log('Cast query loaded relation:', !!result3?.orders ? '✅' : '❌');

    // Cleanup
    console.log('\n🧹 Cleanup...\n');
    await prisma.delivery_orders.delete({ where: { id: deliveryOrder.id } });
    await prisma.orders.delete({ where: { id: order.id } });
    console.log('✅ Cleanup complete');

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n💥 ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
