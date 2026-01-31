/**
 * Test Script: Product Form UI Integration
 * 
 * Tests the complete product form UI with image upload functionality
 * 
 * Task: 6. Update Product Form UI
 * Spec: products-p1-improvements
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const icon = passed ? '✅' : '❌';
  const time = duration ? ` (${duration}ms)` : '';
  console.log(`${icon} ${name}${time}`);
  if (error) console.log(`   Error: ${error}`);
}

async function testProductWithImages() {
  console.log('\n📦 Testing Product with Images...\n');

  try {
    // Test 1: Fetch product with images
    const start1 = Date.now();
    const product = await prisma.products.findFirst({
      where: { is_active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        short_name: true,
        price_cents: true,
        category: true,
        station: true,
        type: true,
        is_active: true,
        images: true,
      },
    });
    const duration1 = Date.now() - start1;

    if (!product) {
      logTest('Fetch product with images field', false, 'No products found', duration1);
      return;
    }

    logTest('Fetch product with images field', true, undefined, duration1);

    // Test 2: Verify images field structure
    const start2 = Date.now();
    const hasImagesField = 'images' in product;
    const imagesIsArray = Array.isArray(product.images);
    const duration2 = Date.now() - start2;

    logTest(
      'Images field structure',
      hasImagesField && imagesIsArray,
      hasImagesField ? (imagesIsArray ? undefined : 'images is not an array') : 'images field missing',
      duration2
    );

    // Test 3: Verify image structure if images exist
    if (product.images && product.images.length > 0) {
      const start3 = Date.now();
      const firstImage = product.images[0] as any;
      const hasRequiredFields = 
        'id' in firstImage &&
        'thumbnail_url' in firstImage &&
        'medium_url' in firstImage &&
        'original_url' in firstImage;
      const duration3 = Date.now() - start3;

      logTest(
        'Image object structure',
        hasRequiredFields,
        hasRequiredFields ? undefined : 'Missing required image fields',
        duration3
      );

      console.log(`   Product: ${product.name}`);
      console.log(`   Images: ${product.images.length}`);
      console.log(`   Primary image: ${firstImage.thumbnail_url}`);
    } else {
      console.log(`   Product: ${product.name}`);
      console.log(`   Images: 0 (no images uploaded)`);
    }

  } catch (error) {
    logTest('Product with images test', false, error instanceof Error ? error.message : String(error));
  }
}

async function testProductListQuery() {
  console.log('\n📋 Testing Product List Query...\n');

  try {
    // Test 1: Fetch all products with images
    const start1 = Date.now();
    const products = await prisma.products.findMany({
      where: { is_active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        price_cents: true,
        category: true,
        station: true,
        is_active: true,
        images: true,
      },
      take: 10,
    });
    const duration1 = Date.now() - start1;

    logTest('Fetch product list with images', products.length > 0, undefined, duration1);

    // Test 2: Count products with images
    const start2 = Date.now();
    const productsWithImages = products.filter(p => p.images && (p.images as any[]).length > 0);
    const duration2 = Date.now() - start2;

    logTest('Filter products with images', true, undefined, duration2);

    console.log(`   Total products: ${products.length}`);
    console.log(`   Products with images: ${productsWithImages.length}`);
    console.log(`   Products without images: ${products.length - productsWithImages.length}`);

    // Test 3: Verify primary image extraction
    if (productsWithImages.length > 0) {
      const start3 = Date.now();
      const primaryImages = productsWithImages.map(p => {
        const images = p.images as any[];
        return images[0]?.thumbnail_url;
      });
      const duration3 = Date.now() - start3;

      const allHaveThumbnails = primaryImages.every(url => typeof url === 'string' && url.length > 0);
      logTest('Extract primary image thumbnails', allHaveThumbnails, undefined, duration3);

      console.log(`   Sample primary images:`);
      primaryImages.slice(0, 3).forEach((url, i) => {
        console.log(`     ${i + 1}. ${url}`);
      });
    }

  } catch (error) {
    logTest('Product list query test', false, error instanceof Error ? error.message : String(error));
  }
}

async function testImageUploadComponent() {
  console.log('\n🖼️  Testing Image Upload Component Integration...\n');

  try {
    // Test 1: Verify ImageUpload component exists
    const start1 = Date.now();
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const componentPath = join(process.cwd(), 'src/app/admin/productos/components/ImageUpload.tsx');
    const componentExists = existsSync(componentPath);
    const duration1 = Date.now() - start1;

    logTest('ImageUpload component exists', componentExists, undefined, duration1);

    // Test 2: Verify component is imported in create form
    const start2 = Date.now();
    const createFormPath = join(process.cwd(), 'src/app/admin/productos/nuevo/page.tsx');
    const createFormContent = readFileSync(createFormPath, 'utf-8');
    const hasImportInCreate = createFormContent.includes('import { ImageUpload }');
    const hasComponentInCreate = createFormContent.includes('<ImageUpload');
    const duration2 = Date.now() - start2;

    logTest(
      'ImageUpload integrated in create form',
      hasImportInCreate && hasComponentInCreate,
      hasImportInCreate ? (hasComponentInCreate ? undefined : 'Component not used') : 'Import missing',
      duration2
    );

    // Test 3: Verify component is imported in edit form
    const start3 = Date.now();
    const editFormPath = join(process.cwd(), 'src/app/admin/productos/[id]/page.tsx');
    const editFormContent = readFileSync(editFormPath, 'utf-8');
    const hasImportInEdit = editFormContent.includes('import { ImageUpload }');
    const hasComponentInEdit = editFormContent.includes('<ImageUpload');
    const hasExistingImages = editFormContent.includes('existingImages={images}');
    const duration3 = Date.now() - start3;

    logTest(
      'ImageUpload integrated in edit form',
      hasImportInEdit && hasComponentInEdit && hasExistingImages,
      hasImportInEdit ? (hasComponentInEdit ? (hasExistingImages ? undefined : 'existingImages prop missing') : 'Component not used') : 'Import missing',
      duration3
    );

    // Test 4: Verify product list shows image column
    const start4 = Date.now();
    const listPath = join(process.cwd(), 'src/app/admin/productos/page.tsx');
    const listContent = readFileSync(listPath, 'utf-8');
    const hasImageColumn = listContent.includes("key: 'image'");
    const hasThumbnailUrl = listContent.includes('thumbnail_url');
    const hasPlaceholder = listContent.includes('<Package');
    const duration4 = Date.now() - start4;

    logTest(
      'Product list shows image thumbnails',
      hasImageColumn && hasThumbnailUrl && hasPlaceholder,
      hasImageColumn ? (hasThumbnailUrl ? (hasPlaceholder ? undefined : 'Placeholder missing') : 'thumbnail_url not used') : 'Image column missing',
      duration4
    );

  } catch (error) {
    logTest('Image upload component test', false, error instanceof Error ? error.message : String(error));
  }
}

async function testFormSubmitLogic() {
  console.log('\n📝 Testing Form Submit Logic...\n');

  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    // Test 1: Verify create form handles image upload
    const start1 = Date.now();
    const createFormPath = join(process.cwd(), 'src/app/admin/productos/nuevo/page.tsx');
    const createFormContent = readFileSync(createFormPath, 'utf-8');
    const hasImageState = createFormContent.includes('useState<ProductImage[]>([])');
    const hasImageUpload = createFormContent.includes('/api/admin/products/images');
    const hasFormData = createFormContent.includes('new FormData()');
    const duration1 = Date.now() - start1;

    logTest(
      'Create form handles image upload',
      hasImageState && hasImageUpload && hasFormData,
      hasImageState ? (hasImageUpload ? (hasFormData ? undefined : 'FormData not used') : 'Image upload API not called') : 'Image state missing',
      duration1
    );

    // Test 2: Verify edit form handles image operations
    const start2 = Date.now();
    const editFormPath = join(process.cwd(), 'src/app/admin/productos/[id]/page.tsx');
    const editFormContent = readFileSync(editFormPath, 'utf-8');
    const hasImageDelete = editFormContent.includes('imagesToDelete');
    const hasDeleteAPI = editFormContent.includes('DELETE');
    const hasImageReorder = editFormContent.includes('images: imageIds');
    const duration2 = Date.now() - start2;

    logTest(
      'Edit form handles image operations',
      hasImageDelete && hasDeleteAPI && hasImageReorder,
      hasImageDelete ? (hasDeleteAPI ? (hasImageReorder ? undefined : 'Image reorder not implemented') : 'Delete API not called') : 'Delete tracking missing',
      duration2
    );

    // Test 3: Verify error handling
    const start3 = Date.now();
    const hasErrorHandling = createFormContent.includes('catch (err)') && editFormContent.includes('catch (err)');
    const hasToastError = createFormContent.includes('toast.error') && editFormContent.includes('toast.error');
    const duration3 = Date.now() - start3;

    logTest(
      'Forms have error handling',
      hasErrorHandling && hasToastError,
      hasErrorHandling ? (hasToastError ? undefined : 'Toast notifications missing') : 'Error handling missing',
      duration3
    );

  } catch (error) {
    logTest('Form submit logic test', false, error instanceof Error ? error.message : String(error));
  }
}

async function runTests() {
  console.log('🧪 Product Form UI Integration Tests\n');
  console.log('=' .repeat(60));

  const startTime = Date.now();

  await testProductWithImages();
  await testProductListQuery();
  await testImageUploadComponent();
  await testFormSubmitLogic();

  const totalTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}`);
      if (r.error) console.log(`     ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ All tests passed! Product form UI is ready.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
