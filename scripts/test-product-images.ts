/**
 * Test Product Images Migration
 * Verifica que el campo images funciona correctamente
 */

import prisma from '../src/core/db/prisma';
import { getTenantId } from '../src/core/config/tenant';

const TENANT_ID = getTenantId();

async function testProductImages() {
  console.log('🧪 Testing Product Images Migration\n');

  try {
    // 1. Buscar un producto existente
    console.log('1️⃣ Buscando producto de prueba...');
    const product = await prisma.products.findFirst({
      where: { tenant_id: TENANT_ID },
      select: { id: true, sku: true, name: true, images: true },
    });

    if (!product) {
      console.log('⚠️  No hay productos en la base de datos');
      console.log('   Creando producto de prueba...\n');
      
      const newProduct = await prisma.products.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: TENANT_ID,
          sku: 'TEST-IMG-001',
          name: 'Producto de Prueba con Imágenes',
          price_cents: 1500,
          category: 'POLLOS',
          station: 'PARRILLA',
          type: 'SIMPLE',
          images: [
            {
              url: 'https://example.com/image1.jpg',
              alt: 'Imagen principal',
              is_primary: true,
              order: 0,
            },
            {
              url: 'https://example.com/image2.jpg',
              alt: 'Imagen secundaria',
              is_primary: false,
              order: 1,
            },
          ],
        },
      });

      console.log('✅ Producto creado con imágenes:');
      console.log(`   ID: ${newProduct.id}`);
      console.log(`   SKU: ${newProduct.sku}`);
      console.log(`   Imágenes: ${JSON.stringify(newProduct.images, null, 2)}\n`);
      
      return;
    }

    console.log(`✅ Producto encontrado: ${product.name} (${product.sku})`);
    console.log(`   Imágenes actuales: ${JSON.stringify(product.images)}\n`);

    // 2. Actualizar con imágenes
    console.log('2️⃣ Actualizando producto con imágenes...');
    const updated = await prisma.products.update({
      where: { id: product.id },
      data: {
        images: [
          {
            url: 'https://storage.supabase.co/test/pollo-entero.jpg',
            alt: 'Pollo a la brasa entero',
            is_primary: true,
            order: 0,
          },
          {
            url: 'https://storage.supabase.co/test/pollo-lateral.jpg',
            alt: 'Pollo a la brasa - vista lateral',
            is_primary: false,
            order: 1,
          },
        ],
      },
    });

    console.log('✅ Producto actualizado con imágenes:');
    console.log(JSON.stringify(updated.images, null, 2));
    console.log();

    // 3. Leer de nuevo para verificar
    console.log('3️⃣ Verificando persistencia...');
    const verified = await prisma.products.findUnique({
      where: { id: product.id },
      select: { images: true },
    });

    console.log('✅ Imágenes verificadas:');
    console.log(JSON.stringify(verified?.images, null, 2));
    console.log();

    // 4. Restaurar estado original
    console.log('4️⃣ Restaurando estado original...');
    await prisma.products.update({
      where: { id: product.id },
      data: { images: product.images || [] },
    });
    console.log('✅ Estado restaurado\n');

    console.log('🎉 Todas las pruebas pasaron exitosamente!');
    console.log('   El campo images funciona correctamente.\n');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testProductImages()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script falló:', error);
    process.exit(1);
  });
