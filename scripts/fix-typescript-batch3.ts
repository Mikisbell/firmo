#!/usr/bin/env tsx
/**
 * Script de corrección masiva de errores TypeScript - Batch 3
 * Enfoque: Correcciones precisas y verificadas
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function fixFile(filePath: string, replacements: Array<{ from: string; to: string }>): boolean {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return false;
    
    let content = fs.readFileSync(fullPath, 'utf-8');
    let changed = false;
    
    for (const { from, to } of replacements) {
      const newContent = content.replace(new RegExp(from, 'g'), to);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    }
    
    if (changed) {
      fs.writeFileSync(fullPath, content, 'utf-8');
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error en ${filePath}:`, error);
    return false;
  }
}

function getErrorCount(): number {
  try {
    const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8' });
    const matches = output.match(/error TS\d+:/g);
    return matches ? matches.length : 0;
  } catch (error: any) {
    const matches = error.stdout?.match(/error TS\d+:/g);
    return matches ? matches.length : 0;
  }
}

async function main() {
  console.log('🚀 Corrección TypeScript - Batch 3\n');
  
  const initialErrors = getErrorCount();
  console.log(`📊 Errores iniciales: ${initialErrors}\n`);
  
  let fixedFiles = 0;
  
  // Fix 1: Employees API - Promise params (11 errores)
  console.log('🔧 Corrigiendo employees API...');
  if (fixFile('src/app/api/admin/employees/__tests__/employees-api.test.ts', [
    {
      from: 'Promise\\.resolve\\(\\{ params: \\{ id: ([^}]+) \\} \\}\\)',
      to: '{ params: Promise.resolve({ id: $1 }) }'
    }
  ])) {
    fixedFiles++;
    console.log('✅ Employees API corregido');
  }
  
  // Fix 2: Properties compatibility - any types
  console.log('🔧 Corrigiendo properties compatibility...');
  if (fixFile('src/core/__tests__/properties-compatibility.test.ts', [
    {
      from: 'const result: any = ',
      to: 'const result = '
    }
  ])) {
    fixedFiles++;
    console.log('✅ Properties compatibility corregido');
  }
  
  // Fix 3: Properties security - type guards
  console.log('🔧 Corrigiendo properties security...');
  const securityFile = 'src/core/__tests__/properties-security.test.ts';
  const securityPath = path.join(process.cwd(), securityFile);
  if (fs.existsSync(securityPath)) {
    let content = fs.readFileSync(securityPath, 'utf-8');
    
    // Agregar type guard antes de acceder a event.type
    content = content.replace(
      /if \(event\.type === 'BULK_UPDATE_PRODUCTS'\)/g,
      "if ('type' in event && event.type === 'BULK_UPDATE_PRODUCTS')"
    );
    
    // Agregar type guard antes de acceder a event.updates
    content = content.replace(
      /expect\(event\.updates\)/g,
      "expect('updates' in event ? event.updates : undefined)"
    );
    
    fs.writeFileSync(securityPath, content, 'utf-8');
    fixedFiles++;
    console.log('✅ Properties security corregido');
  }
  
  // Fix 4: Alert deduplication - Prisma filters
  console.log('🔧 Corrigiendo alert deduplication...');
  if (fixFile('src/core/alerts/__tests__/alert-deduplication.property.test.ts', [
    {
      from: 'startsWith:',
      to: 'contains:'
    },
    {
      from: 'threshold_unit: fc\\.string\\(\\)',
      to: "threshold_unit: fc.constantFrom('COUNT', 'PERCENTAGE', 'SECONDS') as any"
    },
    {
      from: 'comparison_operator: fc\\.string\\(\\)',
      to: "comparison_operator: fc.constantFrom('GT', 'LT', 'EQ', 'GTE', 'LTE') as any"
    }
  ])) {
    fixedFiles++;
    console.log('✅ Alert deduplication corregido');
  }
  
  // Fix 5: Auth audit logger - type assertions
  console.log('🔧 Corrigiendo auth audit logger...');
  if (fixFile('src/core/auth/__tests__/audit-logger.test.ts', [
    {
      from: 'const events: AuthEvent\\[\\] = ',
      to: 'const events = '
    }
  ])) {
    fixedFiles++;
    console.log('✅ Auth audit logger corregido');
  }
  
  // Fix 6: Cache service - constructor args
  console.log('🔧 Corrigiendo cache service...');
  if (fixFile('src/core/cache/__tests__/cache-flow.integration.test.ts', [
    {
      from: 'new CacheService\\(redisClient\\)',
      to: 'new CacheService()'
    }
  ])) {
    fixedFiles++;
    console.log('✅ Cache service corregido');
  }
  
  // Fix 7: Delivery tests - getRedisClient
  console.log('🔧 Corrigiendo delivery tests...');
  const deliveryFiles = [
    'src/core/delivery/__tests__/push.property.test.ts',
    'src/core/delivery/__tests__/push.unit.test.ts'
  ];
  
  for (const file of deliveryFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // Agregar import si no existe
      if (!content.includes('import { getRedisClient }')) {
        content = content.replace(
          /import \{ describe,/,
          "import { getRedisClient } from '@/lib/redis';\nimport { describe,"
        );
      }
      
      fs.writeFileSync(filePath, content, 'utf-8');
      fixedFiles++;
    }
  }
  console.log('✅ Delivery tests corregidos');
  
  // Fix 8: Whatsapp tests - afterEach
  console.log('🔧 Corrigiendo whatsapp tests...');
  if (fixFile('src/core/delivery/__tests__/whatsapp.unit.test.ts', [
    {
      from: "import \\{ describe, it, expect, beforeEach, vi \\} from 'vitest';",
      to: "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';"
    },
    {
      from: 'countCall\\.args',
      to: 'countCall?.args'
    }
  ])) {
    fixedFiles++;
    console.log('✅ Whatsapp tests corregido');
  }
  
  // Fix 9: SSE service - null to undefined
  console.log('🔧 Corrigiendo SSE service...');
  if (fixFile('src/core/delivery/__tests__/sse-service.property.test.ts', [
    {
      from: 'tenant_id: null',
      to: 'tenant_id: undefined'
    },
    {
      from: 'driver_id: null',
      to: 'driver_id: undefined'
    }
  ])) {
    fixedFiles++;
    console.log('✅ SSE service corregido');
  }
  
  // Fix 10: Delivery assignment - null to undefined
  console.log('🔧 Corrigiendo delivery assignment...');
  if (fixFile('src/core/delivery/__tests__/assignment.property.test.ts', [
    {
      from: ': null as string \\| undefined',
      to: ': undefined'
    }
  ])) {
    fixedFiles++;
    console.log('✅ Delivery assignment corregido');
  }
  
  console.log(`\n📈 Archivos corregidos: ${fixedFiles}`);
  
  console.log('\n🔍 Verificando errores...');
  const finalErrors = getErrorCount();
  const errorsFixed = initialErrors - finalErrors;
  
  console.log(`\n📊 Resultado:`);
  console.log(`   Inicial: ${initialErrors}`);
  console.log(`   Final: ${finalErrors}`);
  console.log(`   Corregidos: ${errorsFixed} (${((errorsFixed / initialErrors) * 100).toFixed(1)}%)`);
  
  if (finalErrors === 0) {
    console.log('\n🎉 ¡TODOS LOS ERRORES CORREGIDOS!');
  } else {
    console.log(`\n⚠️  Quedan ${finalErrors} errores`);
  }
}

main().catch(console.error);
