#!/usr/bin/env node
/**
 * Migrate Remaining Files to Centralized getTenantId()
 * 
 * This script migrates the remaining 6 API route files that still use
 * hardcoded tenant ID to use the centralized getTenantId() function.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const files = [
  'src/app/api/admin/terminals-v2/route.ts',
  'src/app/api/admin/terminals-v2/[terminalId]/route.ts',
  'src/app/api/admin/terminals-v2/[terminalId]/status/route.ts',
  'src/app/api/admin/tables/[id]/route.ts',
  'src/app/api/admin/terminals/activate/route.ts',
  'src/app/api/inventory/verify-pin/route.ts',
];

interface MigrationResult {
  file: string;
  status: 'migrated' | 'skipped' | 'error';
  reason?: string;
}

const results: MigrationResult[] = [];

console.log('🔄 Migrating remaining files to getTenantId()...\n');

files.forEach(file => {
  try {
    const filePath = resolve(process.cwd(), file);
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    // Check if already using getTenantId
    if (content.includes('getTenantId()')) {
      results.push({ file, status: 'skipped', reason: 'Already using getTenantId()' });
      return;
    }

    // Add import if not present
    if (!content.includes('getTenantId')) {
      // Find the last import statement
      const importRegex = /(import[^;]+;)\n/g;
      const imports = content.match(importRegex);
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const importLine = "import { getTenantId } from '@/src/core/config/tenant';\n";
        content = content.replace(lastImport, lastImport + importLine);
        modified = true;
      }
    }

    // Replace hardcoded tenant ID patterns
    const patterns = [
      // Pattern 1: process.env.TENANT_ID || 'uuid'
      {
        regex: /const tenantId = process\.env\.TENANT_ID \|\| ['"][^'"]+['"]/g,
        replacement: 'const tenantId = getTenantId()'
      },
      // Pattern 2: process.env.DEFAULT_TENANT_ID || 'uuid'
      {
        regex: /const TENANT_ID = process\.env\.DEFAULT_TENANT_ID \|\| ['"][^'"]+['"]/g,
        replacement: 'const TENANT_ID = getTenantId()'
      },
      // Pattern 3: process.env.TENANT_ID || 'default'
      {
        regex: /const tenantId = process\.env\.TENANT_ID \|\| ['"]default['"]/g,
        replacement: 'const tenantId = getTenantId()'
      },
    ];

    patterns.forEach(({ regex, replacement }) => {
      if (regex.test(content)) {
        content = content.replace(regex, replacement);
        modified = true;
      }
    });

    // Special case for location ID in tables API
    if (file.includes('tables/[id]')) {
      if (content.includes("process.env.LOCATION_ID || 'default'")) {
        // Add location import if not present
        if (!content.includes('getLocationId')) {
          const importLine = "import { getLocationId } from '@/src/core/config/location';\n";
          const getTenantImport = content.indexOf("import { getTenantId }");
          if (getTenantImport !== -1) {
            const lineEnd = content.indexOf('\n', getTenantImport);
            content = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
          }
        }
        // Replace location ID
        content = content.replace(
          /const locationId = process\.env\.LOCATION_ID \|\| ['"]default['"]/g,
          'const locationId = getLocationId()'
        );
        modified = true;
      }
    }

    if (modified) {
      writeFileSync(filePath, content);
      results.push({ file, status: 'migrated' });
      console.log(`✅ Migrated: ${file}`);
    } else {
      results.push({ file, status: 'skipped', reason: 'No changes needed' });
      console.log(`⏭️  Skipped: ${file} (no changes needed)`);
    }
  } catch (error) {
    results.push({ 
      file, 
      status: 'error', 
      reason: error instanceof Error ? error.message : 'Unknown error' 
    });
    console.error(`❌ Error: ${file} - ${error}`);
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Migration Summary:');
console.log('='.repeat(60));

const migrated = results.filter(r => r.status === 'migrated').length;
const skipped = results.filter(r => r.status === 'skipped').length;
const errors = results.filter(r => r.status === 'error').length;

console.log(`✅ Migrated: ${migrated} files`);
console.log(`⏭️  Skipped: ${skipped} files`);
console.log(`❌ Errors: ${errors} files`);
console.log(`📁 Total: ${results.length} files`);

if (errors > 0) {
  console.log('\n❌ Errors encountered:');
  results.filter(r => r.status === 'error').forEach(r => {
    console.log(`  - ${r.file}: ${r.reason}`);
  });
  process.exit(1);
}

console.log('\n✅ Migration completed successfully!');
console.log('\n📝 Next steps:');
console.log('1. Run: npm run build');
console.log('2. Verify no TypeScript errors');
console.log('3. Test affected endpoints');
console.log('4. Commit changes\n');
