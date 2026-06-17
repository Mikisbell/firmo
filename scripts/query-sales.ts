/**
 * Query de Ventas Detalladas (Desde el Event Sourcing y Proyecciones)
 * Ejecutar con: bun run scripts/query-sales.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

async function main() {
  console.log('🍽️  Consultando Ventas Detalladas...');
  console.log('----------------------------------------------------');

  try {
    // Opción 1: Consultar la proyección de órdenes pagadas o cerradas
    const orders = await prisma.orders.findMany({
      where: {
        order_status: { in: ['PAID', 'CLOSED'] }
      },
      include: {
        order_item_projections: true,
        payments: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 5
    });

    if (orders.length > 0) {
      console.log(`✅ Mostrando las últimas ${orders.length} órdenes pagadas (Proyección):\n`);
      
      orders.forEach(order => {
        console.log(`🟢 Orden #${order.order_number || order.id.split('-')[0]} - ${new Date(order.created_at).toLocaleString()}`);
        console.log(`   Total: S/ ${(Number(order.total_cents) / 100).toFixed(2)}`);
        
        console.log(`   📝 Items:`);
        order.order_item_projections.forEach(item => {
          console.log(`      - ${item.quantity}x ${item.product_name} (S/ ${(Number(item.unit_price_cents || 0) / 100).toFixed(2)} c/u)`);
        });
        
        console.log(`   💳 Pagos:`);
        order.payments.forEach(payment => {
          console.log(`      - ${payment.payment_method}: S/ ${(Number(payment.amount_cents || payment.amount || 0) / 100).toFixed(2)}`);
        });
        console.log('----------------------------------------------------');
      });
    } else {
      console.log('⚠️ No se encontraron órdenes en las proyecciones.');
    }

    // Opción 2: Buscar en la fuente de la verdad absoluta (Event Sourcing)
    console.log('\n🔍 Buscando la Verdad Absoluta en la tabla de Eventos (ORDER_PAID)...');
    const paymentEvents = await prisma.events.findMany({
      where: {
        type: 'ORDER_PAID'
      },
      orderBy: {
        global_sequence: 'desc'
      },
      take: 3
    });

    if (paymentEvents.length > 0) {
      paymentEvents.forEach(evt => {
        console.log(`[EVENTO] Secuencia Global: ${evt.global_sequence} | Fecha: ${new Date(evt.created_at).toLocaleString()}`);
        console.log(`Payload:`, JSON.stringify(evt.payload, null, 2));
        console.log('---------------------------');
      });
    } else {
      console.log('⚠️ No hay eventos de pago (ORDER_PAID) en el registro todavía.');
    }

  } catch (error) {
    console.error('❌ Error al consultar ventas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
