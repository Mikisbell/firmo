/**
 * CSV Service Integration Tests
 * Tests CSV export, parse, and import functionality
 */

import { csvService } from '../src/core/services/csv.service';
import prisma from '../src/core/db/prisma';
import { randomUUID } from 'crypto';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = '00000000-0000-0000-0000-000000000001';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, duration?: number) {
  results.push({ name, passed, error, duration });
  const status = passed ? '✅' : '❌';
  const durationStr = duration ? ` (${duration}ms)` : '';
  console.log(`${status} ${name}${durationStr}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function runTests() {
  console.log('\n🧪 CSV SERVICE INTEGRATION TESTS\n');
  console.log('='.repeat(60));
  console.log('');
  
  const startTime = Date.now();
  
  // Test 1: Generate Template
  {
    const testName = 'Generate CSV Template';
    const start = Date.now();
    try {
      const template = csvService.generateTemplate();
      
      if (template.includes('sku,name,short_name,price,category,station,type,is_active')) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error('Template missing required headers');
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 2: Parse Valid CSV
  {
    const testName = 'Parse Valid CSV';
    const start = Date.now();
    try {
      const csv = `sku,name,price,category,station,type
TEST-CSV-1,Test Product 1,1500,POLLOS,PARRILLA,SIMPLE
TEST-CSV-2,Test Product 2,2500,BEBIDAS,BAR,SIMPLE`;
      
      const { rows, errors } = csvService.parseCSV(csv);
      
      if (errors.length === 0 && rows.length === 2) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 0 errors and 2 rows, got ${errors.length} errors and ${rows.length} rows`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 3: Parse CSV with Errors
  {
    const testName = 'Parse CSV with Validation Errors';
    const start = Date.now();
    try {
      const csv = `sku,name,price,category,station,type
,Missing SKU,1500,POLLOS,PARRILLA,SIMPLE
TEST-CSV-3,Missing Price,,POLLOS,PARRILLA,SIMPLE
TEST-CSV-4,Invalid Category,1500,INVALID,PARRILLA,SIMPLE`;
      
      const { rows, errors } = csvService.parseCSV(csv);
      
      if (errors.length === 3 && rows.length === 0) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 3 errors and 0 rows, got ${errors.length} errors and ${rows.length} rows`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 4: Detect Duplicate SKUs
  {
    const testName = 'Detect Duplicate SKUs';
    const start = Date.now();
    try {
      const csv = `sku,name,price,category,station,type
TEST-DUP,Product 1,1500,POLLOS,PARRILLA,SIMPLE
TEST-DUP,Product 2,2500,POLLOS,PARRILLA,SIMPLE`;
      
      const { rows, errors } = csvService.parseCSV(csv);
      
      if (errors.length === 1 && errors[0].error.includes('Duplicate SKU')) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error('Duplicate SKU not detected');
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 5: Export Products to CSV
  {
    const testName = 'Export Products to CSV';
    const start = Date.now();
    try {
      const csv = await csvService.exportToCSV(TENANT_ID, { includeInactive: false });
      
      if (csv.includes('sku,name,short_name,price,category,station,type,is_active')) {
        const lines = csv.split('\n');
        console.log(`   Exported ${lines.length - 1} products`);
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error('Export missing required headers');
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 6: Import CSV (Create New Products)
  {
    const testName = 'Import CSV - Create New Products';
    const start = Date.now();
    try {
      const timestamp = Date.now();
      const csv = `sku,name,price,category,station,type,is_active
CSV-IMPORT-${timestamp}-1,CSV Test Product 1,1500,POLLOS,PARRILLA,SIMPLE,true
CSV-IMPORT-${timestamp}-2,CSV Test Product 2,2500,BEBIDAS,BAR,SIMPLE,true`;
      
      const result = await csvService.importFromCSV(csv, TENANT_ID, USER_ID);
      
      if (result.created_count === 2 && result.updated_count === 0 && result.skipped_count === 0) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 2 created, 0 updated, 0 skipped. Got ${result.created_count} created, ${result.updated_count} updated, ${result.skipped_count} skipped`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 7: Import CSV (Update Existing Products)
  {
    const testName = 'Import CSV - Update Existing Products';
    const start = Date.now();
    try {
      // First, create a product
      const timestamp = Date.now();
      const sku = `CSV-UPDATE-${timestamp}`;
      
      await prisma.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          sku,
          name: 'Original Name',
          price_cents: 1000,
          category: 'POLLOS',
          station: 'PARRILLA',
          type: 'SIMPLE',
          is_active: true,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      
      // Now import CSV with updated data
      const csv = `sku,name,price,category,station,type,is_active
${sku},Updated Name,2000,BEBIDAS,BAR,SIMPLE,true`;
      
      const result = await csvService.importFromCSV(csv, TENANT_ID, USER_ID);
      
      if (result.created_count === 0 && result.updated_count === 1 && result.skipped_count === 0) {
        // Verify the update
        const product = await prisma.products.findFirst({
          where: { sku, tenant_id: TENANT_ID },
        });
        
        if (product && product.name === 'Updated Name' && product.price_cents === 2000) {
          logTest(testName, true, undefined, Date.now() - start);
        } else {
          throw new Error('Product not updated correctly');
        }
      } else {
        throw new Error(`Expected 0 created, 1 updated, 0 skipped. Got ${result.created_count} created, ${result.updated_count} updated, ${result.skipped_count} skipped`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 8: Import CSV with Mixed Operations
  {
    const testName = 'Import CSV - Mixed Create/Update';
    const start = Date.now();
    try {
      const timestamp = Date.now();
      
      // Create one existing product
      const existingSku = `CSV-MIXED-${timestamp}-EXISTING`;
      await prisma.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          sku: existingSku,
          name: 'Existing Product',
          price_cents: 1000,
          category: 'POLLOS',
          station: 'PARRILLA',
          type: 'SIMPLE',
          is_active: true,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
      
      // Import CSV with 1 update + 2 creates
      const csv = `sku,name,price,category,station,type,is_active
${existingSku},Updated Existing,1500,POLLOS,PARRILLA,SIMPLE,true
CSV-MIXED-${timestamp}-NEW-1,New Product 1,2000,BEBIDAS,BAR,SIMPLE,true
CSV-MIXED-${timestamp}-NEW-2,New Product 2,2500,EXTRAS,COCINA,SIMPLE,true`;
      
      const result = await csvService.importFromCSV(csv, TENANT_ID, USER_ID);
      
      if (result.created_count === 2 && result.updated_count === 1 && result.skipped_count === 0) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 2 created, 1 updated, 0 skipped. Got ${result.created_count} created, ${result.updated_count} updated, ${result.skipped_count} skipped`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  // Test 9: Import CSV with Invalid Rows (Skip and Continue)
  {
    const testName = 'Import CSV - Skip Invalid Rows';
    const start = Date.now();
    try {
      const timestamp = Date.now();
      const csv = `sku,name,price,category,station,type,is_active
CSV-SKIP-${timestamp}-1,Valid Product 1,1500,POLLOS,PARRILLA,SIMPLE,true
,Invalid Product,1500,POLLOS,PARRILLA,SIMPLE,true
CSV-SKIP-${timestamp}-2,Valid Product 2,2500,BEBIDAS,BAR,SIMPLE,true`;
      
      const result = await csvService.importFromCSV(csv, TENANT_ID, USER_ID);
      
      // Should create 2 valid products and skip 1 invalid
      if (result.created_count === 2 && result.skipped_count === 0 && result.errors.length === 1) {
        logTest(testName, true, undefined, Date.now() - start);
      } else {
        throw new Error(`Expected 2 created, 0 skipped, 1 error. Got ${result.created_count} created, ${result.skipped_count} skipped, ${result.errors.length} errors`);
      }
    } catch (error) {
      logTest(testName, false, error instanceof Error ? error.message : String(error));
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const totalTests = results.length;
  const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(0);
  
  console.log(`Total: ${totalPassed}/${totalTests} passed (${totalPercentage}%)`);
  console.log(`⏱️  Duration: ${totalDuration}ms`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) {
        console.log(`    ${r.error}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  await prisma.$disconnect();
  
  if (totalFailed === 0) {
    console.log('\n✅ ALL TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.log(`\n❌ ${totalFailed} TEST(S) FAILED\n`);
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
