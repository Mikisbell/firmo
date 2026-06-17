import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "tenant_settings" 
    ADD COLUMN IF NOT EXISTS "table_inactivity_threshold_min" INTEGER NOT NULL DEFAULT 15;
  `);
  console.log("Column added successfully");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
