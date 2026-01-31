/**
 * Direct Query Test
 * 
 * Tests if the query works when called directly vs through a function
 */

import prisma from '@/src/core/db/prisma';
import { toOrderId } from '@/src/core/delivery/types-2026';

async function testDirectQuery(orderId: string) {
  console.log('\n🔍 Testing DIRECT query inside function...\n');
  
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

  console.log('[DEBUG] Direct query result:', {
    id: order?.id,
    order_id: order?.order_id,
    has_orders_relation: !!order?.orders,
    orders_keys: order?.orders ? Object.keys(order.orders).slice(0, 5) : 'NULL'
  });

  return order;
}

async function main() {
  console.log('🧪 DIRECT QUERY TEST\n');
  console.log('='.repeat(60));

  try {
    // Create test data
    console.log('\n📝 Creating test data...\n');
    
    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: '00000000-0000-0000-0000-000000000001',
          phone: '+51999999999'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000081',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        phone: '+51999999999',
        name: 'Direct Test Customer'
      },
      update: {}
    });

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: '00000000-0000-0000-0000-000000000001',
          code: 'DIRECT_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000082',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        code: 'DIRECT_LOC',
        name: 'Direct Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000083',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_number: 6666,
        order_type: 'DELIVERY',
        terminal_id: 'DIRECT_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000080',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51999999999',
        status: 'PENDING'
      }
    });

    console.log('✅ Test data created');
    console.log('   delivery_order.id:', deliveryOrder.id);
    console.log('   delivery_order.order_id:', deliveryOrder.order_id);

    // Test 1: Query in main function
    console.log('\n📊 Test 1: Query in MAIN function...\n');
    
    const result1 = await prisma.delivery_orders.findUnique({
      where: { id: deliveryOrder.id },
      include: {
        orders: {
          include: {
            customers: true,
            locations: true,
          },
        },
      },
    });

    console.log('[DEBUG] Main function query result:', {
      id: result1?.id,
      order_id: result1?.order_id,
      has_orders_relation: !!result1?.orders,
      orders_keys: result1?.orders ? Object.keys(result1.orders).slice(0, 5) : 'NULL'
    });

    // Test 2: Query in separate function
    const result2 = await testDirectQuery(deliveryOrder.id);

    // Test 3: Query with OrderId branded type
    console.log('\n📊 Test 3: Query with BRANDED type...\n');
    
    const orderId = toOrderId(deliveryOrder.id);
    const result3 = await prisma.delivery_orders.findUnique({
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
      id: result3?.id,
      order_id: result3?.order_id,
      has_orders_relation: !!result3?.orders,
      orders_keys: result3?.orders ? Object.keys(result3.orders).slice(0, 5) : 'NULL'
    });

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
