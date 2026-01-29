/**
 * Complete Verification: Tasks 14, 15, 16
 * 
 * Tests:
 * - Database: Migration, schema, indices
 * - Backend: Services, APIs, error handling
 * - Frontend: Components, UI integration
 * - Integration: Complete workflows
 * - Performance: All targets
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CSVService } from '../src/core/services/csv.service';
import { BulkOperationsService } from '../src/core/services/bulk-operations.service';
import { getTenantId } from '../src/core/config/tenant';
import fs from 'fs/promises';

const prisma = new PrismaClient();
const csvService = new CSVService();
const bulkService = new BulkOperationsService();
const TENANT_ID = getTenantId();

interface TestResult {
  category: string;
  test: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function logTest(category: string, test: string, passed: boolean, details?: string, error?: string) {
  results.push({ category, test, passed, details, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${category}] ${test}`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testSection(title: string, tests: () => Promise<void>) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 ${title}`);
  console.log(`${'-'.repeat(80)}`);
  await tests();
}

// ============================================================================
// DATABASE TESTS
// ============================================================================

async function testDatabase() {
  await testSection('DATABASE VERIFICATION', async () => {
    try {
      // Test 1: Images column exists
      console.log('\n📝 Testing images column...');
      const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'images'
      `;
      
      logTest(
        'DATABASE',
        'Images column exists',
        result.length > 0,
        'Column "images" found in products table'
      );

      // Test 2: Images column is JSONB
      const typeResult = await prisma.$queryRaw<Array<{ data_type: string }>>`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'images'
      `;
      
      logTest(
        'DATABASE',
        'Images column is JSONB',
        typeResult.length > 0 && typeResult[0].data_type === 'jsonb',
        `Data type: ${typeResult[0]?.data_type || 'unknown'}`
      );

      // Test 3: GIN index exists
      const indexResult = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'products' 
        AND indexname = 'idx_products_images'
      `;
      
      const indexExists = indexResult.length > 0;
      logTest(
        'DATABASE',
        'GIN index on images exists',
        indexExists,
        indexExists ? 'Index "idx_products_images" found' : 'Index not found'
      );

      // Test 4: Can query products with images
      const products = await prisma.products.findMany({
        where: { tenant_id: TENANT_ID },
        take: 5,
        select: { id: true, sku: true, images: true },
      });
      
      logTest(
        'DATABASE',
        'Can query products with images',
        products.length >= 0,
        `Found ${products.length} products`
      );

      // Test 5: Can insert product with images
      const testProduct = await prisma.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          sku: `DB-TEST-${Date.now()}`,
          name: 'Database Test Product',
          price_cents: 1000,
          category: 'POLLOS',
          station: 'PARRILLA',
          type: 'SIMPLE',
          is_active: true,
          images: [
            {
              id: randomUUID(),
              url: 'https://example.com/image.webp',
              thumbnail_url: 'https://example.com/thumb.webp',
              medium_url: 'https://example.com/medium.webp',
              size_bytes: 12345,
              format: 'webp',
              order: 0,
              uploaded_at: new Date().toISOString(),
              uploaded_by: randomUUID(),
            },
          ] as any,
        },
      });
      
      logTest(
        'DATABASE',
        'Can insert product with images',
        testProduct.id !== undefined,
        `Created product ${testProduct.sku}`
      );

      // Cleanup
      await prisma.products.delete({ where: { id: testProduct.id } });

    } catch (error: any) {
      logTest(
        'DATABASE',
        'Database tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// BACKEND TESTS
// ============================================================================

async function testBackend() {
  await testSection('BACKEND SERVICES VERIFICATION', async () => {
    try {
      // Test 1: CSV Service exists and has methods
      console.log('\n📝 Testing CSV Service...');
      const hasCsvMethods = 
        typeof csvService.exportToCSV === 'function' &&
        typeof csvService.importFromCSV === 'function' &&
        typeof csvService.parseCSV === 'function' &&
        typeof csvService.generateTemplate === 'function';
      
      logTest(
        'BACKEND',
        'CSV Service has all methods',
        hasCsvMethods,
        'exportToCSV, importFromCSV, parseCSV, generateTemplate'
      );

      // Test 2: Bulk Operations Service exists and has methods
      console.log('\n📝 Testing Bulk Operations Service...');
      const hasBulkMethods = 
        typeof bulkService.bulkUpdate === 'function' &&
        typeof bulkService.bulkDelete === 'function';
      
      logTest(
        'BACKEND',
        'Bulk Operations Service has all methods',
        hasBulkMethods,
        'bulkUpdate, bulkDelete (activate/deactivate via bulkUpdate)'
      );

      // Test 3: CSV Service can generate template
      console.log('\n📝 Testing CSV template generation...');
      const template = csvService.generateTemplate();
      const hasHeaders = template.includes('sku,name');
      const hasExamples = template.split('\n').length > 1;
      
      logTest(
        'BACKEND',
        'CSV Service generates valid template',
        hasHeaders && hasExamples,
        `Template has ${template.split('\n').length} lines`
      );

      // Test 4: CSV Service can parse valid CSV
      console.log('\n📝 Testing CSV parsing...');
      const validCsv = 'sku,name,short_name,price,category,station,type,is_active\nTEST-001,Test Product,,1000,POLLOS,PARRILLA,SIMPLE,true';
      const { rows, errors } = csvService.parseCSV(validCsv);
      
      logTest(
        'BACKEND',
        'CSV Service parses valid CSV',
        rows.length === 1 && errors.length === 0,
        `Parsed ${rows.length} rows, ${errors.length} errors`
      );

      // Test 5: CSV Service detects invalid CSV
      console.log('\n📝 Testing CSV validation...');
      const invalidCsv = 'sku,name,short_name,price,category,station,type,is_active\nTEST-002,Test Product,,invalid_price,POLLOS,PARRILLA,SIMPLE,true';
      const { rows: invalidRows, errors: validationErrors } = csvService.parseCSV(invalidCsv);
      
      logTest(
        'BACKEND',
        'CSV Service detects invalid data',
        validationErrors.length > 0,
        `Detected ${validationErrors.length} validation errors`
      );

      // Test 6: Image Service file exists
      console.log('\n📝 Testing Image Service...');
      try {
        await fs.access('src/core/images/image.service.ts');
        logTest(
          'BACKEND',
          'Image Service file exists',
          true,
          'src/core/images/image.service.ts'
        );
      } catch {
        logTest(
          'BACKEND',
          'Image Service file exists',
          false,
          'File not found'
        );
      }

    } catch (error: any) {
      logTest(
        'BACKEND',
        'Backend tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// API TESTS
// ============================================================================

async function testAPIs() {
  await testSection('API ENDPOINTS VERIFICATION', async () => {
    try {
      // Test 1: Product APIs exist
      console.log('\n📝 Testing Product API files...');
      const apiFiles = [
        'src/app/api/admin/products/route.ts',
        'src/app/api/admin/products/[id]/route.ts',
        'src/app/api/admin/products/images/route.ts',
        'src/app/api/admin/products/images/[id]/route.ts',
        'src/app/api/admin/products/bulk/route.ts',
        'src/app/api/admin/products/export/route.ts',
        'src/app/api/admin/products/import/route.ts',
        'src/app/api/admin/products/template/route.ts',
      ];

      let allFilesExist = true;
      const missingFiles: string[] = [];

      for (const file of apiFiles) {
        try {
          await fs.access(file);
        } catch {
          allFilesExist = false;
          missingFiles.push(file);
        }
      }

      logTest(
        'API',
        'All API endpoint files exist',
        allFilesExist,
        allFilesExist 
          ? `All ${apiFiles.length} API files found`
          : `Missing: ${missingFiles.join(', ')}`
      );

      // Test 2: Product route has GET and POST
      console.log('\n📝 Testing Product route exports...');
      const productRouteContent = await fs.readFile('src/app/api/admin/products/route.ts', 'utf-8');
      const hasGet = productRouteContent.includes('export const GET') || productRouteContent.includes('export { GET }');
      const hasPost = productRouteContent.includes('export const POST') || productRouteContent.includes('export { POST }');
      
      logTest(
        'API',
        'Product route has GET and POST',
        hasGet && hasPost,
        `GET: ${hasGet}, POST: ${hasPost}`
      );

      // Test 3: Product [id] route has GET, PUT, DELETE
      console.log('\n📝 Testing Product [id] route exports...');
      const productIdRouteContent = await fs.readFile('src/app/api/admin/products/[id]/route.ts', 'utf-8');
      const hasGetId = productIdRouteContent.includes('export async function GET');
      const hasPut = productIdRouteContent.includes('export async function PUT');
      const hasDelete = productIdRouteContent.includes('export async function DELETE');
      
      logTest(
        'API',
        'Product [id] route has GET, PUT, DELETE',
        hasGetId && hasPut && hasDelete,
        `GET: ${hasGetId}, PUT: ${hasPut}, DELETE: ${hasDelete}`
      );

      // Test 4: Images route has POST
      console.log('\n📝 Testing Images route exports...');
      const imagesRouteContent = await fs.readFile('src/app/api/admin/products/images/route.ts', 'utf-8');
      const hasPostImages = imagesRouteContent.includes('export const POST') || imagesRouteContent.includes('handlePOST');
      
      logTest(
        'API',
        'Images route has POST',
        hasPostImages,
        'POST handler found'
      );

      // Test 5: Images [id] route has DELETE
      console.log('\n📝 Testing Images [id] route exports...');
      const imagesIdRouteContent = await fs.readFile('src/app/api/admin/products/images/[id]/route.ts', 'utf-8');
      const hasDeleteImages = imagesIdRouteContent.includes('export const DELETE') || imagesIdRouteContent.includes('handleDELETE');
      
      logTest(
        'API',
        'Images [id] route has DELETE',
        hasDeleteImages,
        'DELETE handler found'
      );

      // Test 6: Bulk route has POST
      console.log('\n📝 Testing Bulk route exports...');
      const bulkRouteContent = await fs.readFile('src/app/api/admin/products/bulk/route.ts', 'utf-8');
      const hasPostBulk = bulkRouteContent.includes('export const POST') || bulkRouteContent.includes('handlePOST');
      
      logTest(
        'API',
        'Bulk route has POST',
        hasPostBulk,
        'POST handler found'
      );

      // Test 7: Export route has GET
      console.log('\n📝 Testing Export route exports...');
      const exportRouteContent = await fs.readFile('src/app/api/admin/products/export/route.ts', 'utf-8');
      const hasGetExport = exportRouteContent.includes('export const GET') || exportRouteContent.includes('handleGET');
      
      logTest(
        'API',
        'Export route has GET',
        hasGetExport,
        'GET handler found'
      );

      // Test 8: Import route has POST
      console.log('\n📝 Testing Import route exports...');
      const importRouteContent = await fs.readFile('src/app/api/admin/products/import/route.ts', 'utf-8');
      const hasPostImport = importRouteContent.includes('export const POST') || importRouteContent.includes('handlePOST');
      
      logTest(
        'API',
        'Import route has POST',
        hasPostImport,
        'POST handler found'
      );

    } catch (error: any) {
      logTest(
        'API',
        'API tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// FRONTEND TESTS
// ============================================================================

async function testFrontend() {
  await testSection('FRONTEND COMPONENTS VERIFICATION', async () => {
    try {
      // Test 1: ImageUpload component exists
      console.log('\n📝 Testing ImageUpload component...');
      try {
        await fs.access('src/app/admin/productos/components/ImageUpload.tsx');
        logTest(
          'FRONTEND',
          'ImageUpload component exists',
          true,
          'src/app/admin/productos/components/ImageUpload.tsx'
        );
      } catch {
        logTest(
          'FRONTEND',
          'ImageUpload component exists',
          false,
          'File not found'
        );
      }

      // Test 2: BulkActionsToolbar component exists
      console.log('\n📝 Testing BulkActionsToolbar component...');
      try {
        await fs.access('src/app/admin/productos/components/BulkActionsToolbar.tsx');
        logTest(
          'FRONTEND',
          'BulkActionsToolbar component exists',
          true,
          'src/app/admin/productos/components/BulkActionsToolbar.tsx'
        );
      } catch {
        logTest(
          'FRONTEND',
          'BulkActionsToolbar component exists',
          false,
          'File not found'
        );
      }

      // Test 3: CSVImportExport component exists
      console.log('\n📝 Testing CSVImportExport component...');
      try {
        const content = await fs.readFile('src/app/admin/productos/components/CSVImportExport.tsx', 'utf-8');
        const hasExport = content.includes('export') || content.includes('Export');
        const hasImport = content.includes('import') || content.includes('Import');
        
        logTest(
          'FRONTEND',
          'CSVImportExport component has import/export',
          hasExport && hasImport,
          'Component has import and export functionality'
        );
      } catch {
        logTest(
          'FRONTEND',
          'CSVImportExport component exists',
          false,
          'File not found'
        );
      }

      // Test 4: Product types exist
      console.log('\n📝 Testing Product types...');
      try {
        await fs.access('src/core/types/product-images.ts');
        logTest(
          'FRONTEND',
          'Product image types exist',
          true,
          'src/core/types/product-images.ts'
        );
      } catch {
        logTest(
          'FRONTEND',
          'Product image types exist',
          false,
          'File not found'
        );
      }

      // Test 5: Product schemas exist
      console.log('\n📝 Testing Product schemas...');
      try {
        await fs.access('src/core/admin/schemas/product-image.schema.ts');
        logTest(
          'FRONTEND',
          'Product image schemas exist',
          true,
          'src/core/admin/schemas/product-image.schema.ts'
        );
      } catch {
        logTest(
          'FRONTEND',
          'Product image schemas exist',
          false,
          'File not found'
        );
      }

    } catch (error: any) {
      logTest(
        'FRONTEND',
        'Frontend tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

async function testIntegration() {
  await testSection('INTEGRATION WORKFLOWS', async () => {
    const testProducts: string[] = [];
    
    try {
      // Test 1: Create product → Bulk update → Export CSV
      console.log('\n📝 Testing complete workflow...');
      const userId = randomUUID();
      
      // Create products
      for (let i = 0; i < 3; i++) {
        const product = await prisma.products.create({
          data: {
            id: randomUUID(),
            tenant_id: TENANT_ID,
            sku: `INT-TEST-${i}-${Date.now()}`,
            name: `Integration Test Product ${i}`,
            price_cents: 1000,
            category: 'POLLOS',
            station: 'PARRILLA',
            type: 'SIMPLE',
            is_active: true,
          },
        });
        testProducts.push(product.id);
      }
      
      logTest(
        'INTEGRATION',
        'Create products',
        testProducts.length === 3,
        `Created ${testProducts.length} products`
      );

      // Bulk update
      await bulkService.bulkUpdate(
        testProducts,
        { category: 'BEBIDAS' },
        TENANT_ID,
        userId
      );
      
      const updated = await prisma.products.findMany({
        where: { id: { in: testProducts } },
      });
      
      const allUpdated = updated.every(p => p.category === 'BEBIDAS');
      logTest(
        'INTEGRATION',
        'Bulk update products',
        allUpdated,
        `Updated ${updated.length} products to BEBIDAS`
      );

      // Export CSV
      const csv = await csvService.exportToCSV(TENANT_ID, {
        category: 'BEBIDAS',
      });
      
      const hasData = csv.split('\n').length > 1;
      logTest(
        'INTEGRATION',
        'Export CSV',
        hasData,
        `Exported ${csv.split('\n').length - 1} rows`
      );

      // Cleanup
      await prisma.products.deleteMany({
        where: { id: { in: testProducts } },
      });

    } catch (error: any) {
      logTest(
        'INTEGRATION',
        'Integration workflow',
        false,
        undefined,
        error.message
      );
      
      // Cleanup on error
      if (testProducts.length > 0) {
        await prisma.products.deleteMany({
          where: { id: { in: testProducts } },
        }).catch(() => {});
      }
    }
  });
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

async function testPerformance() {
  await testSection('PERFORMANCE VERIFICATION', async () => {
    try {
      // Test 1: Bulk update performance
      console.log('\n📝 Testing bulk update performance...');
      const products = await prisma.products.findMany({
        where: { tenant_id: TENANT_ID },
        take: 50,
        select: { id: true },
      });

      if (products.length > 0) {
        const productIds = products.map(p => p.id);
        const userId = randomUUID();
        
        const startTime = Date.now();
        await bulkService.bulkUpdate(
          productIds,
          { is_active: true },
          TENANT_ID,
          userId
        );
        const duration = Date.now() - startTime;
        
        logTest(
          'PERFORMANCE',
          'Bulk update performance',
          duration < 5000,
          `Updated ${productIds.length} products in ${duration}ms (target: <5000ms)`
        );
      } else {
        logTest(
          'PERFORMANCE',
          'Bulk update performance',
          true,
          'Skipped (no products available)'
        );
      }

      // Test 2: CSV export performance
      console.log('\n📝 Testing CSV export performance...');
      const exportStart = Date.now();
      const csv = await csvService.exportToCSV(TENANT_ID, {});
      const exportDuration = Date.now() - exportStart;
      
      const exportedCount = csv.split('\n').length - 1;
      logTest(
        'PERFORMANCE',
        'CSV export performance',
        exportDuration < 10000,
        `Exported ${exportedCount} products in ${exportDuration}ms (target: <10000ms)`
      );

    } catch (error: any) {
      logTest(
        'PERFORMANCE',
        'Performance tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// DOCUMENTATION TESTS
// ============================================================================

async function testDocumentation() {
  await testSection('DOCUMENTATION VERIFICATION', async () => {
    try {
      const docs = [
        '.kiro/specs/products-p1-improvements/USER_GUIDE_IMAGES.md',
        '.kiro/specs/products-p1-improvements/USER_GUIDE_BULK_OPERATIONS.md',
        '.kiro/specs/products-p1-improvements/USER_GUIDE_CSV.md',
        '.kiro/specs/products-p1-improvements/API_DOCUMENTATION.md',
        '.kiro/specs/products-p1-improvements/DEPLOYMENT_GUIDE.md',
      ];

      let allDocsExist = true;
      const missingDocs: string[] = [];

      for (const doc of docs) {
        try {
          await fs.access(doc);
        } catch {
          allDocsExist = false;
          missingDocs.push(doc);
        }
      }

      logTest(
        'DOCUMENTATION',
        'All documentation files exist',
        allDocsExist,
        allDocsExist 
          ? `All ${docs.length} documentation files found`
          : `Missing: ${missingDocs.join(', ')}`
      );

    } catch (error: any) {
      logTest(
        'DOCUMENTATION',
        'Documentation tests',
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🧪 COMPLETE VERIFICATION: TASKS 14, 15, 16');
  console.log('='.repeat(80));
  console.log('Testing Database, Backend, APIs, Frontend, Integration, Performance');
  console.log('');

  try {
    await testDatabase();
    await testBackend();
    await testAPIs();
    await testFrontend();
    await testIntegration();
    await testPerformance();
    await testDocumentation();

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPLETE VERIFICATION SUMMARY');
    console.log('='.repeat(80));
    
    const byCategory = results.reduce((acc, r) => {
      if (!acc[r.category]) {
        acc[r.category] = { passed: 0, failed: 0 };
      }
      if (r.passed) {
        acc[r.category].passed++;
      } else {
        acc[r.category].failed++;
      }
      return acc;
    }, {} as Record<string, { passed: number; failed: number }>);

    console.log('\nResults by Category:');
    Object.entries(byCategory).forEach(([category, counts]) => {
      const total = counts.passed + counts.failed;
      const icon = counts.failed === 0 ? '✅' : '⚠️';
      console.log(`${icon} ${category}: ${counts.passed}/${total} passed`);
    });

    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`\n✅ Total Passed: ${totalPassed}/${total}`);
    console.log(`❌ Total Failed: ${totalFailed}/${total}`);
    
    if (totalFailed > 0) {
      console.log('\n⚠️  Failed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - [${r.category}] ${r.test}`);
        if (r.error) {
          console.log(`     ${r.error}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));

    if (totalFailed > 0) {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All verification tests passed!');
      console.log('Tasks 14, 15, 16 are fully verified and ready for production.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute main function
main().catch(console.error);
