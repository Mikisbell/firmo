/**
 * Task 11 Comprehensive Tests
 * Tests CSV API endpoints logic without requiring dev server
 */

import { csvService } from '../src/core/services/csv.service';
import prisma from '../src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = '00000000-0000-0000-0000-000000000001';

async function testTask11Comprehensive() {
  console.log('\n🧪 TASK 11: COMPREHENSIVE TESTS\n');
  console.log('='.repeat(60));
  console.log('Testing CSV API endpoint logic...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Export endpoint logic
    console.log('1. Testing Export Endpoint Logic');
    console.log('-'.repeat(60));
    
    try {
      // Test export without filters
      const csv1 = await csvService.exportToCSV(TENANT_ID, {});
      const lines1 = csv1.split('\n');
      console.log(`   ✅ Export all: ${lines1.length - 1} products`);
      
      // Test export with category filter
      const csv2 = await csvService.exportToCSV(TENANT_ID, { category: 'POLLOS' });
      const lines2 = csv2.split('\n');
      console.log(`   ✅ Export POLLOS: ${lines2.length - 1} products`);
      
      // Test export with station filter
      const csv3 = await csvService.exportToCSV(TENANT_ID, { station: 'PARRILLA' });
      const lines3 = csv3.split('\n');
      console.log(`   ✅ Export PARRILLA: ${lines3.length - 1} products`);
      
      // Test export with includeInactive
      const csv4 = await csvService.exportToCSV(TENANT_ID, { includeInactive: true });
      const lines4 = csv4.split('\n');
      console.log(`   ✅ Export all (inactive): ${lines4.length - 1} products`);
      
      // Verify CSV format
      const headers = lines1[0].trim();
      const expectedHeaders = 'sku,name,short_name,price,category,station,type,is_active';
      if (headers === expectedHeaders) {
        console.log(`   ✅ CSV headers correct`);
      } else {
        console.log(`   ❌ CSV headers mismatch`);
        console.log(`      Expected: ${expectedHeaders}`);
        console.log(`      Got: ${headers}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Export test failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 2: Template endpoint logic
    console.log('\n2. Testing Template Endpoint Logic');
    console.log('-'.repeat(60));
    
    try {
      const template = csvService.generateTemplate();
      const lines = template.split('\n');
      
      console.log(`   ✅ Template generated`);
      console.log(`   ✅ Lines: ${lines.length}`);
      console.log(`   ✅ Size: ${template.length} bytes`);
      
      // Verify template has headers
      if (lines[0].includes('sku,name')) {
        console.log(`   ✅ Template has headers`);
      } else {
        console.log(`   ❌ Template missing headers`);
        allTestsPassed = false;
      }
      
      // Verify template has example rows
      if (lines.length >= 4) {
        console.log(`   ✅ Template has example rows (${lines.length - 1} rows)`);
      } else {
        console.log(`   ❌ Template missing example rows`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Template test failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 3: Import endpoint logic (validation)
    console.log('\n3. Testing Import Endpoint Logic (Validation)');
    console.log('-'.repeat(60));
    
    try {
      // Test 3a: Valid CSV
      const validCSV = `sku,name,short_name,price,category,station,type,is_active
TASK11-TEST-${Date.now()},Task 11 Test,T11,1500,POLLOS,PARRILLA,SIMPLE,true`;
      
      const result1 = await csvService.importFromCSV(validCSV, TENANT_ID, USER_ID);
      
      console.log(`   ✅ Valid CSV import:`);
      console.log(`      Total rows: ${result1.total_rows}`);
      console.log(`      Created: ${result1.created_count}`);
      console.log(`      Updated: ${result1.updated_count}`);
      console.log(`      Skipped: ${result1.skipped_count}`);
      console.log(`      Errors: ${result1.errors.length}`);
      
      if (result1.created_count === 1 && result1.errors.length === 0) {
        console.log(`   ✅ Valid CSV processed correctly`);
      } else {
        console.log(`   ❌ Valid CSV not processed correctly`);
        allTestsPassed = false;
      }
      
      // Test 3b: Invalid CSV (missing headers)
      const invalidCSV1 = `invalid,headers
data,here`;
      
      const result2 = await csvService.importFromCSV(invalidCSV1, TENANT_ID, USER_ID);
      
      if (result2.errors.length > 0 && result2.errors[0].error.includes('Missing required headers')) {
        console.log(`   ✅ Invalid headers detected`);
      } else {
        console.log(`   ❌ Invalid headers not detected`);
        allTestsPassed = false;
      }
      
      // Test 3c: Invalid CSV (invalid category)
      const invalidCSV2 = `sku,name,short_name,price,category,station,type,is_active
INVALID-CAT,Invalid Category,Inv,1500,INVALID_CATEGORY,PARRILLA,SIMPLE,true`;
      
      const result3 = await csvService.importFromCSV(invalidCSV2, TENANT_ID, USER_ID);
      
      if (result3.errors.length > 0 && result3.errors[0].error.includes('Invalid category')) {
        console.log(`   ✅ Invalid category detected`);
      } else {
        console.log(`   ❌ Invalid category not detected`);
        allTestsPassed = false;
      }
      
      // Test 3d: Duplicate SKU in CSV
      const duplicateCSV = `sku,name,short_name,price,category,station,type,is_active
DUP-SKU,Product 1,P1,1500,POLLOS,PARRILLA,SIMPLE,true
DUP-SKU,Product 2,P2,2000,POLLOS,PARRILLA,SIMPLE,true`;
      
      const result4 = await csvService.importFromCSV(duplicateCSV, TENANT_ID, USER_ID);
      
      if (result4.errors.length > 0 && result4.errors[0].error.includes('Duplicate SKU')) {
        console.log(`   ✅ Duplicate SKU detected`);
      } else {
        console.log(`   ❌ Duplicate SKU not detected`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Import validation test failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 4: Import endpoint logic (upsert)
    console.log('\n4. Testing Import Endpoint Logic (Upsert)');
    console.log('-'.repeat(60));
    
    try {
      const testSKU = `TASK11-UPSERT-${Date.now()}`;
      
      // Create new product
      const createCSV = `sku,name,short_name,price,category,station,type,is_active
${testSKU},Upsert Test,UT,1500,POLLOS,PARRILLA,SIMPLE,true`;
      
      const result1 = await csvService.importFromCSV(createCSV, TENANT_ID, USER_ID);
      
      if (result1.created_count === 1) {
        console.log(`   ✅ Create: 1 product created`);
      } else {
        console.log(`   ❌ Create failed`);
        allTestsPassed = false;
      }
      
      // Update existing product
      const updateCSV = `sku,name,short_name,price,category,station,type,is_active
${testSKU},Upsert Test Updated,UT2,2000,BEBIDAS,BAR,SIMPLE,false`;
      
      const result2 = await csvService.importFromCSV(updateCSV, TENANT_ID, USER_ID);
      
      if (result2.updated_count === 1) {
        console.log(`   ✅ Update: 1 product updated`);
      } else {
        console.log(`   ❌ Update failed`);
        allTestsPassed = false;
      }
      
      // Verify update in database
      const product = await prisma.products.findFirst({
        where: { tenant_id: TENANT_ID, sku: testSKU },
      });
      
      if (product && product.name === 'Upsert Test Updated' && product.price_cents === 2000) {
        console.log(`   ✅ Database: Product updated correctly`);
      } else {
        console.log(`   ❌ Database: Product not updated correctly`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Upsert test failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 5: Database state verification
    console.log('\n5. Testing Database State');
    console.log('-'.repeat(60));
    
    try {
      // Check catalog version incremented
      const catalogMeta = await prisma.catalog_meta.findUnique({
        where: { tenant_id: TENANT_ID },
      });
      
      if (catalogMeta && catalogMeta.catalog_version > 0) {
        console.log(`   ✅ Catalog version: ${catalogMeta.catalog_version}`);
      } else {
        console.log(`   ❌ Catalog version not found`);
        allTestsPassed = false;
      }
      
      // Check audit logs
      const auditLogs = await prisma.admin_access_logs.count({
        where: {
          tenant_id: TENANT_ID,
          action: 'CSV_IMPORT',
        },
      });
      
      if (auditLogs > 0) {
        console.log(`   ✅ Audit logs: ${auditLogs} CSV imports logged`);
      } else {
        console.log(`   ❌ No audit logs found`);
        allTestsPassed = false;
      }
      
      // Check products count
      const productsCount = await prisma.products.count({
        where: { tenant_id: TENANT_ID },
      });
      
      console.log(`   ✅ Total products: ${productsCount}`);
    } catch (error) {
      console.log(`   ❌ Database verification failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (allTestsPassed) {
      console.log('\n✅ ALL TASK 11 TESTS PASSED\n');
      console.log('CSV API endpoint logic is working correctly:');
      console.log('  1. Export with filters ✅');
      console.log('  2. Template generation ✅');
      console.log('  3. Import validation ✅');
      console.log('  4. Import upsert logic ✅');
      console.log('  5. Database state ✅\n');
    } else {
      console.log('\n❌ SOME TASK 11 TESTS FAILED\n');
      console.log('Review the errors above and fix issues.\n');
    }
    
  } catch (error) {
    console.error('\n❌ Task 11 test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testTask11Comprehensive().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
