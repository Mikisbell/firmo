#!/usr/bin/env tsx
/**
 * Script para corregir errores de TypeScript - Batch 1
 * 
 * Corrige los errores más comunes:
 * - TS18046: 'variable' is of type 'unknown'
 * - TS2345: Argument type mismatch
 * - TS2339: Property does not exist
 * 
 * Fecha: 12 Febrero 2026
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Fix {
  file: string;
  description: string;
  apply: () => void;
}

const fixes: Fix[] = [];

// Fix 1: src/core/projection/__tests__/order.property.test.ts
// Problema: expectValidOrderLine no existe, debería ser expectValidOrder
fixes.push({
  file: 'src/core/projection/__tests__/order.property.test.ts',
  description: 'Fix import: expectValidOrderLine → expectValidOrder',
  apply: () => {
    const filePath = join(process.cwd(), 'src/core/projection/__tests__/order.property.test.ts');
    let content = readFileSync(filePath, 'utf-8');
    
    // Fix import
    content = content.replace(
      /expectValidOrderLine/g,
      'expectValidOrder'
    );
    
    writeFileSync(filePath, content, 'utf-8');
    console.log('✅ Fixed expectValidOrderLine import');
  }
});

// Fix 2: src/core/observability/__tests__/log-config.unit.test.ts
// Problema: log_configurationChange debería ser log_configuration_change (snake_case)
fixes.push({
  file: 'src/core/observability/__tests__/log-config.unit.test.ts',
  description: 'Fix Prisma model name: log_configurationChange → log_configuration_change',
  apply: () => {
    const filePath = join(process.cwd(), 'src/core/observability/__tests__/log-config.unit.test.ts');
    let content = readFileSync(filePath, 'utf-8');
    
    // Fix Prisma model name
    content = content.replace(
      /log_configurationChange/g,
      'log_configuration_change'
    );
    
    // Fix property names: updatedAt → updated_at
    content = content.replace(
      /updatedAt:/g,
      'updated_at:'
    );
    
    writeFileSync(filePath, content, 'utf-8');
    console.log('✅ Fixed Prisma model names and properties');
  }
});

// Fix 3: src/core/observability/__tests__/structured-logger.property.test.ts
// Problema: Cannot assign to 'NODE_ENV' because it is read-only
fixes.push({
  file: 'src/core/observability/__tests__/structured-logger.property.test.ts',
  description: 'Fix NODE_ENV assignment using Object.defineProperty',
  apply: () => {
    const filePath = join(process.cwd(), 'src/core/observability/__tests__/structured-logger.property.test.ts');
    let content = readFileSync(filePath, 'utf-8');
    
    // Replace direct assignment with Object.defineProperty
    content = content.replace(
      /process\.env\.NODE_ENV = ['"](\w+)['"]/g,
      "Object.defineProperty(process.env, 'NODE_ENV', { value: '$1', writable: true })"
    );
    
    writeFileSync(filePath, content, 'utf-8');
    console.log('✅ Fixed NODE_ENV assignment');
  }
});

// Fix 4: src/core/observability/__tests__/observability-flow.integration.test.ts
// Problema: Cannot assign to 'NODE_ENV' because it is read-only
fixes.push({
  file: 'src/core/observability/__tests__/observability-flow.integration.test.ts',
  description: 'Fix NODE_ENV assignment using Object.defineProperty',
  apply: () => {
    const filePath = join(process.cwd(), 'src/core/observability/__tests__/observability-flow.integration.test.ts');
    let content = readFileSync(filePath, 'utf-8');
    
    // Replace direct assignment with Object.defineProperty
    content = content.replace(
      /process\.env\.NODE_ENV = ['"](\w+)['"]/g,
      "Object.defineProperty(process.env, 'NODE_ENV', { value: '$1', writable: true })"
    );
    
    writeFileSync(filePath, content, 'utf-8');
    console.log('✅ Fixed NODE_ENV assignment');
  }
});

// Fix 5: src/core/middleware/__tests__/rate-limit.test.ts
// Problema: Block-scoped variable 'result' used before its declaration
fixes.push({
  file: 'src/core/middleware/__tests__/rate-limit.test.ts',
  description: 'Fix variable declaration order',
  apply: () => {
    const filePath = join(process.cwd(), 'src/core/middleware/__tests__/rate-limit.test.ts');
    let content = readFileSync(filePath, 'utf-8');
    
    // This requires manual inspection - just log for now
    console.log('⚠️  Manual fix required: Check variable declaration order in rate-limit.test.ts');
  }
});

// Ejecutar todos los fixes
console.log('🔧 Aplicando correcciones de TypeScript - Batch 1\n');

for (const fix of fixes) {
  console.log(`📝 ${fix.file}`);
  console.log(`   ${fix.description}`);
  try {
    fix.apply();
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
  console.log('');
}

console.log('✅ Batch 1 completado');
console.log('\n📊 Ejecuta `npx tsc --noEmit` para verificar los errores restantes');
