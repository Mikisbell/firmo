import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function simpleReport() {
  console.log("📊 ESTADO DE LA BASE DE DATOS\n");
  
  try {
    // Summary
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

    // Check data integrity
    console.log("\n\nINTEGRIDAD DE DATOS:");
    console.log("===================\n");

    const orphaned = {
      "Orders sin tenant": await prisma.orders.count({ where: { tenant_id: null } }),
      "Inventory sin tenant": await prisma.inventory.count({ where: { tenant_id: null } }),
      "Employees sin tenant": await prisma.employees.count({ where: { tenant_id: null } }),
      "Terminals sin tenant": await prisma.terminals.count({ where: { tenant_id: null } }),
    };

    let allGood = true;
    for (const [issue, count] of Object.entries(orphaned)) {
      if (count > 0) {
        console.log(`⚠️  ${issue}: ${count}`);
        allGood = false;
      }
    }
    
    if (allGood) {
      console.log("✅ Todos los registros tienen tenant_id correcto");
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

    const lowStock = await prisma.inventory.findMany({
      where: { stock: { lte: 10 } },
      select: { name: true, stock: true, min_stock: true },
    });

    if (lowStock.length > 0) {
      console.log("⚠️  Items con stock bajo:");
      lowStock.forEach(item => {
        console.log(`   - ${item.name}: ${item.stock} (mín: ${item.min_stock})`);
      });
    } else {
      console.log("✅ Todos los items tienen stock adecuado");
    }

    console.log("\n✅ Reporte completado\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simpleReport();
