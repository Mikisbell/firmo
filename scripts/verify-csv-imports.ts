/**
 * Verify CSV Import Results in Database
 */

import prisma from '../src/core/db/prisma';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function verifyCSVImports() {
  console.log('\n🔍 CSV IMPORT VERIFICATION\n');
  console.log('='.repeat(60));
  
  // Get all CSV-imported products
  const csvProducts = await prisma.products.findMany({
    where: {
      tenant_id: TENANT_ID,
      sku: {
        startsWith: 'CSV-',
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 20,
  });
  
  console.log(`\n📦 Found ${csvProducts.length} CSV-imported products\n`);
  
  if (csvProducts.length > 0) {
    console.log('Recent CSV Imports:');
    console.log('-'.repeat(60));
    
    csvProducts.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.name}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Price: S/ ${(product.price_cents / 100).toFixed(2)} (${product.price_cents} centavos)`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Station: ${product.station}`);
      console.log(`   Type: ${product.type}`);
      console.log(`   Active: ${product.is_active ? 'Yes' : 'No'}`);
      console.log(`   Version: ${product.version}`);
      console.log(`   Created: ${product.created_at.toISOString()}`);
      console.log(`   Updated: ${product.updated_at.toISOString()}`);
    });
  }
  
  // Check for updated products
  const updatedProducts = await prisma.products.findMany({
    where: {
      tenant_id: TENANT_ID,
      sku: {
        contains: 'CSV-UPDATE',
      },
    },
  });
  
  if (updatedProducts.length > 0) {
    console.log('\n\n📝 Updated Products via CSV:');
    console.log('-'.repeat(60));
    
    updatedProducts.forEach((product) => {
      console.log(`\n- ${product.name}`);
      console.log(`  SKU: ${product.sku}`);
      console.log(`  Version: ${product.version} (updated ${product.version - 1} times)`);
      console.log(`  Last Updated: ${product.updated_at.toISOString()}`);
    });
  }
  
  // Check audit logs
  const auditLogs = await prisma.admin_access_logs.findMany({
    where: {
      tenant_id: TENANT_ID,
      action: 'CSV_IMPORT',
    },
    orderBy: {
      created_at: 'desc',
    },
    take: 10,
  });
  
  console.log('\n\n📋 CSV Import Audit Logs:');
  console.log('-'.repeat(60));
  console.log(`Found ${auditLogs.length} import operations\n`);
  
  auditLogs.forEach((log, index) => {
    console.log(`${index + 1}. Import at ${log.created_at.toISOString()}`);
    console.log(`   Employee: ${log.employee_id}`);
    console.log(`   Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
  });
  
  // Check catalog version
  const catalogMeta = await prisma.catalog_meta.findUnique({
    where: { tenant_id: TENANT_ID },
  });
  
  console.log('\n\n📚 Catalog Version:');
  console.log('-'.repeat(60));
  if (catalogMeta) {
    console.log(`Version: ${catalogMeta.catalog_version}`);
    console.log(`Last Updated: ${catalogMeta.updated_at.toISOString()}`);
  } else {
    console.log('No catalog metadata found');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ VERIFICATION COMPLETE\n');
  
  await prisma.$disconnect();
}

verifyCSVImports().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
