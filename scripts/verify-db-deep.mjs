import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deepVerify() {
  console.log("🔍 VERIFICACIÓN PROFUNDA DE BASE DE DATOS\n");
  
  try {
    // 1. Check tenant data
    console.log("1️⃣  Verificando TENANTS...");
    const tenants = await prisma.tenants.findMany();
    tenants.forEach(t => {
      console.log(`   ✅ Tenant: ${t.id} - ${t.name}`);
    });

    // 2. Check employees
    console.log("\n2️⃣  Verificando EMPLOYEES...");
    const employees = await prisma.employees.findMany({
      select: { id: true, name: true, role: true, is_active: true },
      take: 5,
    });
    console.log(`   Total: ${await prisma.employees.count()}`);
    employees.forEach(e => {
      console.log(`   - ${e.name} (${e.role}) - ${e.is_active ? "Activo" : "Inactivo"}`);
    });

    // 3. Check terminals
    console.log("\n3️⃣  Verificando TERMINALS...");
    const terminals = await prisma.terminals.findMany({
      select: { id: true, terminal_number: true, location_id: true, is_active: true },
      take: 5,
    });
    console.log(`   Total: ${await prisma.terminals.count()}`);
    terminals.forEach(t => {
      console.log(`   - Terminal ${t.terminal_number} - ${t.is_active ? "Activa" : "Inactiva"}`);
    });

    // 4. Check products
    console.log("\n4️⃣  Verificando PRODUCTS...");
    const productCount = await prisma.products.count();
    const activeProducts = await prisma.products.count({ where: { is_active: true } });
    console.log(`   Total: ${productCount}`);
    console.log(`   Activos: ${activeProducts}`);
    console.log(`   Inactivos: ${productCount - activeProducts}`);

    // 5. Check inventory
    console.log("\n5️⃣  Verificando INVENTORY...");
    const inventory = await prisma.inventory.findMany({
      select: { id: true, name: true, stock: true, min_stock: true },
      take: 5,
    });
    console.log(`   Total: ${await prisma.inventory.count()}`);
    inventory.forEach(i => {
      const status = i.stock <= (i.min_stock || 0) ? "⚠️ BAJO" : "✅";
      console.log(`   ${status} ${i.name}: ${i.stock} (mín: ${i.min_stock})`);
    });

    // 6. Check orders
    console.log("\n6️⃣  Verificando ORDERS...");
    const orders = await prisma.orders.findMany({
      select: { id: true, order_number: true, order_status: true, total_cents: true },
      take: 5,
    });
    console.log(`   Total: ${await prisma.orders.count()}`);
    orders.forEach(o => {
      console.log(`   - Orden #${o.order_number}: ${o.order_status} - S/. ${(o.total_cents / 100).toFixed(2)}`);
    });

    // 7. Check events
    console.log("\n7️⃣  Verificando EVENTS...");
    const eventTypes = await prisma.events.groupBy({
      by: ["event_type"],
      _count: true,
    });
    console.log(`   Total eventos: ${await prisma.events.count()}`);
    eventTypes.forEach((et) => {
      console.log(`   - ${et.event_type}: ${et._count}`);
    });

    // 8. Check data integrity
    console.log("\n8️⃣  Verificando INTEGRIDAD...");
    
    // Check for orphaned records
    const ordersNoTenant = await prisma.orders.count({ where: { tenant_id: null } });
    const inventoryNoTenant = await prisma.inventory.count({ where: { tenant_id: null } });
    const employeesNoTenant = await prisma.employees.count({ where: { tenant_id: null } });
    
    if (ordersNoTenant === 0 && inventoryNoTenant === 0 && employeesNoTenant === 0) {
      console.log("   ✅ Todos los registros tienen tenant_id");
    } else {
      console.log(`   ⚠️  Registros sin tenant_id:`);
      if (ordersNoTenant > 0) console.log(`      - Órdenes: ${ordersNoTenant}`);
      if (inventoryNoTenant > 0) console.log(`      - Inventario: ${inventoryNoTenant}`);
      if (employeesNoTenant > 0) console.log(`      - Empleados: ${employeesNoTenant}`);
    }

    console.log("\n✅ Verificación completada");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deepVerify();
