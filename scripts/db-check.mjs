import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function dbStatus() {
  console.log("📊 ESTADO DE LA BASE DE DATOS\n");
  
  try {
    console.log("RESUMEN GENERAL:");
    console.log("================\n");

    const stats = {
      tenants: await prisma.tenants.count(),
      employees: await prisma.employees.count(),
      terminals: await prisma.terminals.count(),
      locations: await prisma.locations.count(),
      products: await prisma.products.count(),
      inventory: await prisma.inventory.count(),
      orders: await prisma.orders.count(),
      invoices: await prisma.invoices.count(),
      events: await prisma.events.count(),
      delivery_orders: await prisma.delivery_orders.count(),
    };

    for (const [table, count] of Object.entries(stats)) {
      console.log(`${table.padEnd(20)}: ${count.toString().padStart(5)} registros`);
    }

    // Check active status
    console.log("\n\nESTADO DE REGISTROS:");
    console.log("===================\n");

    const empActive = await prisma.employees.count({ where: { is_active: true } });
    const empInactive = stats.employees - empActive;
    console.log(`Employees: ${empActive} activos, ${empInactive} inactivos`);

    const prodActive = await prisma.products.count({ where: { is_active: true } });
    const prodInactive = stats.products - prodActive;
    console.log(`Products: ${prodActive} activos, ${prodInactive} inactivos`);

    const termActive = await prisma.terminals.count({ where: { is_allowed: true } });
    const termInactive = stats.terminals - termActive;
    console.log(`Terminals: ${termActive} activas, ${termInactive} inactivas`);

    const locActive = await prisma.locations.count({ where: { is_active: true } });
    const locInactive = stats.locations - locActive;
    console.log(`Locations: ${locActive} activas, ${locInactive} inactivas`);

    // Check inventory levels
    console.log("\n\nNIVELES DE INVENTARIO:");
    console.log("====================\n");

    const inventory = await prisma.inventory.findMany({
      select: { name: true, stock: true, min_stock: true },
    });

    if (inventory.length > 0) {
      console.log(`Total items: ${inventory.length}`);
      const lowStock = inventory.filter(i => i.stock <= (i.min_stock || 0));
      if (lowStock.length > 0) {
        console.log(`\n⚠️  Items con stock bajo (${lowStock.length}):`);
        lowStock.forEach(item => {
          console.log(`   - ${item.name}: ${item.stock} (mín: ${item.min_stock})`);
        });
      } else {
        console.log("✅ Todos los items tienen stock adecuado");
      }
    }

    // Check orders
    console.log("\n\nÓRDENES:");
    console.log("========\n");

    const orders = await prisma.orders.findMany({
      select: { order_number: true, order_status: true, total_cents: true },
    });

    if (orders.length > 0) {
      console.log(`Total: ${orders.length}`);
      orders.forEach(o => {
        console.log(`   - Orden #${o.order_number}: ${o.order_status} - S/. ${(o.total_cents / 100).toFixed(2)}`);
      });
    } else {
      console.log("Sin órdenes registradas");
    }

    // Check invoices
    console.log("\n\nFACTURAS:");
    console.log("=========\n");

    const invoices = await prisma.invoices.findMany({
      select: { invoice_number: true, status: true, total_cents: true },
    });

    if (invoices.length > 0) {
      console.log(`Total: ${invoices.length}`);
      invoices.forEach(i => {
        console.log(`   - Factura #${i.invoice_number}: ${i.status} - S/. ${(i.total_cents / 100).toFixed(2)}`);
      });
    } else {
      console.log("Sin facturas registradas");
    }

    console.log("\n✅ Reporte completado\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

dbStatus();
