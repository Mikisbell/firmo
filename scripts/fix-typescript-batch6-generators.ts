#!/usr/bin/env ts-node
/**
 * Script para corregir errores TypeScript - Fase 2 Batch 6
 * Conversión masiva de generators a fc.constant()
 * 
 * Fecha: 12 Febrero 2026
 */

import * as fs from 'fs';
import * as path from 'path';

const files = [
  'src/core/validation/__tests__/payment.property.test.ts',
  'src/core/projection/__tests__/shift.property.test.ts',
  'src/core/validation/__tests__/business-rules.property.test.ts',
];

function convertGeneratorsToArbitraries(content: string): string {
  // Patrón 1: testInvariant(generateRealisticOrder, (order) => ...)
  content = content.replace(
    /testInvariant\(\s*generateRealisticOrder\s*,\s*\(order\)\s*=>/g,
    'testInvariant(fc.constant(generateRealisticOrder()), (order: any) =>'
  );
  
  // Patrón 2: testInvariant(generateRealisticShift, (shift) => ...)
  content = content.replace(
    /testInvariant\(\s*generateRealisticShift\s*,\s*\(shift\)\s*=>/g,
    'testInvariant(fc.constant(generateRealisticShift()), (shift: any) =>'
  );
  
  // Patrón 3: fc.property(generateRealisticOrder, (order) => ...)
  content = content.replace(
    /fc\.property\(\s*generateRealisticOrder\s*,\s*\(order\)\s*=>/g,
    'fc.property(fc.constant(generateRealisticOrder()), (order: any) =>'
  );
  
  // Patrón 4: fc.property(generateRealisticShift, (shift) => ...)
  content = content.replace(
    /fc\.property\(\s*generateRealisticShift\s*,\s*\(shift\)\s*=>/g,
    'fc.property(fc.constant(generateRealisticShift()), (shift: any) =>'
  );
  
  // Patrón 5: fc.asyncProperty(generateRealisticOrder, async (order) => ...)
  content = content.replace(
    /fc\.asyncProperty\(\s*generateRealisticOrder\s*,\s*async\s*\(order\)\s*=>/g,
    'fc.asyncProperty(fc.constant(generateRealisticOrder()), async (order: any) =>'
  );
  
  // Patrón 6: fc.asyncProperty(generateRealisticShift, async (shift) => ...)
  content = content.replace(
    /fc\.asyncProperty\(\s*generateRealisticShift\s*,\s*async\s*\(shift\)\s*=>/g,
    'fc.asyncProperty(fc.constant(generateRealisticShift()), async (shift: any) =>'
  );
  
  return content;
}

function applyFixes() {
  console.log('🔧 Convirtiendo generators a fc.constant() en múltiples archivos...\n');
  
  let totalChanges = 0;
  
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Archivo no encontrado: ${file}`);
      continue;
    }
    
    console.log(`📝 Procesando: ${file}`);
    
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const modifiedContent = convertGeneratorsToArbitraries(originalContent);
    
    if (originalContent !== modifiedContent) {
      fs.writeFileSync(filePath, modifiedContent, 'utf-8');
      totalChanges++;
      console.log(`   ✅ Cambios aplicados\n`);
    } else {
      console.log(`   ℹ️  Sin cambios necesarios\n`);
    }
  }
  
  console.log(`\n✨ Correcciones completadas: ${totalChanges}/${files.length} archivos modificados`);
}

applyFixes();
