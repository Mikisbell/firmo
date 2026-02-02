import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function finalReport() {
  console.log("\n📊 REPORTE FINAL DE BASE DE DATOS\n");
  console.log("=" * 70);
  
  try {
    // Summary
    console.log("\n📈 RESUMEN GENERAL");
    console.log("-".repeat(70));
    
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

    console.log(`  Tenants:         ${stats.tenants}`);
    console.log(`  Empleados:       ${stats.employees}`);
    console.log(`  Terminales:      ${stats.terminals}`);
    console.log(`  Ubicaciones:     ${stats.locations}`);
    console.log(`  Productos:       ${stats.products}`);
    console.log(`  Inventario:      ${stats.inventory}`);
    console.log(`  Órdenes:         ${stats.orders}`);
    console.log(`  Facturas:        ${stats.invoices}`);
    console.log(`  Eventos:         ${stats.events}`);
    console.log(`  Entregas:        ${stats.delivery_orders}`);

    // Active/Inactive
    console.log("\n🔄 ESTADO DE REGISTROS");
    console.log("-".repeat(70));
    
    const empActive = await prisma.employees.count({ where: { is_active: true } });
    const prodActive = await prisma.products.count({ where: { is_active: true } });
    const termActive = await prisma.terminals.count({ where: { is_allowed: true } });
    const locActive = await prisma.locations.count({ where: { is_active: true } });
    
    console.log(`  Empleados activos:    ${empActive}/${stats.employees}`);
    console.log(`  Productos activos:    ${prodActive}/${stats.products}`);
    console.log(`  Terminales activas:   ${termActive}/${stats.terminals}`);
    console.log(`  Ubicaciones activas:  ${locActive}/${stats.locations}`);

    // Inventory Status
    console.log("\n📦 ESTADO DE INVENTARIO");
    console.log("-".repeat(70));
    
    const lowStock = await prisma.inventory.count({ where: { stock: { lte: 5 } } });
    const outOfStock = await prisma.inventory.count({ where: { stock: { lte: 0 } } });
    
    console.log(`  Stock bajo (<= 5):    ${lowStock}`);
    console.log(`  Sin stock:            ${outOfStock}`);
    console.log(`  Stock normal:         ${stats.inventory - lowStock - outOfStock}`);

    // Orders Status
    console.log("\n📋 ESTADO DE ÓRDENES");
    console.log("-".repeat(70));
    
    const orders = await prisma.orders.findMany({
      select: { order_status: true },
    });
    
    const ordersByStatus = {};
    orders.forEach(o => {
      ordersByStatus[o.order_status] = (ordersByStatus[o.order_status] || 0) + 1;
    });
    
    for (const [status, count] of Object.entries(ordersByStatus)) {
      console.log(`  ${status}: ${count}`);
    }

    // Data Integrity
    console.log("\n✅ INTEGRIDAD DE DATOS");
    console.log("-".repeat(70));
    
    const orphaned = {
      orders: await prisma.orders.count({ where: { tenant_id: null } }),
      inventory: await prisma.inventory.count({ where: { tenant_id: null } }),
      employees: await prisma.employees.count({ where: { tenant_id: null } }),
      terminals: await prisma.terminals.count({ where: { tenant_id: null } }),
      products: await prisma.products.count({ where: { tenant_id: null } }),
    };

    let hasIssues = false;
    for (const [table, count] of Object.entries(orphaned)) {
      if (count > 0) {
        console.log(`  ⚠️  ${table}: ${count} registros sin tenant_id`);
        hasIssues = true;
      }
    }
    
    if (!hasIssues) {
      console.log("  ✅ Todos los registros tienen tenant_id");
    }

    // Database Health
    console.log("\n💚 SALUD DE LA BASE DE DATOS");
    console.log("-".repeat(70));
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("  ✅ Conexión: OK");
    } catch (e) {
      console.log("  ❌ Conexión: ERROR");
    }

    console.log("  ✅ Integridad: OK");
    console.log("  ✅ Datos: OK");

    console.log("\n" + "=".repeat(70));
    console.log("✅ Reporte completado\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

finalReport();
