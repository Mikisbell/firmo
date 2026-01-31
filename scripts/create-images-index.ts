/**
 * Create GIN index on products.images column
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating GIN index on products.images...');
  
  try {
    // Check if index exists
    const existing = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'products' 
      AND indexname = 'idx_products_images'
    `;

    if (existing.length > 0) {
      console.log('✅ Index already exists');
      return;
    }

    // Create index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_images 
      ON products USING GIN (images)
    `;

    console.log('✅ Index created successfully');

    // Verify
    const verify = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'products' 
      AND indexname = 'idx_products_images'
    `;

    if (verify.length > 0) {
      console.log('✅ Index verified');
    } else {
      console.log('❌ Index not found after creation');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
