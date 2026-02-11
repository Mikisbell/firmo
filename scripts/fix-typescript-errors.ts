/**
 * Script para corregir errores TypeScript de forma masiva
 * Ejecutar con: npx tsx scripts/fix-typescript-errors.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Correcciones a aplicar
const fixes = [
  // Fix 1: Promise.resolve para params en tests de API
  {
    pattern: /await (PUT|DELETE|GET_BY_ID)\(request, \{ params: \{ (id|terminalId): (\w+) \} \}\)/g,
    replacement: 'await $1(request, Promise.resolve({ params: { $2: $3 } }))',
    files: ['src/app/api/**/__tests__/*.test.ts']
  },
  
  // Fix 2: Agregar type assertion para arrays vacíos
  {
    pattern: /const responses = \[\];/g,
    replacement: 'const responses: any[] = [];',
    files: ['e2e/**/*.spec.ts']
  },
  
  // Fix 3: Agregar type assertion para objetos vacíos
  {
    pattern: /const empty(Histograms|Counters|Metrics) = \{\};/g,
    replacement: 'const empty$1: any = {};',
    files: ['src/**/__tests__/*.test.tsx']
  }
];

async function main() {
  console.log('🔧 Iniciando corrección masiva de errores TypeScript...\n');
  
  let totalFixed = 0;
  
  for (const fix of fixes) {
    console.log(`📝 Aplicando corrección: ${fix.pattern}`);
    
    for (const pattern of fix.files) {
      const files = await glob(pattern);
      
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const newContent = content.replace(fix.pattern, fix.replacement);
          
          if (content !== newContent) {
            writeFileSync(file, newContent, 'utf-8');
            totalFixed++;
            console.log(`  ✅ ${file}`);
          }
        } catch (error) {
          console.error(`  ❌ Error en ${file}:`, error);
        }
      }
    }
  }
  
  console.log(`\n✨ Correcciones completadas: ${totalFixed} archivos modificados`);
}

main().catch(console.error);
