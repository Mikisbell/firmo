/**
 * Debug Prisma Relation Loading Issue
 */

import prisma from '@/src/core/db/prisma';
import { assignDriver } from '@/src/core/delivery/assignment.service';
import { updateDriverLocation } from '@/src/core/delivery/geolocation.service';
import { toDriverId, toOrderId, toTenantId } from '@/src/core/delivery/types-2026';

const TENANT_ID = toTenantId('00000000-0000-0000-0000-000000000001');

async function main() {
  console.log('🔍 PRISMA RELATION DEBUG TEST\n');
  console.log('='.repeat(60));

  try {
    // Create test data
    const driver = await prisma.drivers.upsert({
      where: { id: '00000000-0000-0000-0000-000000000078' },
      create: {
        id: '00000000-0000-0000-0000-000000000078',
        tenant_id: TENANT_ID,
        name: 'Debug Test Driver',
        phone: '+51977777777',
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
          phone: '+51977777777'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000077',
        tenant_id: TENANT_ID,
        phone: '+51977777777',
        name: 'Debug Test Customer'
      },
      update: {}
    });

    const location = await prisma.locations.upsert({
      where: {
        tenant_id_code: {
          tenant_id: TENANT_ID,
          code: 'DEBUG_LOC'
        }
      },
      create: {
        id: '00000000-0000-0000-0000-000000000076',
        tenant_id: TENANT_ID,
        code: 'DEBUG_LOC',
        name: 'Debug Test Location',
        address: '-12.0464,-77.0428'
      },
      update: {}
    });

    const order = await prisma.orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000075',
        tenant_id: TENANT_ID,
        order_number: 7777,
        order_type: 'DELIVERY',
        terminal_id: 'DEBUG_TERMINAL',
        customer_id: customer.id,
        location_id: location.id
      }
    });

    const deliveryOrder = await prisma.delivery_orders.create({
      data: {
        id: '00000000-0000-0000-0000-000000000074',
        tenant_id: TENANT_ID,
        order_id: order.id,
        address_text: '-12.0500,-77.0500',
        customer_phone: '+51977777777',
        status: 'PENDING'
      }
    });

    console.log('✅ Test data created');
    console.log('   delivery_order.id:', deliveryOrder.id);
    console.log('   order.id:', order.id);

    // Call assignDriver
    console.log('\n🎯 Calling assignDriver...\n');
    
    try {
      const result = await assignDriver(toOrderId(deliveryOrder.id));
      if (result) {
        console.log('✅ SUCCESS! Driver assigned:', result.id);
      } else {
        console.log('⚠️ No driver assigned (no drivers available)');
      }
    } catch (error) {
      console.log('❌ FAILED:', (error as Error).message);
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
