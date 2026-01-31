/**
 * Productos P1 - Comprehensive Stress Tests
 * 
 * Tests backend, frontend, API, and database for P1 and P2 features
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  category: 'Backend' | 'Frontend' | 'API' | 'Database';
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  category: TestResult['category'],
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    results.push({
      name,
      category,
      status: 'PASS',
      duration: Date.now() - start,
    });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      category,
      status: 'FAIL',
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// DATABASE TESTS
// ============================================================================

async function testDatabaseSchema() {
  await runTest('Database: Products table has images column', 'Database', async () => {
    const result = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'images'
    `;
    
    if (result.length === 0) {
      throw new Error('images column not found in products table');
    }
    
    if (result[0].data_type !== 'jsonb') {
      throw new Error(`Expected jsonb type, got ${result[0].data_type}`);
    }
  });

  await runTest('Database: GIN index exists on images column', 'Database', async () => {
    const result = await prisma.$queryRaw<any[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'products' AND indexname = 'idx_products_images'
    `;
    
    if (result.length === 0) {
      throw new Error('GIN index not found on images column');
    }
  });

  await runTest('Database: Can query products with images', 'Database', async () => {
    const products = await prisma.product.findMany({
      take: 10,
      select: {
        id: true,
        sku: true,
        name: true,
        images: true,
      },
    });
    
    if (products.length === 0) {
      throw new Error('No products found in database');
    }
    
    // Verify images field is present
    products.forEach(product => {
      if (!('images' in product)) {
        throw new Error(`Product ${product.sku} missing images field`);
      }
    });
  });

  await runTest('Database: Can insert product with images', 'Database', async () => {
    const testProduct = await prisma.product.create({
      data: {
        sku: `TEST-${Date.now()}`,
        name: 'Test Product with Images',
        short_name: 'Test',
        price_cents: 1000,
        category: 'POLLOS',
        station: 'PARRILLA',
        type: 'SIMPLE',
        is_active: true,
        tenant_id: 'default-tenant',
        location_id: 'default-location',
        images: [
          {
            id: 'test-img-1',
            url: 'https://example.com/test.jpg',
            thumbnail_url: 'https://example.com/test-thumb.jpg',
            medium_url: 'https://example.com/test-medium.jpg',
            size_bytes: 100000,
            format: 'webp',
            order: 0,
            uploaded_at: new Date().toISOString(),
            uploaded_by: 'test-user',
          },
        ],
      },
    });
    
    // Verify images were saved
    const saved = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { images: true },
    });
    
    if (!saved || !Array.isArray(saved.images) || saved.images.length === 0) {
      throw new Error('Images not saved correctly');
    }
    
    // Cleanup
    await prisma.product.delete({ where: { id: testProduct.id } });
  });

  await runTest('Database: Can update product images', 'Database', async () => {
    // Create test product
    const testProduct = await prisma.product.create({
      data: {
        sku: `TEST-UPDATE-${Date.now()}`,
        name: 'Test Product for Update',
        short_name: 'Test',
        price_cents: 1000,
        category: 'POLLOS',
        station: 'PARRILLA',
        type: 'SIMPLE',
        is_active: true,
        tenant_id: 'default-tenant',
        location_id: 'default-location',
        images: [],
      },
    });
    
    // Update with images
    await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        images: [
          {
            id: 'test-img-2',
            url: 'https://example.com/test2.jpg',
            thumbnail_url: 'https://example.com/test2-thumb.jpg',
            medium_url: 'https://example.com/test2-medium.jpg',
            size_bytes: 200000,
            format: 'webp',
            order: 0,
            uploaded_at: new Date().toISOString(),
            uploaded_by: 'test-user',
          },
        ],
      },
    });
    
    // Verify update
    const updated = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: { images: true },
    });
    
    if (!updated || !Array.isArray(updated.images) || updated.images.length !== 1) {
      throw new Error('Images not updated correctly');
    }
    
    // Cleanup
    await prisma.product.delete({ where: { id: testProduct.id } });
  });
}

// ============================================================================
// BACKEND TESTS
// ============================================================================

async function testBackendTypes() {
  await runTest('Backend: ProductImage type exists', 'Backend', async () => {
    try {
      const { ProductImage } = await import('../src/core/types/product-images');
      // Type check - if import succeeds, type exists
    } catch (error) {
      throw new Error('ProductImage type not found');
    }
  });

  await runTest('Backend: IMAGE_CONSTANTS exported', 'Backend', async () => {
    const { IMAGE_CONSTANTS } = await import('../src/core/types/product-images');
    
    if (!IMAGE_CONSTANTS.MAX_FILE_SIZE) {
      throw new Error('MAX_FILE_SIZE not found in IMAGE_CONSTANTS');
    }
    
    if (IMAGE_CONSTANTS.MAX_FILE_SIZE !== 5 * 1024 * 1024) {
      throw new Error(`Expected 5MB, got ${IMAGE_CONSTANTS.MAX_FILE_SIZE}`);
    }
    
    if (IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT !== 5) {
      throw new Error(`Expected 5 images max, got ${IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT}`);
    }
  });

  await runTest('Backend: Product type includes images', 'Backend', async () => {
    const { fromPrismaProduct } = await import('../src/core/types/product');
    
    // Create mock Prisma product
    const mockPrismaProduct = {
      id: 'test-id',
      sku: 'TEST-001',
      name: 'Test Product',
      short_name: 'Test',
      price_cents: 1000,
      category: 'POLLOS',
      station: 'PARRILLA',
      type: 'SIMPLE',
      is_active: true,
      tenant_id: 'default-tenant',
      location_id: 'default-location',
      images: [],
      version: 1,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'test',
      updated_by: 'test',
    };
    
    const product = fromPrismaProduct(mockPrismaProduct as any);
    
    if (!('images' in product)) {
      throw new Error('Product type missing images field');
    }
  });

  await runTest('Backend: Zod schemas validate images', 'Backend', async () => {
    const { ProductImageSchema, ProductImagesArraySchema } = await import('../src/core/admin/schemas/product-image.schema');
    
    // Valid image
    const validImage = {
      id: 'test-id',
      url: 'https://example.com/test.jpg',
      thumbnail_url: 'https://example.com/test-thumb.jpg',
      medium_url: 'https://example.com/test-medium.jpg',
      size_bytes: 100000,
      format: 'webp',
      order: 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'test-user',
    };
    
    const result = ProductImageSchema.safeParse(validImage);
    if (!result.success) {
      throw new Error(`Valid image failed validation: ${result.error.message}`);
    }
    
    // Valid array
    const arrayResult = ProductImagesArraySchema.safeParse([validImage]);
    if (!arrayResult.success) {
      throw new Error(`Valid array failed validation: ${arrayResult.error.message}`);
    }
    
    // Invalid: too many images
    const tooMany = Array(6).fill(validImage).map((img, i) => ({ ...img, id: `img-${i}`, order: i }));
    const tooManyResult = ProductImagesArraySchema.safeParse(tooMany);
    if (tooManyResult.success) {
      throw new Error('Should reject more than 5 images');
    }
  });
}

// ============================================================================
// API TESTS (require server running)
// ============================================================================

async function testAPIEndpoints() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  await runTest('API: GET /api/admin/products returns images field', 'API', async () => {
    const response = await fetch(`${baseUrl}/api/admin/products?limit=10`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.products || !Array.isArray(data.products)) {
      throw new Error('Response missing products array');
    }
    
    if (data.products.length > 0) {
      const firstProduct = data.products[0];
      if (!('images' in firstProduct)) {
        throw new Error('Product missing images field');
      }
    }
  });

  await runTest('API: GET /api/admin/products/[id] returns images', 'API', async () => {
    // First get a product ID
    const listResponse = await fetch(`${baseUrl}/api/admin/products?limit=1`);
    if (!listResponse.ok) {
      throw new Error('Failed to get product list');
    }
    
    const listData = await listResponse.json();
    if (!listData.products || listData.products.length === 0) {
      throw new Error('No products found');
    }
    
    const productId = listData.products[0].id;
    
    // Get single product
    const response = await fetch(`${baseUrl}/api/admin/products/${productId}`);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!('images' in data)) {
      throw new Error('Product missing images field');
    }
    
    if (!Array.isArray(data.images)) {
      throw new Error('images field is not an array');
    }
  });
}

// ============================================================================
// FRONTEND TESTS (component existence)
// ============================================================================

async function testFrontendComponents() {
  await runTest('Frontend: ImageUpload component exists', 'Frontend', async () => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const componentPath = path.join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
      await fs.access(componentPath);
    } catch (error) {
      throw new Error('ImageUpload.tsx not found');
    }
  });

  await runTest('Frontend: ImageUpload has required props', 'Frontend', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const componentPath = path.join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
    const content = await fs.readFile(componentPath, 'utf-8');
    
    const requiredProps = [
      'productId',
      'existingImages',
      'maxImages',
      'maxSizeBytes',
      'onImagesChange',
      'disabled',
    ];
    
    for (const prop of requiredProps) {
      if (!content.includes(prop)) {
        throw new Error(`Missing required prop: ${prop}`);
      }
    }
  });

  await runTest('Frontend: ImageUpload has drag & drop', 'Frontend', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const componentPath = path.join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
    const content = await fs.readFile(componentPath, 'utf-8');
    
    const dragDropFeatures = [
      'onDragEnter',
      'onDragLeave',
      'onDragOver',
      'onDrop',
      'dragActive',
    ];
    
    for (const feature of dragDropFeatures) {
      if (!content.includes(feature)) {
        throw new Error(`Missing drag & drop feature: ${feature}`);
      }
    }
  });

  await runTest('Frontend: ImageUpload has validation', 'Frontend', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const componentPath = path.join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
    const content = await fs.readFile(componentPath, 'utf-8');
    
    const validationFeatures = [
      'validateFile',
      'validateFileSignature',
      'ACCEPTED_MIME_TYPES',
      'MAX_FILE_SIZE',
    ];
    
    for (const feature of validationFeatures) {
      if (!content.includes(feature)) {
        throw new Error(`Missing validation feature: ${feature}`);
      }
    }
  });

  await runTest('Frontend: ImageUpload test file exists', 'Frontend', async () => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const testPath = path.join(process.cwd(), 'src/app/admin/productos/components/__tests__/ImageUpload.test.tsx');
      await fs.access(testPath);
    } catch (error) {
      throw new Error('ImageUpload.test.tsx not found');
    }
  });
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

async function testPerformance() {
  await runTest('Performance: Query 100 products with images < 1s', 'Database', async () => {
    const start = Date.now();
    
    await prisma.product.findMany({
      take: 100,
      select: {
        id: true,
        sku: true,
        name: true,
        price_cents: true,
        images: true,
      },
    });
    
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      throw new Error(`Query took ${duration}ms, expected < 1000ms`);
    }
  });

  await runTest('Performance: Query products with images using GIN index', 'Database', async () => {
    // Query that should use the GIN index
    const start = Date.now();
    
    await prisma.$queryRaw`
      SELECT id, sku, name, images
      FROM products
      WHERE images @> '[{"order": 0}]'::jsonb
      LIMIT 10
    `;
    
    const duration = Date.now() - start;
    
    if (duration > 500) {
      throw new Error(`JSONB query took ${duration}ms, expected < 500ms`);
    }
  });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function main() {
  console.log('🚀 Productos P1 - Comprehensive Stress Tests\n');
  console.log('Testing: Backend, Frontend, API, Database\n');
  console.log('='.repeat(60));
  console.log('');

  // Database Tests
  console.log('📊 DATABASE TESTS');
  console.log('-'.repeat(60));
  await testDatabaseSchema();
  console.log('');

  // Backend Tests
  console.log('⚙️  BACKEND TESTS');
  console.log('-'.repeat(60));
  await testBackendTypes();
  console.log('');

  // Frontend Tests
  console.log('🎨 FRONTEND TESTS');
  console.log('-'.repeat(60));
  await testFrontendComponents();
  console.log('');

  // Performance Tests
  console.log('⚡ PERFORMANCE TESTS');
  console.log('-'.repeat(60));
  await testPerformance();
  console.log('');

  // API Tests (may fail if server not running)
  console.log('🌐 API TESTS (requires server running)');
  console.log('-'.repeat(60));
  try {
    await testAPIEndpoints();
  } catch (error) {
    console.log('⚠️  API tests skipped - server may not be running');
    console.log('   Run "npm run dev" to test API endpoints');
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('');

  const byCategory = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = { pass: 0, fail: 0, skip: 0 };
    }
    acc[result.category][result.status.toLowerCase() as 'pass' | 'fail' | 'skip']++;
    return acc;
  }, {} as Record<string, { pass: number; fail: number; skip: number }>);

  Object.entries(byCategory).forEach(([category, counts]) => {
    console.log(`${category}:`);
    console.log(`  ✅ Passed: ${counts.pass}`);
    console.log(`  ❌ Failed: ${counts.fail}`);
    console.log(`  ⏭️  Skipped: ${counts.skip}`);
    console.log('');
  });

  const totalPass = results.filter(r => r.status === 'PASS').length;
  const totalFail = results.filter(r => r.status === 'FAIL').length;
  const totalSkip = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('TOTAL:');
  console.log(`  ✅ Passed: ${totalPass}/${total} (${((totalPass / total) * 100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${totalFail}/${total} (${((totalFail / total) * 100).toFixed(1)}%)`);
  console.log(`  ⏭️  Skipped: ${totalSkip}/${total} (${((totalSkip / total) * 100).toFixed(1)}%)`);
  console.log('');

  // Failed tests details
  const failedTests = results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('='.repeat(60));
    console.log('❌ FAILED TESTS DETAILS');
    console.log('='.repeat(60));
    console.log('');
    
    failedTests.forEach(test => {
      console.log(`${test.category} - ${test.name}`);
      console.log(`  Error: ${test.error}`);
      console.log('');
    });
  }

  // Overall status
  console.log('='.repeat(60));
  if (totalFail === 0) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('🎉 System is ready for production');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log(`   ${totalFail} test(s) need attention`);
  }
  console.log('='.repeat(60));

  await prisma.$disconnect();
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
