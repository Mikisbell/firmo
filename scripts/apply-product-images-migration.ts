/**
 * Apply Product Images Migration
 * Ejecuta la migración SQL directamente en la base de datos
 */

import prisma from '../src/core/db/prisma';

async function applyMigration() {
  console.log('🔄 Aplicando migración: add_product_images...\n');

  try {
    // Verificar si la columna ya existe
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'images'
    `;

    if (Array.isArray(checkColumn) && checkColumn.length > 0) {
      console.log('✅ La columna "images" ya existe en la tabla products');
      console.log('   No es necesario aplicar la migración\n');
      return;
    }

    console.log('📝 Aplicando cambios a la base de datos...\n');

    // Agregar columna images
    await prisma.$executeRaw`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb
    `;
    console.log('✅ Columna "images" agregada');

    // Crear índice GIN
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_products_images_gin 
      ON products USING GIN (images)
    `;
    console.log('✅ Índice GIN creado');

    // Agregar comentario
    await prisma.$executeRaw`
      COMMENT ON COLUMN products.images IS 'Array of image URLs for the product. Format: [{"url": "https://...", "alt": "...", "is_primary": true}]'
    `;
    console.log('✅ Comentario agregado\n');

    console.log('🎉 Migración aplicada exitosamente!\n');

    // Verificar la migración
    const verify = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'images'
    `;

    console.log('📊 Verificación:');
    console.log(verify);

  } catch (error) {
    console.error('❌ Error al aplicar migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script falló:', error);
    process.exit(1);
  });
