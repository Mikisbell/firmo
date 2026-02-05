#!/usr/bin/env npx tsx

/**
 * Test with Fresh Connection
 * 
 * Este script limpia el cache de Prisma y ejecuta las pruebas con una conexión fresca
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('\n🔄 Preparing fresh connection...\n');

// Paso 1: Limpiar cache de Prisma
console.log('1️⃣  Clearing Prisma cache...\n');

try {
  const prismaDir = path.join(process.cwd(), 'node_modules', '.prisma');
  if (fs.existsSync(prismaDir)) {
    fs.rmSync(prismaDir, { recursive: true, force: true });
    console.log('✅ Prisma cache cleared\n');
  }
} catch (error) {
  console.log('⚠️  Could not clear Prisma cache (not critical)\n');
}

// Paso 2: Regenerar Prisma Client
console.log('2️⃣  Regenerating Prisma Client...\n');

try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('\n✅ Prisma Client regenerated\n');
} catch (error) {
  console.log('❌ Error regenerating Prisma Client\n');
  process.exit(1);
}

// Paso 3: Ejecutar pruebas
console.log('3️⃣  Running integration tests...\n');

try {
  execSync('npx tsx scripts/test-multi-tenant-integration.ts', { stdio: 'inherit' });
} catch (error) {
  console.log('\n❌ Tests failed\n');
  process.exit(1);
}
