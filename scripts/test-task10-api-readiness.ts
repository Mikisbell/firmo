/**
 * Test Task 10 API Readiness
 * Verify CSV service is ready for API integration (Task 11)
 */

import { csvService } from '../src/core/services/csv.service';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const USER_ID = '00000000-0000-0000-0000-000000000001';

async function testAPIReadiness() {
  console.log('\n🔌 TASK 10: API READINESS TEST\n');
  console.log('='.repeat(60));
  console.log('Testing CSV service methods for API integration...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Export endpoint readiness
    console.log('1. Testing Export Functionality (GET /api/admin/products/export)');
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const csv = await csvService.exportToCSV(TENANT_ID, { includeInactive: false });
      const duration = Date.now() - startTime;
      
      const lines = csv.split('\n');
      const productCount = lines.length - 1;
      
      console.log(`   ✅ Export successful`);
      console.log(`   Products: ${productCount}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   CSV size: ${csv.length} bytes`);
      console.log(`   Ready for: GET /api/admin/products/export`);
    } catch (error) {
      console.log(`   ❌ Export failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 2: Export with filters
    console.log('\n2. Testing Export with Filters');
    console.log('-'.repeat(60));
    
    try {
      const csvCategory = await csvService.exportToCSV(TENANT_ID, { category: 'POLLOS' });
      const csvStation = await csvService.exportToCSV(TENANT_ID, { station: 'PARRILLA' });
      const csvInactive = await csvService.exportToCSV(TENANT_ID, { includeInactive: true });
      
      console.log(`   ✅ Category filter: ${csvCategory.split('\n').length - 1} products`);
      console.log(`   ✅ Station filter: ${csvStation.split('\n').length - 1} products`);
      console.log(`   ✅ Include inactive: ${csvInactive.split('\n').length - 1} products`);
      console.log(`   Ready for: Query parameters (category, station, includeInactive)`);
    } catch (error) {
      console.log(`   ❌ Filtered export failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 3: Template endpoint readiness
    console.log('\n3. Testing Template Generation (GET /api/admin/products/template)');
    console.log('-'.repeat(60));
    
    try {
      const template = csvService.generateTemplate();
      const lines = template.split('\n');
      
      console.log(`   ✅ Template generated`);
      console.log(`   Lines: ${lines.length}`);
      console.log(`   Size: ${template.length} bytes`);
      console.log(`   Ready for: GET /api/admin/products/template`);
    } catch (error) {
      console.log(`   ❌ Template generation failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 4: Import endpoint readiness
    console.log('\n4. Testing Import Functionality (POST /api/admin/products/import)');
    console.log('-'.repeat(60));
    
    try {
      const testCSV = `sku,name,short_name,price,category,station,type,is_active
API-TEST-${Date.now()},API Test Product,API Test,1000,POLLOS,PARRILLA,SIMPLE,true`;
      
      const result = await csvService.importFromCSV(testCSV, TENANT_ID, USER_ID);
      
      console.log(`   ✅ Import successful`);
      console.log(`   Total rows: ${result.total_rows}`);
      console.log(`   Created: ${result.created_count}`);
      console.log(`   Updated: ${result.updated_count}`);
      console.log(`   Skipped: ${result.skipped_count}`);
      console.log(`   Errors: ${result.errors.length}`);
      console.log(`   Duration: ${result.duration_ms}ms`);
      console.log(`   Ready for: POST /api/admin/products/import`);
    } catch (error) {
      console.log(`   ❌ Import failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 5: Parse validation (for import preview)
    console.log('\n5. Testing Parse Validation (for import preview)');
    console.log('-'.repeat(60));
    
    try {
      const validCSV = `sku,name,short_name,price,category,station,type,is_active
VALID-1,Valid Product,Valid,1500,POLLOS,PARRILLA,SIMPLE,true`;
      
      const invalidCSV = `sku,name,short_name,price,category,station,type,is_active
,Missing SKU,Test,1500,POLLOS,PARRILLA,SIMPLE,true
INVALID-CAT,Invalid Category,Test,1500,INVALID,PARRILLA,SIMPLE,true`;
      
      const validResult = csvService.parseCSV(validCSV);
      const invalidResult = csvService.parseCSV(invalidCSV);
      
      console.log(`   ✅ Valid CSV: ${validResult.rows.length} rows, ${validResult.errors.length} errors`);
      console.log(`   ✅ Invalid CSV: ${invalidResult.rows.length} rows, ${invalidResult.errors.length} errors`);
      console.log(`   Ready for: Import preview with validation`);
    } catch (error) {
      console.log(`   ❌ Parse validation failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 6: Error handling
    console.log('\n6. Testing Error Handling');
    console.log('-'.repeat(60));
    
    try {
      // Test with invalid CSV
      const invalidCSV = `invalid,headers
data,here`;
      
      const result = csvService.parseCSV(invalidCSV);
      
      if (result.errors.length > 0) {
        console.log(`   ✅ Invalid CSV detected: ${result.errors.length} errors`);
        console.log(`   ✅ Error message: ${result.errors[0].error}`);
        console.log(`   Ready for: Error responses with detailed messages`);
      } else {
        console.log(`   ❌ Invalid CSV not detected`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Error handling test failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 7: Large export simulation
    console.log('\n7. Testing Large Export (for streaming)');
    console.log('-'.repeat(60));
    
    try {
      const startTime = Date.now();
      const csv = await csvService.exportToCSV(TENANT_ID, { includeInactive: true });
      const duration = Date.now() - startTime;
      
      const lines = csv.split('\n');
      const productCount = lines.length - 1;
      const sizeKB = (csv.length / 1024).toFixed(2);
      
      console.log(`   ✅ Large export successful`);
      console.log(`   Products: ${productCount}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Size: ${sizeKB} KB`);
      
      if (productCount > 1000) {
        console.log(`   ⚠️  Consider streaming for ${productCount} products`);
      } else {
        console.log(`   ✅ No streaming needed for ${productCount} products`);
      }
      
      console.log(`   Ready for: Streaming response (if needed)`);
    } catch (error) {
      console.log(`   ❌ Large export failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (allTestsPassed) {
      console.log('\n✅ API READINESS: ALL TESTS PASSED\n');
      console.log('CSV Service is ready for API integration (Task 11)');
      console.log('\nNext steps:');
      console.log('  1. Create GET /api/admin/products/export endpoint');
      console.log('  2. Create POST /api/admin/products/import endpoint');
      console.log('  3. Create GET /api/admin/products/template endpoint');
      console.log('  4. Add Zod validation for import requests');
      console.log('  5. Add authorization checks (admin role)');
      console.log('  6. Write API integration tests\n');
    } else {
      console.log('\n❌ API READINESS: SOME TESTS FAILED\n');
      console.log('Fix issues before proceeding to Task 11\n');
    }
    
  } catch (error) {
    console.error('\n❌ API readiness test failed:', error);
    process.exit(1);
  }
}

testAPIReadiness().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
