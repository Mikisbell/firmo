#!/usr/bin/env tsx
/**
 * Script to migrate remaining hardcoded tenant IDs to centralized getTenantId()
 * This handles files that were missed in the first migration
 */

import * as fs from 'fs';
import * as path from 'path';

const filesToMigrate = [
  'src/app/api/drivers/route.ts',
  'src/app/api/drivers/available/route.ts',
  'src/app/api/delivery/route.ts',
  'src/app/api/auth/terminals/route.ts',
];

const oldPattern = /const TENANT_ID = process\.env\.TENANT_ID \|\| '[0-9a-f-]+';/;
const newImport = "import { getTenantId } from '@/src/core/config/tenant';";
const newConstant = "const TENANT_ID = getTenantId();";

let migrated = 0;
let skipped = 0;
let errors = 0;

for (const file of filesToMigrate) {
  try {
    const filePath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️  Skipped: ${file} (file not found)`);
      skipped++;
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if already migrated
    if (content.includes("getTenantId()")) {
      console.log(`⏭️  Skipped: ${file} (already migrated)`);
      skipped++;
      continue;
    }

    // Check if has old pattern
    if (!oldPattern.test(content)) {
      console.log(`⏭️  Skipped: ${file} (no old pattern found)`);
      skipped++;
      continue;
    }

    // Add import after other imports
    const importRegex = /(import .+ from .+;\n)(\n)/;
    if (!content.includes(newImport)) {
      content = content.replace(importRegex, `$1${newImport}\n$2`);
    }

    // Replace constant
    content = content.replace(oldPattern, newConstant);

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Migrated: ${file}`);
    migrated++;
  } catch (error) {
    console.error(`❌ Error migrating ${file}:`, error);
    errors++;
  }
}

console.log('\n📊 Migration Summary:');
console.log(`✅ Migrados: ${migrated} archivos`);
console.log(`⏭️  Omitidos: ${skipped}`);
console.log(`❌ Errores: ${errors}`);
console.log(`📁 Total: ${filesToMigrate.length}`);
