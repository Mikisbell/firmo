#!/usr/bin/env tsx
/**
 * Script para corregir propiedades duplicadas en whatsapp.unit.test.ts
 */

import { readFileSync, writeFileSync } from 'fs';

console.log('🔧 Corrigiendo propiedades duplicadas en whatsapp.unit.test.ts...\n');

let content = readFileSync('src/core/delivery/__tests__/whatsapp.unit.test.ts', 'utf-8');

// Remover líneas duplicadas de customer_phone: 'Juan Pérez'
content = content.replace(
  /customer_phone: 'Juan Pérez',\s*\n\s*customer_phone: mockPhoneNumber,/g,
  'customer_phone: mockPhoneNumber,'
);

writeFileSync('src/core/delivery/__tests__/whatsapp.unit.test.ts', content);

console.log('✅ Propiedades duplicadas corregidas!\n');
