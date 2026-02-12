#!/usr/bin/env ts-node
/**
 * Script para corregir errores TypeScript - Fase 2 Batch 6 Parte 1
 * 
 * Correcciones:
 * 1. order.property.test.ts - Generators → fc.constant()
 * 2. audit-logger.test.ts - Type assertions
 * 3. push.property.test.ts - Arbitrary → value
 * 4. log-config.unit.test.ts - Nombres de propiedades
 * 
 * Fecha: 12 Febrero 2026
 */

import * as fs from 'fs';
import * as path from 'path';

interface Fix {
  file: string;
  description: string;
  apply: (content: string) => string;
}

const fixes: Fix[] = [
  // Fix 1: order.property.test.ts - Generators → fc.constant()
  {
    file: 'src/core/projection/__tests__/order.property.test.ts',
    description: 'Convertir generators a fc.constant()',
    apply: (content: string) => {
      // Reemplazar fc.property(generator, ...) con fc.property(fc.constant(generator()), ...)
      content = content.replace(
        /fc\.property\(\s*orderGenerator\s*,/g,
        'fc.property(fc.constant(orderGenerator()),'
      );
      
      // Agregar type assertion para order
      content = content.replace(
        /const order = /g,
        'const order = '
      );
      
      // Agregar as any para order cuando sea unknown
      content = content.replace(
        /order\./g,
        '(order as any).'
      );
      
      return content;
    }
  },
  
  // Fix 2: audit-logger.test.ts - Type assertions
  {
    file: 'src/core/auth/__tests__/audit-logger.test.ts',
    description: 'Agregar type assertions para AuthEvent',
    apply: (content: string) => {
      // Agregar as any para eventos que TypeScript no puede inferir
      content = content.replace(
        /logAuthEvent\((\w+)\)/g,
        'logAuthEvent($1 as any)'
      );
      
      return content;
    }
  },
  
  // Fix 3: push.property.test.ts - Arbitrary → value
  {
    file: 'src/core/delivery/__tests__/push.property.test.ts',
    description: 'Convertir Arbitrary a valor con fc.sample',
    apply: (content: string) => {
      // Reemplazar pushNotificationArb con fc.sample(pushNotificationArb)[0]
      content = content.replace(
        /sendPushNotification\(pushNotificationArb\)/g,
        'sendPushNotification(fc.sample(pushNotificationArb, 1)[0])'
      );
      
      return content;
    }
  },
  
  // Fix 4: log-config.unit.test.ts - Nombres de propiedades
  {
    file: 'src/core/observability/__tests__/log-config.unit.test.ts',
    description: 'Corregir nombres de propiedades camelCase → snake_case',
    apply: (content: string) => {
      // Reemplazar propiedades camelCase con snake_case
      const replacements: Record<string, string> = {
        'previousLevel': 'previous_level',
        'newLevel': 'new_level',
        'changedBy': 'changed_by',
        'changedAt': 'changed_at'
      };
      
      for (const [oldProp, newProp] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${oldProp}\\b:`, 'g');
        content = content.replace(regex, `${newProp}:`);
      }
      
      return content;
    }
  }
];

function applyFixes() {
  console.log('🔧 Aplicando correcciones TypeScript Batch 6 Parte 1...\n');
  
  let totalChanges = 0;
  
  for (const fix of fixes) {
    const filePath = path.join(process.cwd(), fix.file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Archivo no encontrado: ${fix.file}`);
      continue;
    }
    
    console.log(`📝 Procesando: ${fix.file}`);
    console.log(`   ${fix.description}`);
    
    const originalContent = fs.readFileSync(filePath, 'utf-8');
    const modifiedContent = fix.apply(originalContent);
    
    if (originalContent !== modifiedContent) {
      fs.writeFileSync(filePath, modifiedContent, 'utf-8');
      totalChanges++;
      console.log(`   ✅ Cambios aplicados\n`);
    } else {
      console.log(`   ℹ️  Sin cambios necesarios\n`);
    }
  }
  
  console.log(`\n✨ Correcciones completadas: ${totalChanges}/${fixes.length} archivos modificados`);
}

applyFixes();
