/**
 * Script para corregir los 14 errores TypeScript finales
 * Corrección de sintaxis en type assertions
 */

const fs = require('fs');

console.log('🔧 Corrigiendo 14 errores TypeScript finales...\n');

// ============================================
// 1. order.service.test.ts - 10 errores de sintaxis
// ============================================
console.log('📝 src/core/services/__tests__/order.service.test.ts');
console.log('   Corrigiendo sintaxis de mockResolvedValue');

let orderServiceContent = fs.readFileSync('src/core/services/__tests__/order.service.test.ts', 'utf-8');

// Revertir el cambio incorrecto y aplicar la corrección correcta
orderServiceContent = orderServiceContent.replace(
  /\.\(mockResolvedValue as any\)\(/g,
  '.mockResolvedValue('
);

// Ahora agregar el cast correcto al mock completo
orderServiceContent = orderServiceContent.replace(
  /prisma\.\$queryRaw\.mockResolvedValue/g,
  '(prisma.$queryRaw as any).mockResolvedValue'
);

fs.writeFileSync('src/core/services/__tests__/order.service.test.ts', orderServiceContent, 'utf-8');
console.log('   ✅ Aplicado\n');

// ============================================
// 2. deduplication.property.test.ts - 2 errores
// ============================================
console.log('📝 src/core/sync/__tests__/deduplication.property.test.ts');
console.log('   Corrigiendo sintaxis de type assertions');

let dedupContent = fs.readFileSync('src/core/sync/__tests__/deduplication.property.test.ts', 'utf-8');
const dedupLines = dedupContent.split('\n');

// Línea 165 - Remover el 'as any' mal colocado y agregar correctamente
if (dedupLines[164]) {
  // Remover cualquier 'as any' existente al final
  dedupLines[164] = dedupLines[164].replace(/\s*as any\s*$/, '');
  
  // Si la línea tiene un cierre de paréntesis o corchete, agregar el cast antes
  if (dedupLines[164].includes(')') || dedupLines[164].includes(']')) {
    dedupLines[164] = dedupLines[164].replace(/(\)|\])(\s*;?\s*)$/, '$1 as any$2');
  }
}

// Línea 344 - Similar corrección
if (dedupLines[343]) {
  dedupLines[343] = dedupLines[343].replace(/\s*as any\s*$/, '');
  
  if (dedupLines[343].includes(')') || dedupLines[343].includes(']')) {
    dedupLines[343] = dedupLines[343].replace(/(\)|\])(\s*;?\s*)$/, '$1 as any$2');
  }
}

dedupContent = dedupLines.join('\n');
fs.writeFileSync('src/core/sync/__tests__/deduplication.property.test.ts', dedupContent, 'utf-8');
console.log('   ✅ Aplicado\n');

// ============================================
// 3. event-ordering.property.test.ts - 2 errores
// ============================================
console.log('📝 src/core/sync/__tests__/event-ordering.property.test.ts');
console.log('   Corrigiendo sintaxis de type assertions');

let eventOrderContent = fs.readFileSync('src/core/sync/__tests__/event-ordering.property.test.ts', 'utf-8');
const eventOrderLines = eventOrderContent.split('\n');

// Línea 43 - Remover el 'as any' mal colocado
if (eventOrderLines[42]) {
  eventOrderLines[42] = eventOrderLines[42].replace(/\s*as any\s*$/, '');
  
  if (eventOrderLines[42].includes(')') || eventOrderLines[42].includes(']')) {
    eventOrderLines[42] = eventOrderLines[42].replace(/(\)|\])(\s*;?\s*)$/, '$1 as any$2');
  }
}

// Línea 45 - Similar corrección
if (eventOrderLines[44]) {
  eventOrderLines[44] = eventOrderLines[44].replace(/\s*as any\s*$/, '');
  
  if (eventOrderLines[44].includes(')') || eventOrderLines[44].includes(']')) {
    eventOrderLines[44] = eventOrderLines[44].replace(/(\)|\])(\s*;?\s*)$/, '$1 as any$2');
  }
}

eventOrderContent = eventOrderLines.join('\n');
fs.writeFileSync('src/core/sync/__tests__/event-ordering.property.test.ts', eventOrderContent, 'utf-8');
console.log('   ✅ Aplicado\n');

console.log('✨ Correcciones completadas!');
console.log('🎯 Ejecuta "npx tsc --noEmit" para verificar');
