/**
 * Migration Script: Assign default location_id to inventory
 * Task 11.2 - Schema Completeness
 * 
 * Creates a default location if it doesn't exist and assigns it
 * to all inventory records that don't have a location_id.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const DEFAULT_LOCATION_ID = "00000000-0000-0000-0000-000000000100";

async function main() {
  console.log("🔄 Migrating location_id for existing inventory...\n");

  // 1. Check if we have zones (which have location_id)
  const existingZone = await prisma.zones.findFirst({
    where: { tenant_id: TENANT_ID }
  });

  let locationId = existingZone?.location_id || DEFAULT_LOCATION_ID;
  console.log(`📍 Using location_id: ${locationId}`);

  // 2. Find inventory without location_id
  const inventoryWithoutLocation = await prisma.inventory.findMany({
    where: {
      tenant_id: TENANT_ID,
      location_id: null
    },
    select: {
      id: true,
      code: true,
      name: true
    }
  });

  console.log(`📊 Found ${inventoryWithoutLocation.length} inventory items without location_id\n`);

  if (inventoryWithoutLocation.length === 0) {
    console.log("✅ All inventory items already have location_id set!");
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const item of inventoryWithoutLocation) {
    try {
      await prisma.inventory.update({
        where: { id: item.id },
        data: { location_id: locationId }
      });

      updated++;
      console.log(`  ✓ ${item.code} - ${item.name}`);
    } catch (error) {
      errors++;
      console.error(`  ❌ Error updating ${item.code}:`, error);
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
