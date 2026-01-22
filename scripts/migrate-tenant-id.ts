/**
 * Script para migrar archivos a usar getTenantId() centralizado
 * 
 * Uso: npx tsx scripts/migrate-tenant-id.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const HARDCODED_PATTERN = /const TENANT_ID = process\.env\.TENANT_ID \|\| 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';/g;
const NEW_IMPORT = "import { getTenantId } from '@/src/core/config/tenant';";
const NEW_CONST = "const TENANT_ID = getTenantId();";

const filesToMigrate = [
  'src/app/api/admin/reports/route.ts',
  'src/app/api/admin/terminals/route.ts',
  'src/app/api/admin/analytics/top-products/route.ts',
  'src/app/api/admin/analytics/realtime/route.ts',
  'src/app/api/admin/promotions/route.ts',
  'src/app/api/admin/promotions/[id]/route.ts',
  'src/app/api/admin/analytics/hourly/route.ts',
  'src/app/api/admin/products/[id]/route.ts',
  // 'src/app/api/admin/products/route.ts', // Ya migrado manualmente
  'src/app/api/admin/analytics/history/route.ts',
  'src/app/api/admin/analytics/comparison/route.ts',
  'src/app/api/admin/employees/route.ts',
  'src/app/api/admin/employees/[id]/route.ts',
  'src/app/api/admin/delivery/metrics/route.ts',
  'src/app/api/admin/dashboard/stats/route.ts',
  'src/app/api/admin/delivery/history/route.ts',
  'src/app/api/admin/delivery/driver-metrics/route.ts',
  'src/app/api/admin/config/route.ts',
  'src/app/api/admin/audit/events/route.ts',
  'src/app/api/admin/audit/alerts/route.ts',
];

function migrateFile(filePath: string): boolean {
  try {
    const fullPath = join(process.cwd(), filePath);
    let content = readFileSync(fullPath, 'utf-8');
    
    // Check if already migrated
    if (content.includes('getTenantId()')) {
      console.log(`  ⏭️  Ya migrado: ${filePath}`);
      return false;
    }
    
    // Check if has hardcoded TENANT_ID
    if (!HARDCODED_PATTERN.test(content)) {
      console.log(`  ⚠️  No encontrado patrón: ${filePath}`);
      return false;
    }
    
    // Reset regex
    HARDCODED_PATTERN.lastIndex = 0;
    
    // Add import if not exists
    if (!content.includes(NEW_IMPORT)) {
      // Find last import line
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex >= 0) {
        lines.splice(lastImportIndex + 1, 0, NEW_IMPORT);
        content = lines.join('\n');
      }
    }
    
    // Replace hardcoded TENANT_ID
    content = content.replace(HARDCODED_PATTERN, NEW_CONST);
    
    // Write back
    writeFileSync(fullPath, content, 'utf-8');
    console.log(`  ✅ Migrado: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`  ❌ Error en ${filePath}:`, error);
    return false;
  }
}

function main() {
  console.log('🔄 Migrando archivos a getTenantId() centralizado...\n');
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of filesToMigrate) {
    const result = migrateFile(file);
    if (result) {
      migrated++;
    } else if (result === false) {
      skipped++;
    } else {
      errors++;
    }
  }
  
  console.log('\n📊 Resumen:');
  console.log(`  ✅ Migrados: ${migrated}`);
  console.log(`  ⏭️  Omitidos: ${skipped}`);
  console.log(`  ❌ Errores: ${errors}`);
  console.log(`  📁 Total: ${filesToMigrate.length}`);
  
  console.log('\n🎯 Próximos pasos:');
  console.log('  1. Verificar cambios: git diff');
  console.log('  2. Ejecutar build: npm run build');
  console.log('  3. Commitear cambios');
}

main();
