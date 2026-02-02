import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  console.log("🔍 VERIFICACIÓN DE BASE DE DATOS\n");
  
  try {
    // Test connection
    console.log("1️⃣  Probando conexión...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ Conexión exitosa\n");

    // Count tables
    console.log("2️⃣  Contando registros por tabla...");
    
    const counts = {
      tenants: await prisma.tenants.count(),
      employees: await prisma.employees.count(),
      terminals: await prisma.terminals.count(),
      products: await prisma.products.count(),
      inventory: await prisma.inventory.count(),
      orders: await prisma.orders.count(),
      invoices: await prisma.invoices.count(),
      events: await prisma.events.count(),
      delivery_orders: await prisma.delivery_orders.count(),
      locations: await prisma.locations.count(),
    };

    for (const [table, count] of Object.entries(counts)) {
      console.log(`   ${table}: ${count} registros`);
    }

    console.log("\n✅ Verificación completada");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
