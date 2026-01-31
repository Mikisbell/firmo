/**
 * Verify Task 10 Database State
 * Comprehensive database verification for CSV service
 */

import prisma from '../src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function verifyDatabase() {
  console.log('\n🔍 TASK 10: DATABASE VERIFICATION\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Product counts
    console.log('\n1. Product Counts:');
    console.log('-'.repeat(60));
    
    const totalProducts = await prisma.products.count({
      where: { tenant_id: TENANT_ID },
    });
    
    const activeProducts = await prisma.products.count({
      where: { tenant_id: TENANT_ID, is_active: true },
    });
    
    const inactiveProducts = await prisma.products.count({
      where: { tenant_id: TENANT_ID, is_active: false },
    });
    
    console.log(`   Total products: ${totalProducts}`);
    console.log(`   Active products: ${activeProducts}`);
    console.log(`   Inactive products: ${inactiveProducts}`);
    
    if (totalProducts > 0) {
      console.log('   ✅ Products table has data');
    } else {
      console.log('   ❌ Products table is empty');
    }
    
    // 2. Category distribution
    console.log('\n2. Category Distribution:');
    console.log('-'.repeat(60));
    
    const categories = await prisma.products.groupBy({
      by: ['category'],
      where: { tenant_id: TENANT_ID, is_active: true },
      _count: true,
    });
    
    categories.forEach(cat => {
      console.log(`   ${cat.category}: ${cat._count} products`);
    });
    
    // 3. Station distribution
    console.log('\n3. Station Distribution:');
    console.log('-'.repeat(60));
    
    const stations = await prisma.products.groupBy({
      by: ['station'],
      where: { tenant_id: TENANT_ID, is_active: true },
      _count: true,
    });
    
    stations.forEach(st => {
      console.log(`   ${st.station}: ${st._count} products`);
    });
    
    // 4. CSV import audit logs
    console.log('\n4. CSV Import Audit Logs:');
    console.log('-'.repeat(60));
    
    const csvImports = await prisma.admin_access_logs.count({
      where: {
        tenant_id: TENANT_ID,
        action: 'CSV_IMPORT',
      },
    });
    
    console.log(`   Total CSV imports: ${csvImports}`);
    
    if (csvImports > 0) {
      const recentImports = await prisma.admin_access_logs.findMany({
        where: {
          tenant_id: TENANT_ID,
          action: 'CSV_IMPORT',
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      });
      
      console.log('\n   Recent imports:');
      recentImports.forEach((log, index) => {
        const metadata = log.metadata as any;
        console.log(`   ${index + 1}. ${log.created_at.toISOString()}`);
        console.log(`      Created: ${metadata.created_count || 0}`);
        console.log(`      Updated: ${metadata.updated_count || 0}`);
        console.log(`      Skipped: ${metadata.skipped_count || 0}`);
        console.log(`      Errors: ${metadata.error_count || 0}`);
      });
      
      console.log('   ✅ CSV imports are being logged');
    } else {
      console.log('   ⚠️  No CSV imports found in audit log');
    }
    
    // 5. Catalog version
    console.log('\n5. Catalog Version:');
    console.log('-'.repeat(60));
    
    const catalogMeta = await prisma.catalog_meta.findUnique({
      where: { tenant_id: TENANT_ID },
    });
    
    if (catalogMeta) {
      console.log(`   Current version: ${catalogMeta.catalog_version}`);
      console.log(`   Last updated: ${catalogMeta.updated_at.toISOString()}`);
      console.log('   ✅ Catalog versioning is working');
    } else {
      console.log('   ⚠️  No catalog metadata found');
    }
    
    // 6. Price validation (all prices should be positive integers)
    console.log('\n6. Price Validation:');
    console.log('-'.repeat(60));
    
    const invalidPrices = await prisma.products.count({
      where: {
        tenant_id: TENANT_ID,
        price_cents: { lt: 0 },
      },
    });
    
    if (invalidPrices === 0) {
      console.log('   ✅ All prices are valid (positive integers)');
    } else {
      console.log(`   ❌ Found ${invalidPrices} products with invalid prices`);
    }
    
    // 7. Required fields validation
    console.log('\n7. Required Fields Validation:');
    console.log('-'.repeat(60));
    
    // Check for empty SKUs
    const emptySKUs = await prisma.products.count({
      where: {
        tenant_id: TENANT_ID,
        sku: '',
      },
    });
    
    // Check for empty names
    const emptyNames = await prisma.products.count({
      where: {
        tenant_id: TENANT_ID,
        name: '',
      },
    });
    
    const missingFields = emptySKUs + emptyNames;
    
    if (missingFields === 0) {
      console.log('   ✅ All products have required fields');
    } else {
      console.log(`   ❌ Found ${missingFields} products with missing fields`);
      console.log(`      Empty SKUs: ${emptySKUs}`);
      console.log(`      Empty names: ${emptyNames}`);
    }
    
    // 8. Sample products
    console.log('\n8. Sample Products:');
    console.log('-'.repeat(60));
    
    const sampleProducts = await prisma.products.findMany({
      where: { tenant_id: TENANT_ID },
      take: 3,
      orderBy: { created_at: 'desc' },
    });
    
    sampleProducts.forEach((product, index) => {
      console.log(`\n   ${index + 1}. ${product.name}`);
      console.log(`      SKU: ${product.sku}`);
      console.log(`      Price: ${product.price_cents} centavos`);
      console.log(`      Category: ${product.category}`);
      console.log(`      Station: ${product.station}`);
      console.log(`      Type: ${product.type}`);
      console.log(`      Active: ${product.is_active ? 'Yes' : 'No'}`);
      console.log(`      Version: ${product.version}`);
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ DATABASE VERIFICATION COMPLETE\n');
    
    const allChecks = [
      totalProducts > 0,
      invalidPrices === 0,
      missingFields === 0,
      csvImports > 0,
      catalogMeta !== null,
    ];
    
    const passedChecks = allChecks.filter(Boolean).length;
    const totalChecks = allChecks.length;
    
    console.log(`Passed: ${passedChecks}/${totalChecks} checks`);
    
    if (passedChecks === totalChecks) {
      console.log('Status: ✅ ALL CHECKS PASSED\n');
    } else {
      console.log('Status: ⚠️  SOME CHECKS FAILED\n');
    }
    
  } catch (error) {
    console.error('\n❌ Database verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
