import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fullReport() {
  console.log("📊 REPORTE COMPLETO DE BASE DE DATOS\n");
  console.log("=" * 60);
  
  try {
    // 1. TENANTS
    console.log("\n1️⃣  TENANTS");
    console.log("-".repeat(60));
    const tenants = await prisma.tenants.findMany();
    console.log(`Total: ${tenants.length}`);
    tenants.forEach(t => {
      console.log(`  ✅ ${t.name} (${t.id})`);
    });

    // 2. EMPLOYEES
    console.log("\n2️⃣  EMPLOYEES");
    console.log("-".repeat(60));
    const empCount = await prisma.employees.count();
    const empActive = await prisma.employees.count({ where: { is_active: true } });
    console.log(`Total: ${empCount} (Activos: ${empActive})`);
    const employees = await prisma.employees.findMany({
      select: { name: true, role: true, is_active: true },
      take: 10,
    });
    employees.forEach(e => {
      const status = e.is_active ? "✅" : "❌";
      console.log(`  ${status} ${e.name} - ${e.role}`);
    });

    // 3. TERMINALS
    console.log("\n3️⃣  TERMINALS");
    console.log("-".repeat(60));
    const termCount = await prisma.terminals.count();
    const termActive = await prisma.terminals.count({ where: { is_allowed: true } });
    console.log(`Total: ${termCount} (Activas: ${termActive})`);
    const terminals = await prisma.terminals.findMany({
      select: { terminal_id: true, is_allowed: true },
      take: 10,
    });
    terminals.forEach(t => {
      const status = t.is_allowed ? "✅" : "❌";
      console.log(`  ${status} Terminal ${t.terminal_id}`);
    });

    // 4. LOCATIONS
    console.log("\n4️⃣  LOCATIONS");
    console.log("-".repeat(60));
    const locCount = await prisma.locations.count();
    console.log(`Total: ${locCount}`);
    const locations = await prisma.locations.findMany({
      select: { name: true, is_active: true },
      take: 10,
    });
    locations.forEach(l => {
      const status = l.is_active ? "✅" : "❌";
      console.log(`  ${status} ${l.name}`);
    });

    // 5. PRODUCTS
    console.log("\n5️⃣  PRODUCTS");
    console.log("-".repeat(60));
    const prodCount = await prisma.products.count();
    const prodActive = await prisma.products.count({ where: { is_active: true } });
    console.log(`Total: ${prodCount} (Activos: ${prodActive})`);
    
    // Get product categories
    const categories = await prisma.products.groupBy({
      by: ["category"],
      _count: true,
    });
    console.log("Por categoría:");
    categories.forEach(c => {
      console.log(`  - ${c.category}: ${c._count}`);
    });

    // 6. INVENTORY
    console.log("\n6️⃣  INVENTORY");
    console.log("-".repeat(60));
    const invCount = await prisma.inventory.count();
    const lowStock = await prisma.inventory.count({
      where: { stock: { lte: 5 } },
    });
    console.log(`Total: ${invCount} (Stock bajo: ${lowStock})`);
    const inventory = await prisma.inventory.findMany({
      select: { name: true, stock: true, min_stock: true },
      take: 10,
    });
    inventory.forEach(i => {
      const status = i.stock <= (i.min_stock || 0) ? "⚠️ " : "✅";
      console.log(`  ${status}${i.name}: ${i.stock} (mín: ${i.min_stock})`);
    });

    // 7. ORDERS
    console.log("\n7️⃣  ORDERS");
    console.log("-".repeat(60));
    const ordCount = await prisma.orders.count();
    const ordByStatus = await prisma.orders.groupBy({
      by: ["order_status"],
      _count: true,
    });
    console.log(`Total: ${ordCount}`);
    console.log("Por estado:");
    ordByStatus.forEach(s => {
      console.log(`  - ${s.order_status}: ${s._count}`);
    });

    // 8. INVOICES
    console.log("\n8️⃣  INVOICES");
    console.log("-".repeat(60));
    const invCount2 = await prisma.invoices.count();
    const invByStatus = await prisma.invoices.groupBy({
      by: ["status"],
      _count: true,
    });
    console.log(`Total: ${invCount2}`);
    console.log("Por estado:");
    invByStatus.forEach(s => {
      console.log(`  - ${s.status}: ${s._count}`);
    });

    // 9. EVENTS
    console.log("\n9️⃣  EVENTS");
    console.log("-".repeat(60));
    const evtCount = await prisma.events.count();
    const evtByType = await prisma.events.groupBy({
      by: ["event_type"],
      _count: true,
    });
    console.log(`Total: ${evtCount}`);
    console.log("Por tipo:");
    evtByType.forEach(t => {
      console.log(`  - ${t.event_type}: ${t._count}`);
    });

    // 10. DATA INTEGRITY
    console.log("\n🔟 INTEGRIDAD DE DATOS");
    console.log("-".repeat(60));
    
    const orphaned = {
      orders: await prisma.orders.count({ where: { tenant_id: null } }),
      inventory: await prisma.inventory.count({ where: { tenant_id: null } }),
      employees: await prisma.employees.count({ where: { tenant_id: null } }),
      terminals: await prisma.terminals.count({ where: { tenant_id: null } }),
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

    console.log("\n" + "=".repeat(60));
    console.log("✅ Reporte completado\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fullReport();
