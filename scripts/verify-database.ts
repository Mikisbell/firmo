import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('🔍 VERIFICACIÓN DE BASE DE DATOS\n');

  try {
    // 1. Test connection
    console.log('1️⃣  Probando conexión...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conexión exitosa\n');

    // 2. Count tables
    console.log('2️⃣  Contando registros por tabla...');
    
    const tables = [
      { name: 'tenants', model: prisma.tenants },
      { name: 'employees', model: prisma.employees },
      { name: 'terminals', model: prisma.terminals },
      { name: 'products', model: prisma.products },
      { name: 'inventory', model: prisma.inventory },
      { name: 'orders', model: prisma.orders },
      { name: 'invoices', model: prisma.invoices },
      { name: 'events', model: prisma.events },
      { name: 'delivery_orders', model: prisma.delivery_orders },
      { name: 'locations', model: prisma.locations },
    ];

    for (const table of tables) {
      try {
        const count = await (table.model as any).count();
        console.log(`   ${table.name}: ${count} registros`);
      } catch (error: any) {
        console.log(`   ${table.name}: ❌ Error - ${error.message.split('\n')[0]}`);
      }
    }

    console.log('\n3️⃣  Verificando integridad de datos...');

    // Check for orphaned records
    try {
      const ordersWithoutTenant = await prisma.orders.findMany({
        where: { tenant_id: null },
        take: 5,
      });
      if (ordersWithoutTenant.length > 0) {
        console.log(`   ⚠️  ${ordersWithoutTenant.length} órdenes sin tenant_id`);
      } else {
        console.log('   ✅ Todas las órdenes tienen tenant_id');
      }
    } catch (error) {
      console.log('   ℹ️  No se pudo verificar órdenes');
    }

    // Check for orphaned inventory
    try {
      const inventoryWithoutTenant = await prisma.inventory.findMany({
        where: { tenant_id: null },
        take: 5,
      });
      if (inventoryWithoutTenant.length > 0) {
        console.log(`   ⚠️  ${inventoryWithoutTenant.length} items de inventario sin tenant_id`);
      } else {
        console.log('   ✅ Todo el inventario tiene tenant_id');
      }
    } catch (error) {
      console.log('   ℹ️  No se pudo verificar inventario');
    }

    console.log('\n4️⃣  Verificando eventos...');
    try {
      const eventCount = await prisma.events.count();
      const eventTypes = await prisma.events.groupBy({
        by: ['event_type'],
        _count: true,
      });
      console.log(`   Total eventos: ${eventCount}`);
      console.log('   Tipos de eventos:');
      eventTypes.forEach((et: any) => {
        console.log(`     - ${et.event_type}: ${et._count}`);
      });
    } catch (error) {
      console.log('   ℹ️  No se pudo verificar eventos');
    }

    console.log('\n5️⃣  Verificando estado de sincronización...');
    try {
      const outboxCount = await prisma.event_outbox.count();
      const processedCount = await prisma.processed_events.count();
      console.log(`   Eventos en outbox: ${outboxCount}`);
      console.log(`   Eventos procesados: ${processedCount}`);
    } catch (error) {
      console.log('   ℹ️  No se pudo verificar outbox');
    }

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error durante verificación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
