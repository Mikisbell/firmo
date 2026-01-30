/**
 * Single Test: Assign Driver
 * 
 * Isolated test to debug the exact failure point
 */

import prisma from '@/src/core/db/prisma';
import { assignDriver } from '@/src/core/delivery/assignment.service';
import { updateDriverLocation } from '@/src/core/delivery/geolocation.service';
import { toDriverId, toOrderId, toTenantId } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

async function main() {
  console.log('🧪 SINGLE TEST: Assign Driver\n');
  console.log('='.repeat(60));

  try {
    // Setup: Create driver
    console.log('\n📝 Setup: Creating driver...\n');
    const driver = await prisma.drivers.upsert({
      where: { id: '00000000-0000-0000-0000-000000000088' },
      create: {
        id: '00000000-0000-0000-0000-000000000088',
        tenant_id: TENANT_ID,
        name: 'Single Test Driver',
        phone: '+51988888888',
        is_active: true
      },
      update: {
        is_active: true
      }
    });
    console.log('✅ Driver created:', driver.id);

    // Set driver location
    await updateDriverLocation(toDriverId(driver.id), {
      latitude: -12.0464,
      longitude: -77.0428,
      accuracy: 10,
      timestamp: new Date()
    });
    console.log('✅ Driver location set');

    // Setup: Create order
    console.log('\n📝 Setup: Creating order...\n');
    
    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: TENANT_ID,
          phone: '+51988888888'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000087',
        tenant_id: TENANT_ID,
        phone: '+51988888888',
        name: 'Single Test Customer'
      },
      update: {}
    });
    console.log('✅ Customer created:', customer.id);

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'SINGLE_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000086',
        tenant_id: TENANT_ID,
        code: 'SINGLE_LOC',
        name: 'Single Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });
    console.log('✅ Location created:', location.id);

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000085',
        tenant_id: TENANT_ID,
        order_number: 7777,
        order_type: 'DELIVERY',
        terminal_id: 'SINGLE_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });
    console.log('✅ Order created:', order.id);

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000084',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51988888888',
        status: 'PENDING'
      }
    });
    console.log('✅ Delivery order created:', deliveryOrder.id);
    console.log('   order_id:', deliveryOrder.order_id);

    // Verify data before calling assignDriver
    console.log('\n📊 Verification: Query delivery_order with relations...\n');
    
    const verifyOrder = await prisma.delivery_orders.findUnique({
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

    if (verifyOrder) {
      console.log('✅ Delivery order found');
      console.log('[DEBUG] Verification query result:', {
        id: verifyOrder.id,
        order_id: verifyOrder.order_id,
        has_orders_relation: !!verifyOrder.orders,
        orders_keys: verifyOrder.orders ? Object.keys(verifyOrder.orders).slice(0, 5) : 'NULL'
      });
      console.log('   orders relation:', verifyOrder.orders ? '✅ LOADED' : '❌ NULL');
      
      if (verifyOrder.orders) {
        console.log('   orders.id:', verifyOrder.orders.id);
        console.log('   orders.order_number:', verifyOrder.orders.order_number);
        console.log('   orders.customers:', verifyOrder.orders.customers ? '✅ LOADED' : '❌ NULL');
        console.log('   orders.locations:', verifyOrder.orders.locations ? '✅ LOADED' : '❌ NULL');
        
        if (verifyOrder.orders.customers) {
          console.log('   customers.name:', verifyOrder.orders.customers.name);
        }
        if (verifyOrder.orders.locations) {
          console.log('   locations.address:', verifyOrder.orders.locations.address);
        }
      } else {
        console.log('❌ ERROR: orders relation is NULL!');
        console.log('   This is the problem we need to fix');
      }
    } else {
      console.log('❌ Delivery order NOT found');
    }

    // Test: Call assignDriver
    console.log('\n🎯 Test: Calling assignDriver...\n');
    
    try {
      const assignedDriver = await assignDriver(toOrderId(deliveryOrder.id));
      
      if (assignedDriver) {
        console.log('✅ Driver assigned successfully!');
        console.log('   driver.id:', assignedDriver.id);
        console.log('   driver.name:', assignedDriver.name);
        
        // Verify order was updated
        const updatedOrder = await prisma.delivery_orders.findUnique({
          where: { id: deliveryOrder.id }
        });
        
        if (updatedOrder) {
          console.log('✅ Order updated:');
          console.log('   status:', updatedOrder.status);
          console.log('   driver_id:', updatedOrder.driver_id);
          console.log('   assigned_at:', updatedOrder.assigned_at);
        }
      } else {
        console.log('⚠️ No driver assigned (no drivers available)');
      }
    } catch (error) {
      console.log('❌ assignDriver failed with error:');
      console.error(error);
    }

    // Cleanup
    console.log('\n🧹 Cleanup: Deleting test data...\n');
    await prisma.delivery_orders.deleteMany({
      where: { id: deliveryOrder.id }
    });
    await prisma.orders.deleteMany({
      where: { id: order.id }
    });
    await prisma.assignment_logs.deleteMany({
      where: { order_id: deliveryOrder.id }
    });
    console.log('✅ Cleanup complete');

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
