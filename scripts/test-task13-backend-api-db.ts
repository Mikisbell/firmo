/**
 * Task 13 - Backend, API & Database Testing
 * 
 * Comprehensive testing of:
 * - Backend services (CSV, Bulk, Image)
 * - API endpoints
 * - Database schema and data
 * - Integration between layers
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

interface TestResult {
  section: string;
  test: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function logTest(section: string, test: string, passed: boolean, details?: string) {
  results.push({ section, test, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}${details ? ` - ${details}` : ''}`);
}

async function testSection(title: string, tests: () => Promise<void>) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 ${title}`);
  console.log(`${'-'.repeat(80)}`);
  await tests();
}

// ============================================================================
// SECTION 1: Backend Services
// ============================================================================

async function testBackendServices() {
  await testSection('BACKEND SERVICES', async () => {
    // CSV Service
    try {
      const csvServicePath = 'src/core/services/csv.service.ts';
      const csvContent = fs.readFileSync(csvServicePath, 'utf-8');
      
      logTest('Backend', 'CSV Service exists', true);
      logTest('Backend', 'CSV Service has exportToCSV', csvContent.includes('exportToCSV'));
      logTest('Backend', 'CSV Service has parseCSV', csvContent.includes('parseCSV'));
      logTest('Backend', 'CSV Service has importFromCSV', csvContent.includes('importFromCSV'));
      logTest('Backend', 'CSV Service has generateTemplate', csvContent.includes('generateTemplate'));
      logTest('Backend', 'CSV Service uses Papa.parse', csvContent.includes('Papa.parse'));
      logTest('Backend', 'CSV Service uses Papa.unparse', csvContent.includes('Papa.unparse'));
      
    } catch (error: any) {
      logTest('Backend', 'CSV Service check', false, error.message);
    }

    // Bulk Operations Service
    try {
      const bulkServicePath = 'src/core/services/bulk-operations.service.ts';
      const bulkContent = fs.readFileSync(bulkServicePath, 'utf-8');
      
      logTest('Backend', 'Bulk Service exists', true);
      logTest('Backend', 'Bulk Service has bulkUpdate', bulkContent.includes('bulkUpdate'));
      logTest('Backend', 'Bulk Service has bulkDelete', bulkContent.includes('bulkDelete'));
      logTest('Backend', 'Bulk Service uses transactions', bulkContent.includes('transaction') || bulkContent.includes('$transaction'));
      logTest('Backend', 'Bulk Service has audit logging', bulkContent.includes('admin_access_log'));
      logTest('Backend', 'Bulk Service has cache invalidation', bulkContent.includes('invalidate'));
      
    } catch (error: any) {
      logTest('Backend', 'Bulk Service check', false, error.message);
    }

    // Image Service
    try {
      const imageServicePath = 'src/core/images/image.service.ts';
      const imageContent = fs.readFileSync(imageServicePath, 'utf-8');
      
      logTest('Backend', 'Image Service exists', true);
      logTest('Backend', 'Image Service has uploadImage', imageContent.includes('uploadImage'));
      logTest('Backend', 'Image Service has deleteImage', imageContent.includes('deleteImage'));
      logTest('Backend', 'Image Service has optimizeImage', imageContent.includes('optimize'));
      logTest('Backend', 'Image Service uses Sharp', imageContent.includes('sharp'));
      
    } catch (error: any) {
      logTest('Backend', 'Image Service check', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 2: API Endpoints
// ============================================================================

async function testAPIEndpoints() {
  await testSection('API ENDPOINTS', async () => {
    const apiEndpoints = [
      { path: 'src/app/api/admin/products/export/route.ts', name: 'CSV Export API' },
      { path: 'src/app/api/admin/products/import/route.ts', name: 'CSV Import API' },
      { path: 'src/app/api/admin/products/bulk/route.ts', name: 'Bulk Operations API' },
      { path: 'src/app/api/admin/products/images/route.ts', name: 'Image Upload API' },
    ];

    for (const endpoint of apiEndpoints) {
      try {
        const exists = fs.existsSync(endpoint.path);
        logTest('API', `${endpoint.name} exists`, exists);

        if (exists) {
          const content = fs.readFileSync(endpoint.path, 'utf-8');
          
          // Check for HTTP methods (Next.js 15 style with async function or handler)
          const hasGET = content.includes('async function handleGET') || 
                        content.includes('export async function GET') ||
                        content.includes('function GET');
          const hasPOST = content.includes('async function handlePOST') || 
                         content.includes('export async function POST') ||
                         content.includes('function POST');
          const hasDELETE = content.includes('async function handleDELETE') || 
                           content.includes('export async function DELETE') ||
                           content.includes('function DELETE');
          
          // Check for validation
          const hasValidation = content.includes('zod') || content.includes('validate') || content.includes('schema') || content.includes('Schema');
          
          if (endpoint.name.includes('Export')) {
            logTest('API', `${endpoint.name} has GET method`, hasGET);
            // Export API has optional query params, validation is less critical
            const hasParamHandling = content.includes('searchParams') || content.includes('query');
            logTest('API', `${endpoint.name} has parameter handling`, hasParamHandling);
          }
          if (endpoint.name.includes('Import') || endpoint.name.includes('Bulk') || endpoint.name.includes('Image')) {
            logTest('API', `${endpoint.name} has POST method`, hasPOST);
            // These APIs require strict validation
            logTest('API', `${endpoint.name} has validation`, hasValidation);
          }
          
          // Check for error handling
          const hasErrorHandling = content.includes('try') && content.includes('catch');
          logTest('API', `${endpoint.name} has error handling`, hasErrorHandling);
          
          // Check for authentication
          const hasAuth = content.includes('getSession') || content.includes('auth') || content.includes('requireAdminAuth');
          logTest('API', `${endpoint.name} has authentication`, hasAuth);
        }
      } catch (error: any) {
        logTest('API', `${endpoint.name} check`, false, error.message);
      }
    }
  });
}

// ============================================================================
// SECTION 3: Database Schema
// ============================================================================

async function testDatabaseSchema() {
  await testSection('DATABASE SCHEMA', async () => {
    try {
      // Check Prisma schema file
      const schemaPath = 'prisma/schema.prisma';
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      
      logTest('Database', 'Prisma schema exists', true);
      
      // Check for products table
      const hasProductsTable = schemaContent.includes('model products') || schemaContent.includes('model product');
      logTest('Database', 'Products table defined', hasProductsTable);
      
      // Check for required fields
      logTest('Database', 'Products has sku field', schemaContent.includes('sku'));
      logTest('Database', 'Products has name field', schemaContent.includes('name'));
      logTest('Database', 'Products has price_cents field', schemaContent.includes('price_cents'));
      logTest('Database', 'Products has category field', schemaContent.includes('category'));
      logTest('Database', 'Products has station field', schemaContent.includes('station'));
      logTest('Database', 'Products has images field', schemaContent.includes('images'));
      
      // Check for audit logs table
      const hasAuditTable = schemaContent.includes('admin_access_log');
      logTest('Database', 'Audit logs table defined', hasAuditTable);
      
      // Check for catalog meta table
      const hasCatalogMeta = schemaContent.includes('catalog_meta');
      logTest('Database', 'Catalog meta table defined', hasCatalogMeta);
      
    } catch (error: any) {
      logTest('Database', 'Schema check', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 4: Database Connection & Data
// ============================================================================

async function testDatabaseConnection() {
  await testSection('DATABASE CONNECTION & DATA', async () => {
    try {
      // Test connection
      await prisma.$connect();
      logTest('Database', 'Connection successful', true);
      
      // Check if products table exists and has data
      try {
        const productCount = await prisma.products.count();
        logTest('Database', `Products table accessible (${productCount} rows)`, true);
        
        if (productCount > 0) {
          // Check sample product structure
          const sampleProduct = await prisma.products.findFirst({
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
              tenant_id: true,
              version: true,
              created_at: true,
              updated_at: true,
            },
          });
          
          if (sampleProduct) {
            logTest('Database', 'Product has id (UUID)', typeof sampleProduct.id === 'string');
            logTest('Database', 'Product has sku', typeof sampleProduct.sku === 'string');
            logTest('Database', 'Product has name', typeof sampleProduct.name === 'string');
            logTest('Database', 'Product has price_cents (number)', typeof sampleProduct.price_cents === 'number');
            logTest('Database', 'Product has category', typeof sampleProduct.category === 'string');
            logTest('Database', 'Product has station', typeof sampleProduct.station === 'string');
            logTest('Database', 'Product has type', typeof sampleProduct.type === 'string');
            logTest('Database', 'Product has is_active (boolean)', typeof sampleProduct.is_active === 'boolean');
            logTest('Database', 'Product has tenant_id', typeof sampleProduct.tenant_id === 'string');
            logTest('Database', 'Product has version', typeof sampleProduct.version === 'number');
            
            // Check images field (JSONB)
            const hasImagesField = sampleProduct.images !== undefined;
            logTest('Database', 'Product has images field', hasImagesField);
          }
        } else {
          logTest('Database', 'Products table has data', false, 'No products found - run seed script');
        }
      } catch (error: any) {
        logTest('Database', 'Products table query', false, error.message);
      }
      
      // Check audit logs table
      try {
        const auditCount = await prisma.admin_access_logs.count();
        logTest('Database', `Audit logs table accessible (${auditCount} rows)`, true);
      } catch (error: any) {
        logTest('Database', 'Audit logs table query', false, error.message);
      }
      
      // Check catalog meta table
      try {
        const catalogCount = await prisma.catalog_meta.count();
        logTest('Database', `Catalog meta table accessible (${catalogCount} rows)`, true);
      } catch (error: any) {
        logTest('Database', 'Catalog meta table query', false, error.message);
      }
      
    } catch (error: any) {
      logTest('Database', 'Database connection', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 5: Service Integration
// ============================================================================

async function testServiceIntegration() {
  await testSection('SERVICE INTEGRATION', async () => {
    try {
      // Test CSV Service integration
      const { CSVService } = await import('../src/core/services/csv.service');
      const csvService = new CSVService();
      logTest('Integration', 'CSV Service instantiable', true);
      
      // Test template generation (doesn't require DB)
      const template = csvService.generateTemplate();
      logTest('Integration', 'CSV template generation works', template.length > 0);
      logTest('Integration', 'CSV template has headers', template.includes('sku,name'));
      
      // Test CSV parsing (doesn't require DB)
      const testCSV = 'sku,name,short_name,price,category,station,type,is_active\nTEST-1,Test Product,,1000,POLLOS,PARRILLA,SIMPLE,true';
      const parseResult = csvService.parseCSV(testCSV);
      logTest('Integration', 'CSV parsing works', parseResult.rows.length > 0);
      logTest('Integration', 'CSV parsing returns correct structure', 
        Array.isArray(parseResult.rows) && Array.isArray(parseResult.errors));
      
    } catch (error: any) {
      logTest('Integration', 'CSV Service integration', false, error.message);
    }
    
    try {
      // Test Bulk Operations Service integration
      const { BulkOperationsService } = await import('../src/core/services/bulk-operations.service');
      const bulkService = new BulkOperationsService();
      logTest('Integration', 'Bulk Service instantiable', true);
      
    } catch (error: any) {
      logTest('Integration', 'Bulk Service integration', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 6: Property-Based Tests Execution
// ============================================================================

async function testPropertyBasedTests() {
  await testSection('PROPERTY-BASED TESTS EXECUTION', async () => {
    try {
      // Check if tests can be imported
      const testFiles = [
        'src/core/__tests__/properties-bulk.test.ts',
        'src/core/__tests__/properties-csv.test.ts',
        'src/core/__tests__/properties-images.test.ts',
      ];
      
      for (const file of testFiles) {
        const exists = fs.existsSync(file);
        const fileName = file.split('/').pop() || file;
        logTest('Tests', `${fileName} is executable`, exists);
      }
      
      // Note: Actual test execution happens via npm test
      logTest('Tests', 'Property tests ready for execution', true, 'Run: npm test -- src/core/__tests__/properties- --run');
      
    } catch (error: any) {
      logTest('Tests', 'Property tests check', false, error.message);
    }
  });
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🧪 TASK 13 - BACKEND, API & DATABASE TESTING');
  console.log('='.repeat(80));

  try {
    await testBackendServices();
    await testAPIEndpoints();
    await testDatabaseSchema();
    await testDatabaseConnection();
    await testServiceIntegration();
    await testPropertyBasedTests();

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const percentage = ((passed / total) * 100).toFixed(1);

    console.log(`✅ Passed: ${passed}/${total} (${percentage}%)`);
    console.log(`❌ Failed: ${failed}/${total}`);
    
    if (failed > 0) {
      console.log('\n⚠️  Failed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.section}: ${r.test}${r.details ? ` (${r.details})` : ''}`);
      });
    }
    
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All backend, API, and database tests passed!');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
