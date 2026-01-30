/**
 * Clean AssignDriver Test
 * 
 * Minimal test calling assignDriver directly
 */

import prisma from '@/src/core/db/prisma';
import { assignDriver } from '@/src/core/delivery/assignment.service';
import { updateDriverLocation } from '@/src/core/delivery/geolocation.service';
import { toDriverId, toOrderId, toTenantId } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

async function main() {
  console.log('🧪 CLEAN ASSIGNDRIVER TEST\n');
  console.log('='.repeat(60));

  try {
    // Create driver
    const driver = await prisma.drivers.upsert({
      where: { id: '00000000-0000-0000-0000-000000000068' },
      create: {
        id: '00000000-0000-0000-0000-000000000068',
        tenant_id: TENANT_ID,
        name: 'Clean Test Driver',
        phone: '+51966666666',
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

    // Create order data
    const customer = await prisma.customers.upsert({
      where: { 
        tenant_id_phone: {
          tenant_id: TENANT_ID,
          phone: '+51966666666'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000067',
        tenant_id: TENANT_ID,
        phone: '+51966666666',
        name: 'Clean Test Customer'
      },
      update: {}
    });

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'CLEAN_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000066',
        tenant_id: TENANT_ID,
        code: 'CLEAN_LOC',
        name: 'Clean Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000065',
        tenant_id: TENANT_ID,
        order_number: 4444,
        order_type: 'DELIVERY',
        terminal_id: 'CLEAN_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000064',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51966666666',
        status: 'PENDING'
      }
    });

    console.log('✅ Test data created');
    console.log('   delivery_order.id:', deliveryOrder.id);
    console.log('   order.id:', order.id);

    // BEFORE calling assignDriver, verify the data exists
    console.log('\n📊 PRE-CHECK: Verify data exists...\n');
    
    const preCheck = await prisma.delivery_orders.findUnique({
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

    console.log('Pre-check result:');
    console.log('  delivery_order found:', !!preCheck);
    console.log('  orders relation loaded:', !!preCheck?.orders);
    console.log('  order.id:', preCheck?.orders?.id);
    console.log('  order.order_number:', preCheck?.orders?.order_number);

    // NOW call assignDriver
    console.log('\n🎯 Calling assignDriver...\n');
    
    const result = await assignDriver(toOrderId(deliveryOrder.id));

    if (result) {
      console.log('✅ SUCCESS! Driver assigned:', result.id);
    } else {
      console.log('⚠️ No driver assigned (no drivers available)');
    }

    // Cleanup
    await prisma.delivery_orders.deleteMany({ where: { id: deliveryOrder.id } });
    await prisma.orders.deleteMany({ where: { id: order.id } });
    await prisma.assignment_logs.deleteMany({ where: { order_id: deliveryOrder.id } });

    console.log('\n✅ TEST COMPLETE\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
