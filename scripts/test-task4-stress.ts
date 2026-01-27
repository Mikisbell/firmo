/**
 * Pruebas de Estrés - Task 4: Image Storage Service
 * 
 * Valida:
 * - Frontend: ImageUpload component
 * - Backend: Image Service (Sharp, Supabase)
 * - Database: Prisma queries
 * - API: Endpoints (cuando se implementen)
 * - Types: ProductImage, Product
 */

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import {
  validateFile,
  validateFileSignature,
  optimizeImage,
  generateImageVersions,
} from '../src/core/images/image.service';
import type { ProductImage } from '../src/core/types/product-images';
import { IMAGE_CONSTANTS } from '../src/core/types/product-images';
import {
  getPrimaryImage,
  hasImages,
  canAddMoreImages,
} from '../src/core/types/product';

// ============================================================================
// Test Configuration
// ============================================================================

const prisma = new PrismaClient();

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration?: number;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function logTest(category: string, test: string, status: 'PASS' | 'FAIL' | 'SKIP', duration?: number, error?: string, details?: string) {
  results.push({ category, test, status, duration, error, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} [${category}] ${test}${duration ? ` (${duration}ms)` : ''}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   ${details}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

function createMockFile(name: string, size: number, type: string): File {
  const buffer = Buffer.alloc(size);
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array], { type });
  return new File([blob], name, { type });
}

async function createTestImageBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 128, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

// ============================================================================
// 1. FRONTEND TESTS
// ============================================================================

async function testFrontend() {
  console.log('\n📱 FRONTEND TESTS\n');

  // Test 1.1: ImageUpload component exists
  try {
    const start = Date.now();
    const ImageUpload = await import('../src/app/admin/productos/components/ImageUpload');
    const duration = Date.now() - start;
    logTest('Frontend', 'ImageUpload component imports', 'PASS', duration);
  } catch (error) {
    logTest('Frontend', 'ImageUpload component imports', 'FAIL', undefined, String(error));
  }

  // Test 1.2: ProductImage types exported
  try {
    const start = Date.now();
    const imageTypes = await import('../src/core/types/product-images');
    const productTypes = await import('../src/core/types/product');
    const hasTypes = imageTypes.IMAGE_CONSTANTS && productTypes.getPrimaryImage && productTypes.hasImages;
    const duration = Date.now() - start;
    if (hasTypes) {
      logTest('Frontend', 'ProductImage types exported', 'PASS', duration);
    } else {
      logTest('Frontend', 'ProductImage types exported', 'FAIL', duration, 'Missing exports');
    }
  } catch (error) {
    logTest('Frontend', 'ProductImage types exported', 'FAIL', undefined, String(error));
  }

  // Test 1.3: IMAGE_CONSTANTS values
  try {
    const start = Date.now();
    const valid = 
      IMAGE_CONSTANTS.MAX_FILE_SIZE === 5 * 1024 * 1024 &&
      IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT === 5 &&
      IMAGE_CONSTANTS.ACCEPTED_MIME_TYPES.length === 3;
    const duration = Date.now() - start;
    if (valid) {
      logTest('Frontend', 'IMAGE_CONSTANTS values correct', 'PASS', duration);
    } else {
      logTest('Frontend', 'IMAGE_CONSTANTS values correct', 'FAIL', duration, 'Invalid constants');
    }
  } catch (error) {
    logTest('Frontend', 'IMAGE_CONSTANTS values correct', 'FAIL', undefined, String(error));
  }

  // Test 1.4: Helper functions work
  try {
    const start = Date.now();
    const mockProduct = {
      id: 'test-id',
      images: [
        { id: '1', url: 'url1', thumbnail_url: 'thumb1', medium_url: 'med1', size_bytes: 1000, format: 'webp' as const, order: 0, uploaded_at: new Date().toISOString(), uploaded_by: 'user1' },
        { id: '2', url: 'url2', thumbnail_url: 'thumb2', medium_url: 'med2', size_bytes: 2000, format: 'webp' as const, order: 1, uploaded_at: new Date().toISOString(), uploaded_by: 'user1' },
      ],
    };
    
    const primary = getPrimaryImage(mockProduct as any);
    const hasImgs = hasImages(mockProduct as any);
    const canAdd = canAddMoreImages(mockProduct as any);
    
    const duration = Date.now() - start;
    if (primary && hasImgs && canAdd) {
      logTest('Frontend', 'Helper functions work', 'PASS', duration, undefined, `Primary: ${primary.id}, Has: ${hasImgs}, CanAdd: ${canAdd}`);
    } else {
      logTest('Frontend', 'Helper functions work', 'FAIL', duration, 'Helpers returned unexpected values');
    }
  } catch (error) {
    logTest('Frontend', 'Helper functions work', 'FAIL', undefined, String(error));
  }
}

// ============================================================================
// 2. BACKEND TESTS (Image Service)
// ============================================================================

async function testBackend() {
  console.log('\n⚙️ BACKEND TESTS (Image Service)\n');

  // Test 2.1: validateFile - valid file
  try {
    const start = Date.now();
    const file = createMockFile('test.jpg', 3 * 1024 * 1024, 'image/jpeg');
    const result = validateFile(file);
    const duration = Date.now() - start;
    if (result.valid) {
      logTest('Backend', 'validateFile accepts valid 3MB JPG', 'PASS', duration);
    } else {
      logTest('Backend', 'validateFile accepts valid 3MB JPG', 'FAIL', duration, result.error);
    }
  } catch (error) {
    logTest('Backend', 'validateFile accepts valid 3MB JPG', 'FAIL', undefined, String(error));
  }

  // Test 2.2: validateFile - file too large
  try {
    const start = Date.now();
    const file = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
    const result = validateFile(file);
    const duration = Date.now() - start;
    if (!result.valid && result.error?.includes('5MB')) {
      logTest('Backend', 'validateFile rejects 6MB file', 'PASS', duration);
    } else {
      logTest('Backend', 'validateFile rejects 6MB file', 'FAIL', duration, 'Should reject large file');
    }
  } catch (error) {
    logTest('Backend', 'validateFile rejects 6MB file', 'FAIL', undefined, String(error));
  }

  // Test 2.3: validateFile - invalid format
  try {
    const start = Date.now();
    const file = createMockFile('doc.pdf', 1024 * 1024, 'application/pdf');
    const result = validateFile(file);
    const duration = Date.now() - start;
    if (!result.valid && result.error?.includes('format')) {
      logTest('Backend', 'validateFile rejects PDF', 'PASS', duration);
    } else {
      logTest('Backend', 'validateFile rejects PDF', 'FAIL', duration, 'Should reject PDF');
    }
  } catch (error) {
    logTest('Backend', 'validateFile rejects PDF', 'FAIL', undefined, String(error));
  }

  // Test 2.4: validateFileSignature - PNG
  try {
    const start = Date.now();
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateFileSignature(pngBuffer, 'image/png');
    const duration = Date.now() - start;
    if (result) {
      logTest('Backend', 'validateFileSignature validates PNG', 'PASS', duration);
    } else {
      logTest('Backend', 'validateFileSignature validates PNG', 'FAIL', duration, 'Should validate PNG signature');
    }
  } catch (error) {
    logTest('Backend', 'validateFileSignature validates PNG', 'FAIL', undefined, String(error));
  }

  // Test 2.5: validateFileSignature - fake extension
  try {
    const start = Date.now();
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateFileSignature(pngBuffer, 'image/jpeg');
    const duration = Date.now() - start;
    if (!result) {
      logTest('Backend', 'validateFileSignature rejects fake extension', 'PASS', duration);
    } else {
      logTest('Backend', 'validateFileSignature rejects fake extension', 'FAIL', duration, 'Should reject fake extension');
    }
  } catch (error) {
    logTest('Backend', 'validateFileSignature rejects fake extension', 'FAIL', undefined, String(error));
  }

  // Test 2.6: optimizeImage - resize
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(2000, 2000);
    const optimized = await optimizeImage(inputBuffer, { width: 800, height: 800, format: 'webp' });
    const metadata = await sharp(optimized).metadata();
    const duration = Date.now() - start;
    if (metadata.width && metadata.width <= 800 && metadata.format === 'webp') {
      logTest('Backend', 'optimizeImage resizes to 800x800', 'PASS', duration, undefined, `Result: ${metadata.width}x${metadata.height} ${metadata.format}`);
    } else {
      logTest('Backend', 'optimizeImage resizes to 800x800', 'FAIL', duration, 'Invalid resize result');
    }
  } catch (error) {
    logTest('Backend', 'optimizeImage resizes to 800x800', 'FAIL', undefined, String(error));
  }

  // Test 2.7: optimizeImage - maintains aspect ratio
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(1600, 800);
    const optimized = await optimizeImage(inputBuffer, { width: 800, height: 800, format: 'webp' });
    const metadata = await sharp(optimized).metadata();
    const duration = Date.now() - start;
    const aspectRatio = metadata.width! / metadata.height!;
    if (Math.abs(aspectRatio - 2) < 0.1) {
      logTest('Backend', 'optimizeImage maintains aspect ratio', 'PASS', duration, undefined, `Aspect ratio: ${aspectRatio.toFixed(2)}`);
    } else {
      logTest('Backend', 'optimizeImage maintains aspect ratio', 'FAIL', duration, `Wrong aspect ratio: ${aspectRatio}`);
    }
  } catch (error) {
    logTest('Backend', 'optimizeImage maintains aspect ratio', 'FAIL', undefined, String(error));
  }

  // Test 2.8: optimizeImage - doesn't upscale
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(100, 100);
    const optimized = await optimizeImage(inputBuffer, { width: 800, height: 800, format: 'webp' });
    const metadata = await sharp(optimized).metadata();
    const duration = Date.now() - start;
    if (metadata.width === 100 && metadata.height === 100) {
      logTest('Backend', 'optimizeImage doesn\'t upscale small images', 'PASS', duration);
    } else {
      logTest('Backend', 'optimizeImage doesn\'t upscale small images', 'FAIL', duration, `Upscaled to ${metadata.width}x${metadata.height}`);
    }
  } catch (error) {
    logTest('Backend', 'optimizeImage doesn\'t upscale small images', 'FAIL', undefined, String(error));
  }

  // Test 2.9: generateImageVersions - creates 3 versions
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(2000, 2000);
    const versions = await generateImageVersions(inputBuffer);
    const duration = Date.now() - start;
    if (versions.original && versions.medium && versions.thumbnail) {
      logTest('Backend', 'generateImageVersions creates 3 versions', 'PASS', duration, undefined, 
        `Original: ${versions.original.width}x${versions.original.height}, Medium: ${versions.medium.width}x${versions.medium.height}, Thumb: ${versions.thumbnail.width}x${versions.thumbnail.height}`);
    } else {
      logTest('Backend', 'generateImageVersions creates 3 versions', 'FAIL', duration, 'Missing versions');
    }
  } catch (error) {
    logTest('Backend', 'generateImageVersions creates 3 versions', 'FAIL', undefined, String(error));
  }

  // Test 2.10: generateImageVersions - correct sizes
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(3000, 3000);
    const versions = await generateImageVersions(inputBuffer);
    const duration = Date.now() - start;
    const originalOk = versions.original.width <= 1920 && versions.original.height <= 1920;
    const mediumOk = versions.medium.width <= 800 && versions.medium.height <= 800;
    const thumbOk = versions.thumbnail.width <= 200 && versions.thumbnail.height <= 200;
    if (originalOk && mediumOk && thumbOk) {
      logTest('Backend', 'generateImageVersions respects max dimensions', 'PASS', duration);
    } else {
      logTest('Backend', 'generateImageVersions respects max dimensions', 'FAIL', duration, 
        `Original: ${originalOk}, Medium: ${mediumOk}, Thumb: ${thumbOk}`);
    }
  } catch (error) {
    logTest('Backend', 'generateImageVersions respects max dimensions', 'FAIL', undefined, String(error));
  }

  // Test 2.11: generateImageVersions - decreasing sizes
  try {
    const start = Date.now();
    const inputBuffer = await createTestImageBuffer(2000, 2000);
    const versions = await generateImageVersions(inputBuffer);
    const duration = Date.now() - start;
    const sizesCorrect = 
      versions.original.size > versions.medium.size &&
      versions.medium.size > versions.thumbnail.size;
    if (sizesCorrect) {
      logTest('Backend', 'generateImageVersions has decreasing file sizes', 'PASS', duration, undefined,
        `Original: ${(versions.original.size / 1024).toFixed(1)}KB, Medium: ${(versions.medium.size / 1024).toFixed(1)}KB, Thumb: ${(versions.thumbnail.size / 1024).toFixed(1)}KB`);
    } else {
      logTest('Backend', 'generateImageVersions has decreasing file sizes', 'FAIL', duration, 'Sizes not decreasing');
    }
  } catch (error) {
    logTest('Backend', 'generateImageVersions has decreasing file sizes', 'FAIL', undefined, String(error));
  }
}

// ============================================================================
// 3. DATABASE TESTS (Prisma)
// ============================================================================

async function testDatabase() {
  console.log('\n🗄️ DATABASE TESTS (Prisma)\n');

  // Test 3.1: Prisma client connects
  try {
    const start = Date.now();
    await prisma.$connect();
    const duration = Date.now() - start;
    logTest('Database', 'Prisma client connects', 'PASS', duration);
  } catch (error) {
    logTest('Database', 'Prisma client connects', 'FAIL', undefined, String(error));
    return; // Skip remaining tests if connection fails
  }

  // Test 3.2: Products table exists
  try {
    const start = Date.now();
    const count = await prisma.product.count();
    const duration = Date.now() - start;
    logTest('Database', 'Products table exists', 'PASS', duration, undefined, `${count} products found`);
  } catch (error) {
    logTest('Database', 'Products table exists', 'FAIL', undefined, String(error));
  }

  // Test 3.3: Products table has images column
  try {
    const start = Date.now();
    const product = await prisma.product.findFirst({
      select: { id: true, images: true },
    });
    const duration = Date.now() - start;
    if (product !== null) {
      logTest('Database', 'Products table has images column', 'PASS', duration, undefined, 
        `Images type: ${typeof product.images}, Value: ${JSON.stringify(product.images)}`);
    } else {
      logTest('Database', 'Products table has images column', 'SKIP', duration, 'No products in database');
    }
  } catch (error) {
    logTest('Database', 'Products table has images column', 'FAIL', undefined, String(error));
  }

  // Test 3.4: Can query products with images filter
  try {
    const start = Date.now();
    const products = await prisma.$queryRaw`
      SELECT id, name, images 
      FROM products 
      WHERE jsonb_array_length(images) > 0 
      LIMIT 5
    `;
    const duration = Date.now() - start;
    logTest('Database', 'Can query products with images filter', 'PASS', duration, undefined, 
      `Found ${Array.isArray(products) ? products.length : 0} products with images`);
  } catch (error) {
    logTest('Database', 'Can query products with images filter', 'FAIL', undefined, String(error));
  }

  // Test 3.5: Can update product with images
  try {
    const start = Date.now();
    const testProduct = await prisma.product.findFirst();
    if (testProduct) {
      const mockImages: ProductImage[] = [
        {
          id: 'test-img-1',
          url: 'https://example.com/test.webp',
          thumbnail_url: 'https://example.com/test-thumb.webp',
          medium_url: 'https://example.com/test-medium.webp',
          size_bytes: 50000,
          format: 'webp',
          order: 0,
          uploaded_at: new Date().toISOString(),
          uploaded_by: 'test-user',
        },
      ];
      
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { images: mockImages as any },
      });
      
      const updated = await prisma.product.findUnique({
        where: { id: testProduct.id },
        select: { images: true },
      });
      
      const duration = Date.now() - start;
      
      // Restore original state
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { images: testProduct.images },
      });
      
      if (updated && Array.isArray(updated.images) && updated.images.length > 0) {
        logTest('Database', 'Can update product with images', 'PASS', duration);
      } else {
        logTest('Database', 'Can update product with images', 'FAIL', duration, 'Update failed');
      }
    } else {
      logTest('Database', 'Can update product with images', 'SKIP', undefined, 'No products to test');
    }
  } catch (error) {
    logTest('Database', 'Can update product with images', 'FAIL', undefined, String(error));
  }

  // Test 3.6: GIN index exists on images column
  try {
    const start = Date.now();
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'products' 
      AND indexname LIKE '%images%'
    `;
    const duration = Date.now() - start;
    if (indexes.length > 0) {
      logTest('Database', 'GIN index exists on images column', 'PASS', duration, undefined, 
        `Index: ${indexes[0].indexname}`);
    } else {
      logTest('Database', 'GIN index exists on images column', 'FAIL', duration, 'No index found');
    }
  } catch (error) {
    logTest('Database', 'GIN index exists on images column', 'FAIL', undefined, String(error));
  }
}

// ============================================================================
// 4. TYPES TESTS
// ============================================================================

async function testTypes() {
  console.log('\n📝 TYPES TESTS\n');

  // Test 4.1: ProductImage type structure
  try {
    const start = Date.now();
    const mockImage: ProductImage = {
      id: 'test-id',
      url: 'https://example.com/image.webp',
      thumbnail_url: 'https://example.com/thumb.webp',
      medium_url: 'https://example.com/medium.webp',
      size_bytes: 100000,
      format: 'webp',
      order: 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'user-id',
    };
    const duration = Date.now() - start;
    logTest('Types', 'ProductImage type compiles', 'PASS', duration);
  } catch (error) {
    logTest('Types', 'ProductImage type compiles', 'FAIL', undefined, String(error));
  }

  // Test 4.2: Product type with images
  try {
    const start = Date.now();
    const Product = await import('../src/core/types/product');
    const duration = Date.now() - start;
    logTest('Types', 'Product type exports', 'PASS', duration);
  } catch (error) {
    logTest('Types', 'Product type exports', 'FAIL', undefined, String(error));
  }

  // Test 4.3: Zod schemas validate correctly
  try {
    const start = Date.now();
    const schemas = await import('../src/core/admin/schemas/product-image.schema');
    const validImage = {
      id: 'test-id',
      url: 'https://example.com/image.webp',
      thumbnail_url: 'https://example.com/thumb.webp',
      medium_url: 'https://example.com/medium.webp',
      size_bytes: 100000,
      format: 'webp',
      order: 0,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'user-id',
    };
    const result = schemas.ProductImageSchema.safeParse(validImage);
    const duration = Date.now() - start;
    if (result.success) {
      logTest('Types', 'Zod ProductImageSchema validates', 'PASS', duration);
    } else {
      logTest('Types', 'Zod ProductImageSchema validates', 'FAIL', duration, JSON.stringify(result.error));
    }
  } catch (error) {
    logTest('Types', 'Zod ProductImageSchema validates', 'FAIL', undefined, String(error));
  }
}

// ============================================================================
// 5. PERFORMANCE TESTS
// ============================================================================

async function testPerformance() {
  console.log('\n⚡ PERFORMANCE TESTS\n');

  // Test 5.1: Image optimization speed (target: <3s)
  try {
    const inputBuffer = await createTestImageBuffer(2000, 2000);
    const start = Date.now();
    await generateImageVersions(inputBuffer);
    const duration = Date.now() - start;
    if (duration < 3000) {
      logTest('Performance', 'Image optimization completes in <3s', 'PASS', duration);
    } else {
      logTest('Performance', 'Image optimization completes in <3s', 'FAIL', duration, `Took ${duration}ms (target: <3000ms)`);
    }
  } catch (error) {
    logTest('Performance', 'Image optimization completes in <3s', 'FAIL', undefined, String(error));
  }

  // Test 5.2: Batch image processing (5 images)
  try {
    const start = Date.now();
    const promises = [];
    for (let i = 0; i < 5; i++) {
      const buffer = await createTestImageBuffer(1000, 1000);
      promises.push(generateImageVersions(buffer));
    }
    await Promise.all(promises);
    const duration = Date.now() - start;
    logTest('Performance', 'Batch process 5 images', 'PASS', duration, undefined, 
      `${(duration / 5).toFixed(0)}ms per image`);
  } catch (error) {
    logTest('Performance', 'Batch process 5 images', 'FAIL', undefined, String(error));
  }

  // Test 5.3: Database query performance
  try {
    const start = Date.now();
    await prisma.product.findMany({
      take: 100,
      select: { id: true, name: true, images: true },
    });
    const duration = Date.now() - start;
    if (duration < 1000) {
      logTest('Performance', 'Query 100 products with images <1s', 'PASS', duration);
    } else {
      logTest('Performance', 'Query 100 products with images <1s', 'FAIL', duration, `Took ${duration}ms (target: <1000ms)`);
    }
  } catch (error) {
    logTest('Performance', 'Query 100 products with images <1s', 'FAIL', undefined, String(error));
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 PRODUCTOS P1 - TASK 4 STRESS TESTS\n');
  console.log('Testing: Image Storage Service');
  console.log('Components: Frontend, Backend, Database, Types, Performance\n');
  console.log('='.repeat(80));

  try {
    await testFrontend();
    await testBackend();
    await testDatabase();
    await testTypes();
    await testPerformance();
  } catch (error) {
    console.error('\n❌ Fatal error during tests:', error);
  } finally {
    await prisma.$disconnect();
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');

  const categories = ['Frontend', 'Backend', 'Database', 'Types', 'Performance'];
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const failed = categoryResults.filter(r => r.status === 'FAIL').length;
    const skipped = categoryResults.filter(r => r.status === 'SKIP').length;
    const total = categoryResults.length;
    const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    
    console.log(`${category.padEnd(15)} ${passed}/${total} passing (${percentage}%) ${failed > 0 ? `❌ ${failed} failed` : ''} ${skipped > 0 ? `⏭️ ${skipped} skipped` : ''}`);
  });

  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalFailed = results.filter(r => r.status === 'FAIL').length;
  const totalSkipped = results.filter(r => r.status === 'SKIP').length;
  const totalTests = results.length;
  const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(1);

  console.log('\n' + '-'.repeat(80));
  console.log(`TOTAL           ${totalPassed}/${totalTests} passing (${totalPercentage}%)`);
  if (totalFailed > 0) console.log(`                ❌ ${totalFailed} failed`);
  if (totalSkipped > 0) console.log(`                ⏭️ ${totalSkipped} skipped`);

  // Performance stats
  const durations = results.filter(r => r.duration).map(r => r.duration!);
  if (durations.length > 0) {
    const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0);
    const maxDuration = Math.max(...durations);
    console.log(`\n⚡ Performance: Avg ${avgDuration}ms, Max ${maxDuration}ms`);
  }

  console.log('\n' + '='.repeat(80));

  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
