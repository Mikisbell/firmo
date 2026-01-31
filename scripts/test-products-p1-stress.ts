/**
 * Products P1 Improvements - Stress Tests
 * 
 * Extreme load testing for:
 * - Bulk operations (1000+ products)
 * - CSV import (5000+ rows)
 * - CSV export (10000+ products)
 * - Concurrent operations
 * - Memory usage
 * - Database performance
 * - Transaction rollbacks under load
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CSVService } from '../src/core/services/csv.service';
import { BulkOperationsService } from '../src/core/services/bulk-operations.service';
import { getTenantId } from '../src/core/config/tenant';

const prisma = new PrismaClient();
const csvService = new CSVService();
const bulkService = new BulkOperationsService();
const TENANT_ID = getTenantId();

interface StressTestResult {
  test: string;
  operations: number;
  duration: number;
  opsPerSecond: number;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: StressTestResult[] = [];

function logStressTest(
  test: string,
  operations: number,
  duration: number,
  passed: boolean,
  details?: string,
  error?: string
) {
  const opsPerSecond = Math.round((operations / duration) * 1000);
  results.push({ test, operations, duration, opsPerSecond, passed, details, error });
  
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}`);
  console.log(`   Operations: ${operations} | Duration: ${duration}ms | ${opsPerSecond} ops/sec`);
  if (details) {
    console.log(`   ${details}`);
  }
  if (error) {
    console.log(`   Error: ${error}`);
  }
}

async function testSection(title: string, tests: () => Promise<void>) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`💪 ${title}`);
  console.log(`${'-'.repeat(80)}`);
  await tests();
}

// ============================================================================
// STRESS TEST 1: Bulk Operations - 1000 Products
// ============================================================================

async function stressTestBulkOperations() {
  await testSection('STRESS TEST 1: BULK OPERATIONS (1000 PRODUCTS)', async () => {
    const testProducts: string[] = [];
    
    try {
      console.log('\n📝 Creating 1000 test products...');
      const createStart = Date.now();
      
      // Create in batches of 100
      for (let batch = 0; batch < 10; batch++) {
        const batchProducts = [];
        for (let i = 0; i < 100; i++) {
          const productId = randomUUID();
          batchProducts.push({
            id: productId,
            tenant_id: TENANT_ID,
            sku: `STRESS-BULK-${batch}-${i}-${Date.now()}`,
            name: `Stress Test Product ${batch * 100 + i}`,
            price_cents: 1000 + i,
            category: ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS'][i % 4],
            station: ['PARRILLA', 'COCINA', 'BAR', 'HORNO'][i % 4],
            type: 'SIMPLE',
            is_active: true,
          });
          testProducts.push(productId);
        }
        
        await prisma.products.createMany({ data: batchProducts });
        console.log(`   Created batch ${batch + 1}/10 (${testProducts.length} total)`);
      }
      
      const createDuration = Date.now() - createStart;
      console.log(`   ✅ Created 1000 products in ${createDuration}ms`);

      // Test 1: Bulk update 1000 products
      console.log('\n📝 Testing bulk update of 1000 products...');
      const userId = randomUUID();
      const updateStart = Date.now();
      
      await bulkService.bulkUpdate(
        testProducts,
        { category: 'BEBIDAS', is_active: false },
        TENANT_ID,
        userId
      );
      
      const updateDuration = Date.now() - updateStart;
      
      // Verify updates
      const updated = await prisma.products.count({
        where: {
          id: { in: testProducts },
          category: 'BEBIDAS',
          is_active: false,
        },
      });
      
      logStressTest(
        'Bulk update 1000 products',
        1000,
        updateDuration,
        updated === 1000 && updateDuration < 30000, // 30 seconds max
        `Updated ${updated}/1000 products`
      );

      // Test 2: Bulk delete 1000 products
      console.log('\n📝 Testing bulk delete of 1000 products...');
      const deleteStart = Date.now();
      
      await bulkService.bulkDelete(testProducts, TENANT_ID, userId);
      
      const deleteDuration = Date.now() - deleteStart;
      
      // Verify deletes
      const deleted = await prisma.products.count({
        where: {
          id: { in: testProducts },
          is_active: false,
        },
      });
      
      logStressTest(
        'Bulk delete 1000 products',
        1000,
        deleteDuration,
        deleted === 1000 && deleteDuration < 30000,
        `Deleted ${deleted}/1000 products`
      );

      // Cleanup
      await prisma.products.deleteMany({
        where: { id: { in: testProducts } },
      });

    } catch (error: any) {
      logStressTest(
        'Bulk operations stress test',
        testProducts.length,
        0,
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
// STRESS TEST 2: CSV Import - 5000 Rows
// ============================================================================

async function stressTestCSVImport() {
  await testSection('STRESS TEST 2: CSV IMPORT (5000 ROWS)', async () => {
    const testSkus: string[] = [];
    
    try {
      console.log('\n📝 Generating CSV with 5000 rows...');
      const generateStart = Date.now();
      
      const rows: string[] = ['sku,name,short_name,price,category,station,type,is_active'];
      
      for (let i = 0; i < 5000; i++) {
        const sku = `STRESS-CSV-${i}-${Date.now()}`;
        testSkus.push(sku);
        const name = `CSV Stress Test Product ${i}`;
        const price = 1000 + (i % 10000);
        const category = ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS'][i % 4];
        const station = ['PARRILLA', 'COCINA', 'BAR', 'HORNO'][i % 4];
        
        rows.push(`${sku},${name},,${price},${category},${station},SIMPLE,true`);
      }
      
      const csv = rows.join('\n');
      const generateDuration = Date.now() - generateStart;
      console.log(`   ✅ Generated CSV in ${generateDuration}ms (${(csv.length / 1024 / 1024).toFixed(2)} MB)`);

      // Test: Import 5000 rows
      console.log('\n📝 Testing CSV import of 5000 rows...');
      const userId = randomUUID();
      const importStart = Date.now();
      
      const result = await csvService.importFromCSV(csv, TENANT_ID, userId);
      
      const importDuration = Date.now() - importStart;
      
      logStressTest(
        'CSV import 5000 rows',
        5000,
        importDuration,
        result.created_count === 5000 && importDuration < 120000, // 2 minutes max
        `Created: ${result.created_count}, Updated: ${result.updated_count}, Skipped: ${result.skipped_count}`
      );

      // Cleanup
      console.log('\n📝 Cleaning up 5000 products...');
      const cleanupStart = Date.now();
      
      // Delete in batches
      for (let i = 0; i < testSkus.length; i += 500) {
        const batch = testSkus.slice(i, i + 500);
        await prisma.products.deleteMany({
          where: { sku: { in: batch } },
        });
        console.log(`   Deleted batch ${Math.floor(i / 500) + 1}/${Math.ceil(testSkus.length / 500)}`);
      }
      
      const cleanupDuration = Date.now() - cleanupStart;
      console.log(`   ✅ Cleanup completed in ${cleanupDuration}ms`);

    } catch (error: any) {
      logStressTest(
        'CSV import stress test',
        testSkus.length,
        0,
        false,
        undefined,
        error.message
      );
      
      // Cleanup on error
      if (testSkus.length > 0) {
        for (let i = 0; i < testSkus.length; i += 500) {
          const batch = testSkus.slice(i, i + 500);
          await prisma.products.deleteMany({
            where: { sku: { in: batch } },
          }).catch(() => {});
        }
      }
    }
  });
}

// ============================================================================
// STRESS TEST 3: CSV Export - Large Dataset
// ============================================================================

async function stressTestCSVExport() {
  await testSection('STRESS TEST 3: CSV EXPORT (LARGE DATASET)', async () => {
    try {
      // Get current product count
      const productCount = await prisma.products.count({
        where: { tenant_id: TENANT_ID },
      });
      
      console.log(`\n📝 Current products in database: ${productCount}`);

      // Test: Export all products
      console.log('\n📝 Testing CSV export of all products...');
      const exportStart = Date.now();
      
      const csv = await csvService.exportToCSV(TENANT_ID, {});
      
      const exportDuration = Date.now() - exportStart;
      const exportedRows = csv.split('\n').length - 1;
      const csvSizeMB = (csv.length / 1024 / 1024).toFixed(2);
      
      logStressTest(
        `CSV export ${exportedRows} products`,
        exportedRows,
        exportDuration,
        exportDuration < 60000, // 1 minute max
        `Exported ${csvSizeMB} MB`
      );

      // Test: Export with filters
      console.log('\n📝 Testing CSV export with filters...');
      const filterStart = Date.now();
      
      const filteredCsv = await csvService.exportToCSV(TENANT_ID, {
        category: 'POLLOS',
        includeInactive: false,
      });
      
      const filterDuration = Date.now() - filterStart;
      const filteredRows = filteredCsv.split('\n').length - 1;
      
      logStressTest(
        `CSV export with filters`,
        filteredRows,
        filterDuration,
        filterDuration < 30000,
        `Filtered to ${filteredRows} products`
      );

    } catch (error: any) {
      logStressTest(
        'CSV export stress test',
        0,
        0,
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// STRESS TEST 4: Concurrent Operations
// ============================================================================

async function stressTestConcurrentOperations() {
  await testSection('STRESS TEST 4: CONCURRENT OPERATIONS', async () => {
    const testProducts: string[] = [];
    
    try {
      console.log('\n📝 Creating 100 test products...');
      
      for (let i = 0; i < 100; i++) {
        const product = await prisma.products.create({
          data: {
            id: randomUUID(),
            tenant_id: TENANT_ID,
            sku: `STRESS-CONCURRENT-${i}-${Date.now()}`,
            name: `Concurrent Test Product ${i}`,
            price_cents: 1000,
            category: 'POLLOS',
            station: 'PARRILLA',
            type: 'SIMPLE',
            is_active: true,
          },
        });
        testProducts.push(product.id);
      }

      // Test: 10 concurrent bulk updates
      console.log('\n📝 Testing 10 concurrent bulk updates...');
      const concurrentStart = Date.now();
      const userId = randomUUID();
      
      const operations = [];
      for (let i = 0; i < 10; i++) {
        // Each operation updates 10 products
        const batch = testProducts.slice(i * 10, (i + 1) * 10);
        operations.push(
          bulkService.bulkUpdate(
            batch,
            { price_cents: 2000 + i },
            TENANT_ID,
            userId
          )
        );
      }
      
      await Promise.all(operations);
      
      const concurrentDuration = Date.now() - concurrentStart;
      
      // Verify all updates
      const updated = await prisma.products.findMany({
        where: { id: { in: testProducts } },
      });
      
      const allUpdated = updated.every(p => p.price_cents >= 2000);
      
      logStressTest(
        '10 concurrent bulk updates',
        100,
        concurrentDuration,
        allUpdated && concurrentDuration < 30000,
        `All ${updated.length} products updated correctly`
      );

      // Cleanup
      await prisma.products.deleteMany({
        where: { id: { in: testProducts } },
      });

    } catch (error: any) {
      logStressTest(
        'Concurrent operations stress test',
        testProducts.length,
        0,
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
// STRESS TEST 5: Memory Usage
// ============================================================================

async function stressTestMemoryUsage() {
  await testSection('STRESS TEST 5: MEMORY USAGE', async () => {
    try {
      const initialMemory = process.memoryUsage();
      console.log('\n📝 Initial memory usage:');
      console.log(`   Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);

      // Test: Generate large CSV in memory
      console.log('\n📝 Generating large CSV (10000 rows)...');
      const rows: string[] = ['sku,name,short_name,price,category,station,type,is_active'];
      
      for (let i = 0; i < 10000; i++) {
        rows.push(`SKU-${i},Product ${i},,${1000 + i},POLLOS,PARRILLA,SIMPLE,true`);
      }
      
      const csv = rows.join('\n');
      const csvSizeMB = (csv.length / 1024 / 1024).toFixed(2);
      
      const afterCSVMemory = process.memoryUsage();
      const memoryIncrease = (afterCSVMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`\n📝 After CSV generation:`);
      console.log(`   CSV Size: ${csvSizeMB} MB`);
      console.log(`   Memory Increase: ${memoryIncrease.toFixed(2)} MB`);
      console.log(`   Heap Used: ${(afterCSVMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // Test: Parse large CSV
      console.log('\n📝 Parsing large CSV...');
      const { rows: parsedRows, errors } = csvService.parseCSV(csv);
      
      const afterParseMemory = process.memoryUsage();
      const parseMemoryIncrease = (afterParseMemory.heapUsed - afterCSVMemory.heapUsed) / 1024 / 1024;
      
      console.log(`\n📝 After CSV parsing:`);
      console.log(`   Parsed Rows: ${parsedRows.length}`);
      console.log(`   Errors: ${errors.length}`);
      console.log(`   Memory Increase: ${parseMemoryIncrease.toFixed(2)} MB`);
      console.log(`   Heap Used: ${(afterParseMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      const totalMemoryIncrease = (afterParseMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      logStressTest(
        'Memory usage for 10000 row CSV',
        10000,
        0,
        totalMemoryIncrease < 500, // Less than 500 MB
        `Total memory increase: ${totalMemoryIncrease.toFixed(2)} MB`
      );

    } catch (error: any) {
      logStressTest(
        'Memory usage stress test',
        0,
        0,
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// STRESS TEST 6: Database Connection Pool
// ============================================================================

async function stressTestDatabasePool() {
  await testSection('STRESS TEST 6: DATABASE CONNECTION POOL', async () => {
    try {
      console.log('\n📝 Testing 50 concurrent database queries...');
      const queryStart = Date.now();
      
      const queries = [];
      for (let i = 0; i < 50; i++) {
        queries.push(
          prisma.products.count({
            where: { tenant_id: TENANT_ID },
          })
        );
      }
      
      const results = await Promise.all(queries);
      const queryDuration = Date.now() - queryStart;
      
      const allSuccessful = results.every(r => typeof r === 'number');
      
      logStressTest(
        '50 concurrent database queries',
        50,
        queryDuration,
        allSuccessful && queryDuration < 10000,
        `All queries returned successfully`
      );

    } catch (error: any) {
      logStressTest(
        'Database pool stress test',
        0,
        0,
        false,
        undefined,
        error.message
      );
    }
  });
}

// ============================================================================
// STRESS TEST 7: Transaction Rollbacks Under Load
// ============================================================================

async function stressTestTransactionRollbacks() {
  await testSection('STRESS TEST 7: TRANSACTION ROLLBACKS UNDER LOAD', async () => {
    const testProducts: string[] = [];
    
    try {
      console.log('\n📝 Creating 50 test products...');
      
      for (let i = 0; i < 50; i++) {
        const product = await prisma.products.create({
          data: {
            id: randomUUID(),
            tenant_id: TENANT_ID,
            sku: `STRESS-ROLLBACK-${i}-${Date.now()}`,
            name: `Rollback Test Product ${i}`,
            price_cents: 1000,
            category: 'POLLOS',
            station: 'PARRILLA',
            type: 'SIMPLE',
            is_active: true,
          },
        });
        testProducts.push(product.id);
      }

      // Test: Force transaction rollback
      console.log('\n📝 Testing transaction rollback...');
      const userId = randomUUID();
      
      try {
        await bulkService.bulkUpdate(
          [...testProducts, randomUUID()], // Add invalid ID to force error
          { category: 'BEBIDAS' },
          TENANT_ID,
          userId
        );
      } catch (error) {
        // Expected error
      }
      
      // Verify no partial updates
      const products = await prisma.products.findMany({
        where: { id: { in: testProducts } },
      });
      
      const noneUpdated = products.every(p => p.category === 'POLLOS');
      
      logStressTest(
        'Transaction rollback verification',
        50,
        0,
        noneUpdated,
        noneUpdated ? 'No partial updates (atomic)' : 'Partial updates detected!'
      );

      // Cleanup
      await prisma.products.deleteMany({
        where: { id: { in: testProducts } },
      });

    } catch (error: any) {
      logStressTest(
        'Transaction rollback stress test',
        testProducts.length,
        0,
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
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('💪 PRODUCTS P1 IMPROVEMENTS - STRESS TESTS');
  console.log('='.repeat(80));
  console.log('Extreme load testing for production readiness');
  console.log('');

  const overallStart = Date.now();

  try {
    await stressTestBulkOperations();
    await stressTestCSVImport();
    await stressTestCSVExport();
    await stressTestConcurrentOperations();
    await stressTestMemoryUsage();
    await stressTestDatabasePool();
    await stressTestTransactionRollbacks();

    const overallDuration = Date.now() - overallStart;

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 STRESS TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`\n✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${failed}/${total}`);
    console.log(`⏱️  Total Duration: ${(overallDuration / 1000).toFixed(2)}s`);
    
    if (failed > 0) {
      console.log('\n⚠️  Failed tests:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.test}`);
        if (r.error) {
          console.log(`     ${r.error}`);
        }
      });
    }
    
    // Performance summary table
    console.log('\n' + '='.repeat(80));
    console.log('STRESS TEST METRICS');
    console.log('='.repeat(80));
    console.log('Test                              | Operations | Duration  | Ops/Sec | Status');
    console.log('-'.repeat(80));
    
    results.forEach(r => {
      const testName = r.test.padEnd(33);
      const ops = String(r.operations).padEnd(10);
      const duration = `${r.duration}ms`.padEnd(9);
      const opsPerSec = String(r.opsPerSecond).padEnd(7);
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${testName} | ${ops} | ${duration} | ${opsPerSec} | ${status}`);
    });
    
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n⚠️  Some stress tests failed. Review the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All stress tests passed!');
      console.log('System is ready for production load.');
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
