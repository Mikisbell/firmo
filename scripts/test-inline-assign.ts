/**
 * Inline AssignDriver Test
 * 
 * Tests assignDriver logic inline (not imported)
 */

import prisma from '@/src/core/db/prisma';
import { updateDriverLocation, getDriverLocation } from '@/src/core/delivery/geolocation.service';
import { toDriverId, toOrderId, toTenantId, type OrderId, type Driver, type Location } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

// INLINE version of assignDriver
async function assignDriverInline(orderId: OrderId): Promise<Driver | null> {
  console.log('\n[INLINE] Starting assignDriver...\n');
  
  // Get order details with related order info
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

  console.log('[INLINE DEBUG] Query result:', {
    found: !!order,
    has_orders_relation: !!order?.orders,
    order_id: order?.order_id
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (!order.orders) {
    throw new Error(`Order ${orderId} has no associated order (order_id: ${order.order_id})`);
  }

  console.log('[INLINE] ✅ Order and relation loaded successfully');
  console.log('[INLINE]   order.orders.order_number:', order.orders.order_number);

  // For this test, just return null (we're only testing the query)
  return null;
}

async function main() {
  console.log('🧪 INLINE ASSIGNDRIVER TEST\n');
  console.log('='.repeat(60));

  try {
    // Create test data
    const driver = await prisma.drivers.upsert({
      where: { id: '00000000-0000-0000-0000-000000000058' },
      create: {
        id: '00000000-0000-0000-0000-000000000058',
        tenant_id: TENANT_ID,
        name: 'Inline Test Driver',
        phone: '+51955555555',
        is_active: true
      },
      update: { is_active: true }
    });

    await updateDriverLocation(toDriverId(driver.id), {
      latitude: -12.0464,
      longitude: -77.0428,
      accuracy: 10,
      timestamp: new Date()
    });

    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: TENANT_ID,
          phone: '+51955555555'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000057',
        tenant_id: TENANT_ID,
        phone: '+51955555555',
        name: 'Inline Test Customer'
      },
      update: {}
    });

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'INLINE_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000056',
        tenant_id: TENANT_ID,
        code: 'INLINE_LOC',
        name: 'Inline Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000055',
        tenant_id: TENANT_ID,
        order_number: 3333,
        order_type: 'DELIVERY',
        terminal_id: 'INLINE_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000054',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51955555555',
        status: 'PENDING'
      }
    });

    console.log('✅ Test data created');

    // Call INLINE version
    console.log('\n🎯 Calling INLINE assignDriver...\n');
    
    try {
      await assignDriverInline(toOrderId(deliveryOrder.id));
      console.log('\n✅ INLINE version SUCCESS!');
    } catch (error) {
      console.log('\n❌ INLINE version FAILED:', (error as Error).message);
    }

    // Now import and call the REAL version
    console.log('\n🎯 Calling IMPORTED assignDriver...\n');
    
    const { assignDriver } = await import('@/src/core/delivery/assignment.service');
    
    try {
      await assignDriver(toOrderId(deliveryOrder.id));
      console.log('\n✅ IMPORTED version SUCCESS!');
    } catch (error) {
      console.log('\n❌ IMPORTED version FAILED:', (error as Error).message);
    }

    // Cleanup
    await prisma.delivery_orders.deleteMany({ where: { id: deliveryOrder.id } });
    await prisma.orders.deleteMany({ where: { id: order.id } });
    await prisma.assignment_logs.deleteMany({ where: { order_id: deliveryOrder.id } });

    console.log('\n✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n💥 ERROR:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
