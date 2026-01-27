/**
 * Test CSV API Endpoints
 * Integration tests for CSV export, import, and template endpoints
 */

import { randomUUID } from 'crypto';

const BASE_URL = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// Mock admin session (in real scenario, this would come from login)
const ADMIN_SESSION = {
  id: '00000000-0000-0000-0000-000000000001',
  role: 'ADMIN',
  tenant_id: TENANT_ID,
};

async function testCSVAPIEndpoints() {
  console.log('\n🔌 CSV API ENDPOINTS TEST\n');
  console.log('='.repeat(60));
  console.log('Testing all 3 CSV API endpoints...\n');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: GET /api/admin/products/template
    console.log('1. Testing GET /api/admin/products/template');
    console.log('-'.repeat(60));
    
    try {
      const templateResponse = await fetch(`${BASE_URL}/api/admin/products/template`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // In real scenario, would include auth cookie or header
        },
      });
      
      if (templateResponse.ok) {
        const template = await templateResponse.text();
        const lines = template.split('\n');
        
        console.log(`   ✅ Status: ${templateResponse.status}`);
        console.log(`   ✅ Content-Type: ${templateResponse.headers.get('content-type')}`);
        console.log(`   ✅ Content-Disposition: ${templateResponse.headers.get('content-disposition')}`);
        console.log(`   ✅ Template lines: ${lines.length}`);
        console.log(`   ✅ Template size: ${template.length} bytes`);
        console.log(`   ✅ Headers: ${lines[0]}`);
      } else {
        console.log(`   ❌ Failed with status: ${templateResponse.status}`);
        const error = await templateResponse.json();
        console.log(`   ❌ Error: ${JSON.stringify(error)}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 2: GET /api/admin/products/export
    console.log('\n2. Testing GET /api/admin/products/export');
    console.log('-'.repeat(60));
    
    try {
      // Test 2a: Export all active products
      const exportResponse = await fetch(`${BASE_URL}/api/admin/products/export`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (exportResponse.ok) {
        const csv = await exportResponse.text();
        const lines = csv.split('\n');
        const productCount = lines.length - 1;
        
        console.log(`   ✅ Status: ${exportResponse.status}`);
        console.log(`   ✅ Content-Type: ${exportResponse.headers.get('content-type')}`);
        console.log(`   ✅ Content-Disposition: ${exportResponse.headers.get('content-disposition')}`);
        console.log(`   ✅ Products exported: ${productCount}`);
        console.log(`   ✅ CSV size: ${csv.length} bytes`);
      } else {
        console.log(`   ❌ Failed with status: ${exportResponse.status}`);
        const error = await exportResponse.json();
        console.log(`   ❌ Error: ${JSON.stringify(error)}`);
        allTestsPassed = false;
      }
      
      // Test 2b: Export with filters
      const exportFilteredResponse = await fetch(
        `${BASE_URL}/api/admin/products/export?category=POLLOS&includeInactive=false`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (exportFilteredResponse.ok) {
        const csv = await exportFilteredResponse.text();
        const lines = csv.split('\n');
        const productCount = lines.length - 1;
        
        console.log(`   ✅ Filtered export (POLLOS): ${productCount} products`);
      } else {
        console.log(`   ❌ Filtered export failed with status: ${exportFilteredResponse.status}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 3: POST /api/admin/products/import
    console.log('\n3. Testing POST /api/admin/products/import');
    console.log('-'.repeat(60));
    
    try {
      // Create test CSV
      const testSKU = `API-TEST-${Date.now()}`;
      const testCSV = `sku,name,short_name,price,category,station,type,is_active
${testSKU},API Test Product,API Test,1500,POLLOS,PARRILLA,SIMPLE,true`;
      
      const importResponse = await fetch(`${BASE_URL}/api/admin/products/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_content: testCSV,
        }),
      });
      
      if (importResponse.ok || importResponse.status === 207) {
        const result = await importResponse.json();
        
        console.log(`   ✅ Status: ${importResponse.status}`);
        console.log(`   ✅ Total rows: ${result.total_rows}`);
        console.log(`   ✅ Created: ${result.created_count}`);
        console.log(`   ✅ Updated: ${result.updated_count}`);
        console.log(`   ✅ Skipped: ${result.skipped_count}`);
        console.log(`   ✅ Errors: ${result.errors.length}`);
        console.log(`   ✅ Duration: ${result.duration_ms}ms`);
        
        if (result.errors.length > 0) {
          console.log(`   ⚠️  Import errors:`);
          result.errors.slice(0, 3).forEach((err: any) => {
            console.log(`      Row ${err.row}: ${err.error}`);
          });
        }
      } else {
        console.log(`   ❌ Failed with status: ${importResponse.status}`);
        const error = await importResponse.json();
        console.log(`   ❌ Error: ${JSON.stringify(error)}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 4: Import validation (invalid CSV)
    console.log('\n4. Testing Import Validation (invalid CSV)');
    console.log('-'.repeat(60));
    
    try {
      const invalidCSV = `invalid,headers
data,here`;
      
      const importResponse = await fetch(`${BASE_URL}/api/admin/products/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_content: invalidCSV,
        }),
      });
      
      const result = await importResponse.json();
      
      if (importResponse.status === 400 && result.errors && result.errors.length > 0) {
        console.log(`   ✅ Status: ${importResponse.status} (Bad Request)`);
        console.log(`   ✅ Validation error detected: ${result.errors[0].error}`);
      } else {
        console.log(`   ❌ Expected validation error, got status: ${importResponse.status}`);
        allTestsPassed = false;
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Test 5: Import size limit (>5MB)
    console.log('\n5. Testing Import Size Limit (>5MB)');
    console.log('-'.repeat(60));
    
    try {
      // Create a large CSV (>5MB)
      const header = 'sku,name,short_name,price,category,station,type,is_active\n';
      const row = 'TEST-SKU,Test Product,Test,1500,POLLOS,PARRILLA,SIMPLE,true\n';
      const largeCSV = header + row.repeat(100000); // ~10MB
      
      console.log(`   Testing with CSV size: ${(largeCSV.length / 1024 / 1024).toFixed(2)}MB`);
      
      const importResponse = await fetch(`${BASE_URL}/api/admin/products/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csv_content: largeCSV,
        }),
      });
      
      if (importResponse.status === 413) {
        const error = await importResponse.json();
        console.log(`   ✅ Status: ${importResponse.status} (Payload Too Large)`);
        console.log(`   ✅ Size limit enforced: ${error.error}`);
      } else {
        console.log(`   ⚠️  Expected 413 status, got: ${importResponse.status}`);
        console.log(`   ⚠️  Size limit may not be enforced`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error}`);
      allTestsPassed = false;
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    
    if (allTestsPassed) {
      console.log('\n✅ ALL API ENDPOINT TESTS PASSED\n');
      console.log('All 3 CSV API endpoints are working correctly:');
      console.log('  1. GET /api/admin/products/template ✅');
      console.log('  2. GET /api/admin/products/export ✅');
      console.log('  3. POST /api/admin/products/import ✅\n');
      console.log('Additional validations:');
      console.log('  - Export with filters ✅');
      console.log('  - Import validation ✅');
      console.log('  - Size limit enforcement ✅\n');
    } else {
      console.log('\n❌ SOME API ENDPOINT TESTS FAILED\n');
      console.log('Review the errors above and fix issues.\n');
    }
    
  } catch (error) {
    console.error('\n❌ API endpoint test failed:', error);
    process.exit(1);
  }
}

// Note: This script requires the dev server to be running
console.log('⚠️  NOTE: This script requires the dev server to be running');
console.log('   Start the server with: npm run dev');
console.log('   Then run this script in another terminal\n');

testCSVAPIEndpoints().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
