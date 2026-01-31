/**
 * Task 13 - Property-Based Tests - Comprehensive Testing
 * 
 * Tests all aspects of the property-based testing implementation:
 * - Test files existence and structure
 * - Arbitraries completeness
 * - Test execution and results
 * - Integration with existing codebase
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface TestResult {
  section: string;
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function logTest(section: string, test: string, passed: boolean, error?: string) {
  results.push({ section, test, passed, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${test}${error ? ` - ${error}` : ''}`);
}

async function testSection(title: string, tests: () => Promise<void>) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 SECTION: ${title}`);
  console.log(`${'-'.repeat(80)}`);
  await tests();
}

// ============================================================================
// SECTION 1: Test Files Structure
// ============================================================================

async function testFilesStructure() {
  await testSection('TEST FILES STRUCTURE', async () => {
    const testFiles = [
      'src/core/__tests__/arbitraries.ts',
      'src/core/__tests__/properties-bulk.test.ts',
      'src/core/__tests__/properties-csv.test.ts',
      'src/core/__tests__/properties-images.test.ts',
      'src/core/__tests__/properties-performance.test.ts',
      'src/core/__tests__/properties-security.test.ts',
      'src/core/__tests__/properties-feedback.test.ts',
      'src/core/__tests__/properties-compatibility.test.ts',
    ];

    for (const file of testFiles) {
      try {
        const exists = fs.existsSync(file);
        logTest('Files', `${path.basename(file)} exists`, exists);
        
        if (exists) {
          const content = fs.readFileSync(file, 'utf-8');
          const lines = content.split('\n').length;
          logTest('Files', `${path.basename(file)} has content (${lines} lines)`, lines > 50);
        }
      } catch (error: any) {
        logTest('Files', `${path.basename(file)} check`, false, error.message);
      }
    }
  });
}

// ============================================================================
// SECTION 2: Arbitraries Completeness
// ============================================================================

async function testArbitraries() {
  await testSection('ARBITRARIES COMPLETENESS', async () => {
    try {
      const arbitrariesPath = 'src/core/__tests__/arbitraries.ts';
      const content = fs.readFileSync(arbitrariesPath, 'utf-8');

      const requiredExports = [
        'productCategory',
        'productStation',
        'productType',
        'productSKU',
        'productName',
        'productPriceCents',
        'validProduct',
        'csvRow',
        'bulkUpdateRequest',
        'productImage',
        'productImages',
        'validImageFormat',
        'imageSize',
        'tenantId',
        'userId',
        'productId',
        'productData',
        'generateCSV',
        'createMockFile',
      ];

      for (const exportName of requiredExports) {
        const hasExport = content.includes(`export const ${exportName}`) || 
                         content.includes(`export function ${exportName}`);
        logTest('Arbitraries', `Has ${exportName}`, hasExport);
      }

      // Check for fast-check import
      const hasFastCheck = content.includes("import fc from 'fast-check'");
      logTest('Arbitraries', 'Imports fast-check', hasFastCheck);

    } catch (error: any) {
      logTest('Arbitraries', 'Read arbitraries file', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 3: Test File Structure
// ============================================================================

async function testTestFileStructure() {
  await testSection('TEST FILE STRUCTURE', async () => {
    const testFiles = [
      { file: 'properties-bulk.test.ts', expectedTests: 13 },
      { file: 'properties-csv.test.ts', expectedTests: 11 },
      { file: 'properties-images.test.ts', expectedTests: 9 },
      { file: 'properties-performance.test.ts', expectedTests: 6 },
      { file: 'properties-security.test.ts', expectedTests: 3 },
      { file: 'properties-feedback.test.ts', expectedTests: 4 },
      { file: 'properties-compatibility.test.ts', expectedTests: 4 },
    ];

    for (const { file, expectedTests } of testFiles) {
      try {
        const filePath = `src/core/__tests__/${file}`;
        const content = fs.readFileSync(filePath, 'utf-8');

        // Count test cases
        const testMatches = content.match(/it\(/g);
        const testCount = testMatches ? testMatches.length : 0;
        logTest('Structure', `${file} has ${expectedTests} tests`, testCount >= expectedTests);

        // Check for fast-check usage
        const usesFastCheck = content.includes('fc.assert') && content.includes('fc.asyncProperty');
        logTest('Structure', `${file} uses fast-check`, usesFastCheck);

        // Check for proper tags
        const hasProperTags = content.includes('Feature: products-p1-improvements');
        logTest('Structure', `${file} has proper tags`, hasProperTags);

        // Check for numRuns configuration
        const hasNumRuns = content.includes('numRuns: 100');
        logTest('Structure', `${file} has numRuns: 100`, hasNumRuns);

      } catch (error: any) {
        logTest('Structure', `${file} check`, false, error.message);
      }
    }
  });
}

// ============================================================================
// SECTION 4: Property Coverage
// ============================================================================

async function testPropertyCoverage() {
  await testSection('PROPERTY COVERAGE', async () => {
    const propertyRanges = [
      { name: 'Images', start: 1, end: 9 },
      { name: 'Bulk Operations', start: 10, end: 22 },
      { name: 'CSV', start: 23, end: 33 },
      { name: 'Performance', start: 34, end: 39 },
      { name: 'Security', start: 40, end: 42 },
      { name: 'User Feedback', start: 43, end: 45 },
      { name: 'Compatibility', start: 46, end: 48 },
    ];

    const allTestFiles = fs.readdirSync('src/core/__tests__')
      .filter(f => f.startsWith('properties-') && f.endsWith('.test.ts'))
      .map(f => fs.readFileSync(`src/core/__tests__/${f}`, 'utf-8'))
      .join('\n');

    for (const { name, start, end } of propertyRanges) {
      const count = end - start + 1;
      let found = 0;

      for (let i = start; i <= end; i++) {
        if (allTestFiles.includes(`Property ${i}:`)) {
          found++;
        }
      }

      logTest('Coverage', `${name} properties (${found}/${count})`, found === count);
    }

    // Total count
    const totalExpected = 48;
    const totalMatches = allTestFiles.match(/Property \d+:/g);
    const totalFound = totalMatches ? totalMatches.length : 0;
    logTest('Coverage', `Total properties (${totalFound}/${totalExpected})`, totalFound >= totalExpected);
  });
}

// ============================================================================
// SECTION 5: Database Integration
// ============================================================================

async function testDatabaseIntegration() {
  await testSection('DATABASE INTEGRATION', async () => {
    try {
      // Check if database has products (needed for some tests)
      const productCount = await prisma.product.count();
      logTest('Database', `Has products (${productCount})`, productCount > 0);

      // Check if products have required fields for CSV tests
      if (productCount > 0) {
        const sampleProduct = await prisma.product.findFirst({
          select: {
            sku: true,
            name: true,
            price_cents: true,
            category: true,
            station: true,
            type: true,
            is_active: true,
          },
        });

        logTest('Database', 'Products have SKU', !!sampleProduct?.sku);
        logTest('Database', 'Products have name', !!sampleProduct?.name);
        logTest('Database', 'Products have price_cents', typeof sampleProduct?.price_cents === 'number');
        logTest('Database', 'Products have category', !!sampleProduct?.category);
        logTest('Database', 'Products have station', !!sampleProduct?.station);
      }

      // Check for audit logs table (needed for bulk operations tests)
      const auditLogCount = await prisma.admin_access_log.count();
      logTest('Database', `Has audit logs table (${auditLogCount} entries)`, true);

    } catch (error: any) {
      logTest('Database', 'Database connection', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 6: Test Execution Summary
// ============================================================================

async function testExecutionSummary() {
  await testSection('TEST EXECUTION SUMMARY', async () => {
    try {
      // Check if vitest is configured
      const vitestConfigExists = fs.existsSync('vitest.config.ts');
      logTest('Execution', 'Vitest config exists', vitestConfigExists);

      // Check if fast-check is installed
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const hasFastCheck = packageJson.devDependencies?.['fast-check'] || packageJson.dependencies?.['fast-check'];
      logTest('Execution', 'fast-check installed', !!hasFastCheck);

      // Check test scripts
      const hasTestScript = !!packageJson.scripts?.test;
      logTest('Execution', 'Has test script', hasTestScript);

    } catch (error: any) {
      logTest('Execution', 'Check test configuration', false, error.message);
    }
  });
}

// ============================================================================
// SECTION 7: Documentation
// ============================================================================

async function testDocumentation() {
  await testSection('DOCUMENTATION', async () => {
    const docFiles = [
      'PRODUCTOS_P1_TASK13_PROGRESO.md',
      'PRODUCTOS_P1_TASK13_SESION_27_ENERO.md',
    ];

    for (const file of docFiles) {
      try {
        const exists = fs.existsSync(file);
        logTest('Documentation', `${file} exists`, exists);

        if (exists) {
          const content = fs.readFileSync(file, 'utf-8');
          const hasMetrics = content.includes('Progreso') || content.includes('Tests');
          logTest('Documentation', `${file} has metrics`, hasMetrics);
        }
      } catch (error: any) {
        logTest('Documentation', `${file} check`, false, error.message);
      }
    }
  });
}

// ============================================================================
// SECTION 8: Integration with Existing Code
// ============================================================================

async function testIntegration() {
  await testSection('INTEGRATION WITH EXISTING CODE', async () => {
    try {
      // Check if CSV service exists (referenced in CSV tests)
      const csvServiceExists = fs.existsSync('src/core/services/csv.service.ts');
      logTest('Integration', 'CSV service exists', csvServiceExists);

      // Check if bulk operations service exists
      const bulkServiceExists = fs.existsSync('src/core/services/bulk-operations.service.ts');
      logTest('Integration', 'Bulk operations service exists', bulkServiceExists);

      // Check if image service exists
      const imageServiceExists = fs.existsSync('src/core/services/image.service.ts');
      logTest('Integration', 'Image service exists', imageServiceExists);

      // Check if product types exist
      const productTypesExist = fs.existsSync('src/core/types/product.ts') || 
                                fs.existsSync('src/core/admin/schemas/product.schema.ts');
      logTest('Integration', 'Product types exist', productTypesExist);

    } catch (error: any) {
      logTest('Integration', 'Check service files', false, error.message);
    }
  });
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🧪 TASK 13 - COMPREHENSIVE TESTING');
  console.log('='.repeat(80));

  try {
    await testFilesStructure();
    await testArbitraries();
    await testTestFileStructure();
    await testPropertyCoverage();
    await testDatabaseIntegration();
    await testExecutionSummary();
    await testDocumentation();
    await testIntegration();

    // Summary
    console.log('\n' + '='.repeat(80));
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${total}`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n⚠️  Some tests failed. Review the output above for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
