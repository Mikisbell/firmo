/**
 * Migration Script: Calculate business_date for existing orders
 * Task 11.1 - Schema Completeness
 * 
 * Uses getBusinessDate(created_at) to populate business_date field
 * for all orders that don't have it set.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CUTOFF_HOUR = 6; // 6 AM

function getBusinessDate(timestamp: Date): string {
  const date = new Date(timestamp);
  const hour = date.getHours();
  
  // Si es antes de las 6 AM, pertenece al día anterior
  if (hour < CUTOFF_HOUR) {
    date.setDate(date.getDate() - 1);
  }
  
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

async function main() {
  console.log("🔄 Migrating business_date for existing orders...\n");

  // Find orders without business_date
  const ordersWithoutDate = await prisma.orders.findMany({
    where: {
      business_date: null
    },
    select: {
      id: true,
      order_number: true,
      created_at: true
    }
  });

  console.log(`📊 Found ${ordersWithoutDate.length} orders without business_date\n`);

  if (ordersWithoutDate.length === 0) {
    console.log("✅ All orders already have business_date set!");
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const order of ordersWithoutDate) {
    try {
      const businessDate = getBusinessDate(order.created_at);
      
      await prisma.orders.update({
        where: { id: order.id },
        data: { business_date: new Date(businessDate) }
      });

      updated++;
      if (updated % 100 === 0) {
        console.log(`  Updated ${updated}/${ordersWithoutDate.length}...`);
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Error updating order ${order.order_number}:`, error);
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
