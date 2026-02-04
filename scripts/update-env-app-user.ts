#!/usr/bin/env node

/**
 * Script para actualizar DATABASE_URL y DIRECT_URL con credenciales de app_user
 * 
 * Uso:
 *   npx ts-node scripts/update-env-app-user.ts <password> [host]
 * 
 * Ejemplo:
 *   npx ts-node scripts/update-env-app-user.ts "MySecurePassword123!@#"
 *   npx ts-node scripts/update-env-app-user.ts "MySecurePassword123!@#" "aws-1-sa-east-1.pooler.supabase.com"
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Falta la contraseña de app_user');
  console.error('');
  console.error('Uso:');
  console.error('  npx ts-node scripts/update-env-app-user.ts <password> [host]');
  console.error('');
  console.error('Ejemplo:');
  console.error('  npx ts-node scripts/update-env-app-user.ts "MySecurePassword123!@#"');
  console.error('  npx ts-node scripts/update-env-app-user.ts "MySecurePassword123!@#" "aws-1-sa-east-1.pooler.supabase.com"');
  process.exit(1);
}

const password = args[0];
const host = args[1] || 'aws-1-sa-east-1.pooler.supabase.com';

// Validar que la contraseña no esté vacía
if (!password || password.trim() === '') {
  console.error('❌ Error: La contraseña no puede estar vacía');
  process.exit(1);
}

// Construir nuevas URLs
const databaseUrl = `postgresql://app_user:${encodeURIComponent(password)}@${host}:6543/postgres?pgbouncer=true&connection_limit=20`;
const directUrl = `postgresql://app_user:${encodeURIComponent(password)}@${host}:5432/postgres?connection_limit=1`;

console.log('🔄 Actualizando variables de entorno...\n');

// Función para actualizar archivo .env
function updateEnvFile(filePath: string, fileName: string) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${fileName} no existe, creando...`);
      fs.writeFileSync(filePath, '');
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Reemplazar DATABASE_URL
    const databaseUrlRegex = /DATABASE_URL="[^"]*"/;
    if (databaseUrlRegex.test(content)) {
      content = content.replace(databaseUrlRegex, `DATABASE_URL="${databaseUrl}"`);
      console.log(`✅ DATABASE_URL actualizado en ${fileName}`);
    } else {
      content += `\nDATABASE_URL="${databaseUrl}"`;
      console.log(`✅ DATABASE_URL agregado a ${fileName}`);
    }

    // Reemplazar DIRECT_URL
    const directUrlRegex = /DIRECT_URL="[^"]*"/;
    if (directUrlRegex.test(content)) {
      content = content.replace(directUrlRegex, `DIRECT_URL="${directUrl}"`);
      console.log(`✅ DIRECT_URL actualizado en ${fileName}`);
    } else {
      content += `\nDIRECT_URL="${directUrl}"`;
      console.log(`✅ DIRECT_URL agregado a ${fileName}`);
    }

    fs.writeFileSync(filePath, content);
    console.log(`✅ ${fileName} guardado\n`);
  } catch (error) {
    console.error(`❌ Error actualizando ${fileName}:`, error);
    process.exit(1);
  }
}

// Actualizar .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
updateEnvFile(envLocalPath, '.env.local');

// Actualizar .env
const envPath = path.join(process.cwd(), '.env');
updateEnvFile(envPath, '.env');

console.log('═'.repeat(60));
console.log('\n📊 Resumen de cambios:\n');
console.log(`Usuario: app_user`);
console.log(`Host: ${host}`);
console.log(`Contraseña: ${'*'.repeat(password.length)}`);
console.log(`\nDATABASE_URL: postgresql://app_user:***@${host}:6543/postgres?pgbouncer=true&connection_limit=20`);
console.log(`DIRECT_URL: postgresql://app_user:***@${host}:5432/postgres?connection_limit=1`);

console.log('\n═'.repeat(60));
console.log('\n🚀 Próximos pasos:\n');
console.log('1. Verificar conexión:');
console.log('   npx tsx scripts/check-rls-status.ts\n');
console.log('2. Re-ejecutar integration tests:');
console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');
console.log('3. Si todo funciona, hacer commit:');
console.log('   git add .env .env.local');
console.log('   git commit -m "fix: update DATABASE_URL to use app_user without RLS bypass"');
console.log('   git push\n');

console.log('✅ Variables de entorno actualizadas correctamente!');
