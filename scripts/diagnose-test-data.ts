/**
 * Diagnostic Script: Test Data Relation Loading
 * 
 * Investigates why Prisma relations aren't loading in tests
 */

import prisma from '@/src/core/db/prisma';
import { toTenantId } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

async function main() {
  console.log('🔍 DIAGNOSTIC: Test Data Relation Loading\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create test data
    console.log('\n📝 Step 1: Creating test data...\n');

    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: TENANT_ID,
          phone: '+51999999999'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000091',
        tenant_id: TENANT_ID,
        phone: '+51999999999',
        name: 'Diagnostic Customer'
      },
      update: {}
    });
    console.log('✅ Customer created:', customer.id);

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'DIAG_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000092',
        tenant_id: TENANT_ID,
        code: 'DIAG_LOC',
        name: 'Diagnostic Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });
    console.log('✅ Location created:', location.id);

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000093',
        tenant_id: TENANT_ID,
        order_number: 8888,
        order_type: 'DELIVERY',
        terminal_id: 'DIAG_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });
    console.log('✅ Order created:', order.id);

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000090',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51999999999',
        status: 'PENDING'
      }
    });
    console.log('✅ Delivery order created:', deliveryOrder.id);
    console.log('   order_id:', deliveryOrder.order_id);

    // Step 2: Query without include
    console.log('\n📊 Step 2: Query delivery_order WITHOUT include...\n');
    
    const deliveryOrderBasic = await prisma.delivery_orders.findUnique({
      where: { id: deliveryOrder.id }
    });
    
    if (deliveryOrderBasic) {
      console.log('✅ Delivery order found');
      console.log('   id:', deliveryOrderBasic.id);
      console.log('   order_id:', deliveryOrderBasic.order_id);
      console.log('   status:', deliveryOrderBasic.status);
    } else {
      console.log('❌ Delivery order NOT found');
    }

    // Step 3: Query with include
    console.log('\n📊 Step 3: Query delivery_order WITH include...\n');
    
    const deliveryOrderWithRelation = await prisma.delivery_orders.findUnique({
      where: { id: deliveryOrder.id },
      include: {
        orders: true
      }
    });
    
    if (deliveryOrderWithRelation) {
      console.log('✅ Delivery order found');
      console.log('   id:', deliveryOrderWithRelation.id);
      console.log('   order_id:', deliveryOrderWithRelation.order_id);
      console.log('   orders relation:', deliveryOrderWithRelation.orders ? '✅ LOADED' : '❌ NULL');
      
      if (deliveryOrderWithRelation.orders) {
        console.log('   orders.id:', deliveryOrderWithRelation.orders.id);
        console.log('   orders.order_number:', deliveryOrderWithRelation.orders.order_number);
      }
    } else {
      console.log('❌ Delivery order NOT found');
    }

    // Step 4: Query with nested include
    console.log('\n📊 Step 4: Query delivery_order WITH nested include...\n');
    
    const deliveryOrderNested = await prisma.delivery_orders.findUnique({
      where: { id: deliveryOrder.id },
      include: {
        orders: {
          include: {
            customers: true,
            locations: true
          }
        }
      }
    });
    
    if (deliveryOrderNested) {
      console.log('✅ Delivery order found');
      console.log('   orders relation:', deliveryOrderNested.orders ? '✅ LOADED' : '❌ NULL');
      
      if (deliveryOrderNested.orders) {
        console.log('   orders.id:', deliveryOrderNested.orders.id);
        console.log('   orders.order_number:', deliveryOrderNested.orders.order_number);
        console.log('   orders.customers:', deliveryOrderNested.orders.customers ? '✅ LOADED' : '❌ NULL');
        console.log('   orders.locations:', deliveryOrderNested.orders.locations ? '✅ LOADED' : '❌ NULL');
        
        if (deliveryOrderNested.orders.customers) {
          console.log('   customers.name:', deliveryOrderNested.orders.customers.name);
        }
        if (deliveryOrderNested.orders.locations) {
          console.log('   locations.address:', deliveryOrderNested.orders.locations.address);
        }
      }
    } else {
      console.log('❌ Delivery order NOT found');
    }

    // Step 5: Verify foreign key
    console.log('\n📊 Step 5: Verify foreign key relationship...\n');
    
    const orderExists = await prisma.orders.findUnique({
      where: { id: deliveryOrder.order_id }
    });
    
    console.log('Order exists in database:', orderExists ? '✅ YES' : '❌ NO');
    if (orderExists) {
      console.log('   order.id:', orderExists.id);
      console.log('   order.order_number:', orderExists.order_number);
    }

    // Step 6: Query from orders side
    console.log('\n📊 Step 6: Query from orders side (reverse relation)...\n');
    
    const orderWithDelivery = await prisma.orders.findUnique({
      where: { id: order.id },
      include: {
        delivery_orders: true
      }
    });
    
    if (orderWithDelivery) {
      console.log('✅ Order found');
      console.log('   delivery_orders count:', orderWithDelivery.delivery_orders.length);
      if (orderWithDelivery.delivery_orders.length > 0) {
        console.log('   delivery_orders[0].id:', orderWithDelivery.delivery_orders[0].id);
      }
    }

    // Step 7: Check Prisma schema relation
    console.log('\n📊 Step 7: Prisma schema check...\n');
    console.log('Expected relation name: "orders" (singular)');
    console.log('Field in delivery_orders: order_id');
    console.log('References: orders.id');

    // Cleanup
    console.log('\n🧹 Cleanup: Deleting test data...\n');
    await prisma.delivery_orders.delete({ where: { id: deliveryOrder.id } });
    await prisma.orders.delete({ where: { id: order.id } });
    console.log('✅ Cleanup complete');

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ DIAGNOSTIC COMPLETE\n');

  } catch (error) {
    console.error('\n💥 ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
