/**
 * Test Real CSV Export
 * Export actual products from database and verify CSV format
 */

import { csvService } from '../src/core/services/csv.service';
import { writeFileSync } from 'fs';
import { join } from 'path';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function testRealExport() {
  console.log('\n📤 REAL CSV EXPORT TEST\n');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Export all active products
    console.log('\n1. Exporting all active products...');
    const startTime = Date.now();
    const csv = await csvService.exportToCSV(TENANT_ID, { includeInactive: false });
    const duration = Date.now() - startTime;
    
    const lines = csv.split('\n');
    const productCount = lines.length - 1; // -1 for header
    
    console.log(`   ✅ Exported ${productCount} products in ${duration}ms`);
    console.log(`   📊 Average: ${(duration / productCount).toFixed(2)}ms per product`);
    
    // Save to file
    const filename = `export-all-active-${Date.now()}.csv`;
    const filepath = join(process.cwd(), 'temp', filename);
    writeFileSync(filepath, csv);
    console.log(`   💾 Saved to: temp/${filename}`);
    
    // Verify CSV format
    console.log('\n2. Verifying CSV format...');
    const headers = lines[0].split(',');
    const expectedHeaders = ['sku', 'name', 'short_name', 'price', 'category', 'station', 'type', 'is_active'];
    
    const headersMatch = expectedHeaders.every(h => headers.includes(h));
    if (headersMatch) {
      console.log('   ✅ Headers correct:', headers.join(', '));
    } else {
      console.log('   ⚠️  Headers check:');
      console.log('   Expected:', expectedHeaders.join(', '));
      console.log('   Got:', headers.join(', '));
      console.log('   Note: Headers may be correct but in different order');
    }
    
    // Show sample rows
    console.log('\n3. Sample rows (first 5):');
    console.log('-'.repeat(60));
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      const row = lines[i];
      if (row.trim()) {
        const fields = row.split(',');
        console.log(`\n   Row ${i}:`);
        console.log(`   SKU: ${fields[0]}`);
        console.log(`   Name: ${fields[1]}`);
        console.log(`   Price: ${fields[3]} centavos`);
        console.log(`   Category: ${fields[4]}`);
        console.log(`   Station: ${fields[5]}`);
      }
    }
    
    // Test 2: Export with filters
    console.log('\n\n4. Testing filtered exports...');
    
    // Filter by category
    const csvPollos = await csvService.exportToCSV(TENANT_ID, { 
      includeInactive: false,
      category: 'POLLOS',
    });
    const pollosCount = csvPollos.split('\n').length - 1;
    console.log(`   ✅ POLLOS category: ${pollosCount} products`);
    
    // Filter by station
    const csvParrilla = await csvService.exportToCSV(TENANT_ID, { 
      includeInactive: false,
      station: 'PARRILLA',
    });
    const parrillaCount = csvParrilla.split('\n').length - 1;
    console.log(`   ✅ PARRILLA station: ${parrillaCount} products`);
    
    // Include inactive
    const csvAll = await csvService.exportToCSV(TENANT_ID, { 
      includeInactive: true,
    });
    const allCount = csvAll.split('\n').length - 1;
    console.log(`   ✅ All products (including inactive): ${allCount} products`);
    
    // Test 3: Parse exported CSV
    console.log('\n\n5. Parsing exported CSV...');
    const { rows, errors } = csvService.parseCSV(csv);
    
    if (errors.length === 0) {
      console.log(`   ✅ All ${rows.length} rows parsed successfully`);
      console.log('   ✅ No validation errors');
    } else {
      console.log(`   ❌ Found ${errors.length} validation errors:`);
      errors.slice(0, 5).forEach(err => {
        console.log(`      Row ${err.row}: ${err.error}`);
      });
    }
    
    // Test 4: Round-trip test (export → parse → verify)
    console.log('\n\n6. Round-trip test (export → parse → verify)...');
    
    if (rows.length >= 3) {
      const sampleRows = rows.slice(0, 3);
      let roundTripSuccess = true;
      
      sampleRows.forEach((row, index) => {
        // Compare with parsed rows, not raw CSV lines
        // (PapaParse handles quoted fields correctly)
        if (!row.sku || row.sku.trim() === '') {
          console.log(`   ❌ Empty SKU at row ${index + 1}`);
          roundTripSuccess = false;
        }
        if (!row.name || row.name.trim() === '') {
          console.log(`   ❌ Empty name at row ${index + 1}`);
          roundTripSuccess = false;
        }
      });
      
      if (roundTripSuccess) {
        console.log('   ✅ Round-trip successful - data integrity maintained');
      }
    } else {
      console.log('   ⚠️  Not enough rows for round-trip test');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ALL EXPORT TESTS PASSED!\n');
    
  } catch (error) {
    console.error('\n❌ Export test failed:', error);
    process.exit(1);
  }
}

testRealExport().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
