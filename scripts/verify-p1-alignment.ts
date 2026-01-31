/**
 * Verification Script: Products P1 System Alignment
 * 
 * Verifica que todos los componentes del sistema estén alineados:
 * 1. APIs (endpoints)
 * 2. Backend (services, types, schemas)
 * 3. Frontend (components, forms)
 * 4. Prisma (schema, migrations)
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function logTest(category: string, name: string, passed: boolean, error?: string, details?: string) {
  results.push({ category, name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${category}] ${name}`);
  if (error) console.log(`   Error: ${error}`);
  if (details) console.log(`   Details: ${details}`);
}

// ============================================================================
// 1. PRISMA SCHEMA VERIFICATION
// ============================================================================

async function verifyPrismaSchema() {
  console.log('\n📊 1. PRISMA SCHEMA VERIFICATION\n');

  try {
    // Test 1: Verify products table has images field
    const schemaPath = join(process.cwd(), 'prisma/schema.prisma');
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    
    const hasImagesField = schemaContent.includes('images      Json     @default("[]")');
    logTest(
      'Prisma Schema',
      'products.images field exists',
      hasImagesField,
      hasImagesField ? undefined : 'images field not found in schema'
    );

    // Test 2: Verify migration exists
    const migrationPath = join(process.cwd(), 'prisma/migrations/20260127_add_product_images/migration.sql');
    const migrationExists = existsSync(migrationPath);
    logTest(
      'Prisma Schema',
      'Migration 20260127_add_product_images exists',
      migrationExists,
      migrationExists ? undefined : 'Migration file not found'
    );

    if (migrationExists) {
      const migrationContent = readFileSync(migrationPath, 'utf-8');
      const hasAddColumn = migrationContent.includes('ADD COLUMN "images"');
      const hasIndex = migrationContent.includes('CREATE INDEX') && migrationContent.includes('images');
      
      logTest(
        'Prisma Schema',
        'Migration adds images column',
        hasAddColumn,
        hasAddColumn ? undefined : 'ADD COLUMN not found in migration'
      );
      
      logTest(
        'Prisma Schema',
        'Migration creates GIN index',
        hasIndex,
        hasIndex ? undefined : 'GIN index not found in migration'
      );
    }

    // Test 3: Verify database has images column
    const product = await prisma.products.findFirst({
      select: { id: true, images: true },
    });
    
    logTest(
      'Prisma Schema',
      'Database has images column',
      product !== null && 'images' in product,
      product ? undefined : 'No products found or images field missing'
    );

  } catch (error) {
    logTest(
      'Prisma Schema',
      'Schema verification',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// 2. BACKEND TYPES & SCHEMAS VERIFICATION
// ============================================================================

async function verifyBackendTypes() {
  console.log('\n🔧 2. BACKEND TYPES & SCHEMAS VERIFICATION\n');

  try {
    // Test 1: Verify ProductImage type exists
    const productImagesPath = join(process.cwd(), 'src/core/types/product-images.ts');
    const productImagesExists = existsSync(productImagesPath);
    logTest(
      'Backend Types',
      'product-images.ts exists',
      productImagesExists
    );

    if (productImagesExists) {
      const content = readFileSync(productImagesPath, 'utf-8');
      const hasProductImage = content.includes('export interface ProductImage');
      const hasConstants = content.includes('export const IMAGE_CONSTANTS');
      const hasHelpers = content.includes('getPrimaryImage');
      
      logTest('Backend Types', 'ProductImage interface defined', hasProductImage);
      logTest('Backend Types', 'IMAGE_CONSTANTS exported', hasConstants);
      logTest('Backend Types', 'Helper functions defined', hasHelpers);
    }

    // Test 2: Verify Zod schemas exist
    const schemaPath = join(process.cwd(), 'src/core/admin/schemas/product-image.schema.ts');
    const schemaExists = existsSync(schemaPath);
    logTest(
      'Backend Types',
      'product-image.schema.ts exists',
      schemaExists
    );

    if (schemaExists) {
      const content = readFileSync(schemaPath, 'utf-8');
      const hasProductImageSchema = content.includes('ProductImageSchema');
      const hasUploadSchema = content.includes('ImageUploadRequestSchema');
      const hasDeleteSchema = content.includes('ImageDeleteRequestSchema');
      const hasReorderSchema = content.includes('ImageReorderRequestSchema');
      
      logTest('Backend Types', 'ProductImageSchema defined', hasProductImageSchema);
      logTest('Backend Types', 'ImageUploadRequestSchema defined', hasUploadSchema);
      logTest('Backend Types', 'ImageDeleteRequestSchema defined', hasDeleteSchema);
      logTest('Backend Types', 'ImageReorderRequestSchema defined', hasReorderSchema);
    }

    // Test 3: Verify Image Service exists
    const servicePath = join(process.cwd(), 'src/core/images/image.service.ts');
    const serviceExists = existsSync(servicePath);
    logTest(
      'Backend Types',
      'image.service.ts exists',
      serviceExists
    );

    if (serviceExists) {
      const content = readFileSync(servicePath, 'utf-8');
      const hasUploadImage = content.includes('export async function uploadImage');
      const hasDeleteImage = content.includes('export async function deleteImage');
      const hasOptimizeImage = content.includes('export async function optimizeImage');
      
      logTest('Backend Types', 'uploadImage function exists', hasUploadImage);
      logTest('Backend Types', 'deleteImage function exists', hasDeleteImage);
      logTest('Backend Types', 'optimizeImage function exists', hasOptimizeImage);
    }

  } catch (error) {
    logTest(
      'Backend Types',
      'Types verification',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// 3. API ENDPOINTS VERIFICATION
// ============================================================================

async function verifyAPIEndpoints() {
  console.log('\n🌐 3. API ENDPOINTS VERIFICATION\n');

  try {
    // Test 1: Verify main products API includes images in GET
    const productsAPIPath = join(process.cwd(), 'src/app/api/admin/products/route.ts');
    const productsAPIExists = existsSync(productsAPIPath);
    logTest(
      'API Endpoints',
      'products/route.ts exists',
      productsAPIExists
    );

    if (productsAPIExists) {
      const content = readFileSync(productsAPIPath, 'utf-8');
      const hasImagesInSelect = content.includes('images: true');
      
      logTest(
        'API Endpoints',
        'GET /api/admin/products includes images',
        hasImagesInSelect,
        hasImagesInSelect ? undefined : 'images not in select statement'
      );
    }

    // Test 2: Verify product detail API supports images
    const productDetailPath = join(process.cwd(), 'src/app/api/admin/products/[id]/route.ts');
    const productDetailExists = existsSync(productDetailPath);
    logTest(
      'API Endpoints',
      'products/[id]/route.ts exists',
      productDetailExists
    );

    if (productDetailExists) {
      const content = readFileSync(productDetailPath, 'utf-8');
      const hasImageReorder = content.includes('ImageReorderRequestSchema');
      const hasImagesUpdate = content.includes('images !== undefined');
      
      logTest(
        'API Endpoints',
        'PUT /api/admin/products/[id] supports image reordering',
        hasImageReorder && hasImagesUpdate,
        hasImageReorder ? (hasImagesUpdate ? undefined : 'images update logic missing') : 'ImageReorderRequestSchema not imported'
      );
    }

    // Test 3: Verify image upload API exists
    const imageUploadPath = join(process.cwd(), 'src/app/api/admin/products/images/route.ts');
    const imageUploadExists = existsSync(imageUploadPath);
    logTest(
      'API Endpoints',
      'products/images/route.ts exists',
      imageUploadExists
    );

    if (imageUploadExists) {
      const content = readFileSync(imageUploadPath, 'utf-8');
      const hasPostHandler = content.includes('export async function POST');
      const hasUploadImage = content.includes('uploadImage(');
      
      logTest('API Endpoints', 'POST /api/admin/products/images handler exists', hasPostHandler);
      logTest('API Endpoints', 'POST handler calls uploadImage service', hasUploadImage);
    }

    // Test 4: Verify image delete API exists
    const imageDeletePath = join(process.cwd(), 'src/app/api/admin/products/images/[id]/route.ts');
    const imageDeleteExists = existsSync(imageDeletePath);
    logTest(
      'API Endpoints',
      'products/images/[id]/route.ts exists',
      imageDeleteExists
    );

    if (imageDeleteExists) {
      const content = readFileSync(imageDeletePath, 'utf-8');
      const hasDeleteHandler = content.includes('export async function DELETE');
      const hasDeleteImage = content.includes('deleteImage(');
      
      logTest('API Endpoints', 'DELETE /api/admin/products/images/[id] handler exists', hasDeleteHandler);
      logTest('API Endpoints', 'DELETE handler calls deleteImage service', hasDeleteImage);
    }

  } catch (error) {
    logTest(
      'API Endpoints',
      'API verification',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// 4. FRONTEND COMPONENTS VERIFICATION
// ============================================================================

async function verifyFrontendComponents() {
  console.log('\n🎨 4. FRONTEND COMPONENTS VERIFICATION\n');

  try {
    // Test 1: Verify ImageUpload component exists
    const imageUploadPath = join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
    const imageUploadExists = existsSync(imageUploadPath);
    logTest(
      'Frontend Components',
      'ImageUpload.tsx exists',
      imageUploadExists
    );

    if (imageUploadExists) {
      const content = readFileSync(imageUploadPath, 'utf-8');
      const hasDragDrop = content.includes('onDragEnter') && content.includes('onDrop');
      const hasValidation = content.includes('validateFile');
      const hasReorder = content.includes('handleMoveUp') && content.includes('handleMoveDown');
      
      logTest('Frontend Components', 'ImageUpload has drag & drop', hasDragDrop);
      logTest('Frontend Components', 'ImageUpload has file validation', hasValidation);
      logTest('Frontend Components', 'ImageUpload has reorder functionality', hasReorder);
    }

    // Test 2: Verify create form integration
    const createFormPath = join(process.cwd(), 'src/app/admin/productos/nuevo/page.tsx');
    const createFormExists = existsSync(createFormPath);
    logTest(
      'Frontend Components',
      'nuevo/page.tsx exists',
      createFormExists
    );

    if (createFormExists) {
      const content = readFileSync(createFormPath, 'utf-8');
      const hasImport = content.includes('import { ImageUpload }');
      const hasComponent = content.includes('<ImageUpload');
      const hasImageState = content.includes('useState<ProductImage[]>');
      const hasUploadLogic = content.includes('/api/admin/products/images');
      
      logTest('Frontend Components', 'Create form imports ImageUpload', hasImport);
      logTest('Frontend Components', 'Create form uses ImageUpload component', hasComponent);
      logTest('Frontend Components', 'Create form has images state', hasImageState);
      logTest('Frontend Components', 'Create form has upload logic', hasUploadLogic);
    }

    // Test 3: Verify edit form integration
    const editFormPath = join(process.cwd(), 'src/app/admin/productos/[id]/page.tsx');
    const editFormExists = existsSync(editFormPath);
    logTest(
      'Frontend Components',
      '[id]/page.tsx exists',
      editFormExists
    );

    if (editFormExists) {
      const content = readFileSync(editFormPath, 'utf-8');
      const hasImport = content.includes('import { ImageUpload }');
      const hasComponent = content.includes('<ImageUpload');
      const hasExistingImages = content.includes('existingImages={images}');
      const hasDeleteTracking = content.includes('imagesToDelete');
      const hasDeleteLogic = content.includes('DELETE');
      
      logTest('Frontend Components', 'Edit form imports ImageUpload', hasImport);
      logTest('Frontend Components', 'Edit form uses ImageUpload component', hasComponent);
      logTest('Frontend Components', 'Edit form passes existingImages prop', hasExistingImages);
      logTest('Frontend Components', 'Edit form tracks deleted images', hasDeleteTracking);
      logTest('Frontend Components', 'Edit form has delete logic', hasDeleteLogic);
    }

    // Test 4: Verify product list shows images
    const listPath = join(process.cwd(), 'src/app/admin/productos/page.tsx');
    const listExists = existsSync(listPath);
    logTest(
      'Frontend Components',
      'page.tsx (list) exists',
      listExists
    );

    if (listExists) {
      const content = readFileSync(listPath, 'utf-8');
      const hasImageColumn = content.includes("key: 'image'");
      const hasThumbnailUrl = content.includes('thumbnail_url');
      const hasPlaceholder = content.includes('Package');
      
      logTest('Frontend Components', 'Product list has image column', hasImageColumn);
      logTest('Frontend Components', 'Product list uses thumbnail_url', hasThumbnailUrl);
      logTest('Frontend Components', 'Product list has placeholder icon', hasPlaceholder);
    }

  } catch (error) {
    logTest(
      'Frontend Components',
      'Frontend verification',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// 5. INTEGRATION TESTS
// ============================================================================

async function verifyIntegration() {
  console.log('\n🔗 5. INTEGRATION VERIFICATION\n');

  try {
    // Test 1: Verify product can be fetched with images
    const product = await prisma.products.findFirst({
      where: { is_active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        images: true,
      },
    });

    logTest(
      'Integration',
      'Can fetch product with images field',
      product !== null && 'images' in product,
      product ? undefined : 'No products found'
    );

    if (product) {
      const images = product.images as any;
      const isArray = Array.isArray(images);
      logTest(
        'Integration',
        'Product images is an array',
        isArray,
        isArray ? undefined : `images is ${typeof images}`
      );

      if (isArray && images.length > 0) {
        const firstImage = images[0];
        const hasRequiredFields = 
          'id' in firstImage &&
          'thumbnail_url' in firstImage &&
          'medium_url' in firstImage &&
          'original_url' in firstImage;
        
        logTest(
          'Integration',
          'Image objects have required fields',
          hasRequiredFields,
          hasRequiredFields ? undefined : 'Missing required fields in image object',
          hasRequiredFields ? `Sample: ${firstImage.thumbnail_url}` : undefined
        );
      }
    }

    // Test 2: Verify Product type includes images
    const productTypePath = join(process.cwd(), 'src/app/admin/productos/page.tsx');
    if (existsSync(productTypePath)) {
      const content = readFileSync(productTypePath, 'utf-8');
      const hasImagesInInterface = content.includes('images: ProductImage[]');
      
      logTest(
        'Integration',
        'Product interface includes images field',
        hasImagesInInterface,
        hasImagesInInterface ? undefined : 'images field not in Product interface'
      );
    }

  } catch (error) {
    logTest(
      'Integration',
      'Integration verification',
      false,
      error instanceof Error ? error.message : String(error)
    );
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runVerification() {
  console.log('🔍 Products P1 System Alignment Verification\n');
  console.log('='.repeat(70));

  const startTime = Date.now();

  await verifyPrismaSchema();
  await verifyBackendTypes();
  await verifyAPIEndpoints();
  await verifyFrontendComponents();
  await verifyIntegration();

  const totalTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 VERIFICATION SUMMARY\n');

  const byCategory = results.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = { passed: 0, failed: 0 };
    if (r.passed) acc[r.category].passed++;
    else acc[r.category].failed++;
    return acc;
  }, {} as Record<string, { passed: number; failed: number }>);

  Object.entries(byCategory).forEach(([category, stats]) => {
    const total = stats.passed + stats.failed;
    const percentage = ((stats.passed / total) * 100).toFixed(1);
    const icon = stats.failed === 0 ? '✅' : '⚠️';
    console.log(`${icon} ${category}: ${stats.passed}/${total} (${percentage}%)`);
  });

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);

  console.log('\n' + '-'.repeat(70));
  console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed (${overallPercentage}%)`);
  console.log(`⏱️  Execution time: ${totalTime}ms`);

  if (totalFailed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   [${r.category}] ${r.name}`);
      if (r.error) console.log(`      ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  if (totalFailed === 0) {
    console.log('\n✅ ALL SYSTEMS ALIGNED! Ready for Phase 2.\n');
  } else {
    console.log('\n⚠️  Some components need alignment. Review failed tests above.\n');
  }

  await prisma.$disconnect();
  process.exit(totalFailed > 0 ? 1 : 0);
}

runVerification().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
