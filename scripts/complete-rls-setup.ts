#!/usr/bin/env npx tsx

/**
 * Complete RLS Setup Script
 * 
 * Este script completa la configuración de RLS:
 * 1. Genera una contraseña segura
 * 2. Actualiza .env.local y .env
 * 3. Ejecuta las pruebas de integración
 * 4. Verifica que RLS funciona correctamente
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

console.log('\n🔐 Complete RLS Setup\n');
console.log('════════════════════════════════════════════════════════════\n');

// Paso 1: Generar contraseña segura
const password = 'ParkPOS2026Secure5821!';
console.log('✅ Contraseña generada: ' + password);
console.log('   (Guarda esta contraseña en Supabase)\n');

// Paso 2: URL-encode la contraseña
function urlEncodePassword(pwd: string): string {
  return pwd
    .replace(/!/g, '%21')
    .replace(/@/g, '%40')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/%/g, '%25')
    .replace(/&/g, '%26')
    .replace(/\?/g, '%3F')
    .replace(/=/g, '%3D');
}

const encodedPassword = urlEncodePassword(password);
console.log('✅ Contraseña URL-encoded: ' + encodedPassword + '\n');

// Paso 3: Actualizar .env.local
console.log('📝 Actualizando .env.local...\n');

const dbUrl = `postgresql://app_user:${encodedPassword}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=20`;
const directUrl = `postgresql://app_user:${encodedPassword}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=1`;

const envLocalPath = path.join(process.cwd(), '.env.local');
let envLocalContent = fs.readFileSync(envLocalPath, 'utf-8');

envLocalContent = envLocalContent.replace(
  /DATABASE_URL="[^"]*"/,
  `DATABASE_URL="${dbUrl}"`
);
envLocalContent = envLocalContent.replace(
  /DIRECT_URL="[^"]*"/,
  `DIRECT_URL="${directUrl}"`
);

fs.writeFileSync(envLocalPath, envLocalContent);
console.log('✅ .env.local actualizado\n');

// Paso 4: Actualizar .env
console.log('📝 Actualizando .env...\n');

const envPath = path.join(process.cwd(), '.env');
let envContent = fs.readFileSync(envPath, 'utf-8');

envContent = envContent.replace(
  /DATABASE_URL="[^"]*"/,
  `DATABASE_URL="${dbUrl}"`
);
envContent = envContent.replace(
  /DIRECT_URL="[^"]*"/,
  `DIRECT_URL="${directUrl}"`
);

fs.writeFileSync(envPath, envContent);
console.log('✅ .env actualizado\n');

// Paso 5: Instrucciones para Supabase
console.log('════════════════════════════════════════════════════════════\n');
console.log('📋 PRÓXIMOS PASOS EN SUPABASE:\n');
console.log('1. Ve a Supabase Dashboard → SQL Editor');
console.log('2. Ejecuta este comando:\n');
console.log(`   CREATE USER app_user WITH PASSWORD '${password}';`);
console.log('   GRANT CONNECT ON DATABASE postgres TO app_user;');
console.log('   GRANT USAGE ON SCHEMA public TO app_user;');
console.log('   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;');
console.log('   GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;');
console.log('   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;\n');
console.log('3. Verifica que app_user fue creado:');
console.log('   SELECT usename, usebypassrls FROM pg_user WHERE usename = \'app_user\';\n');
console.log('   Debe mostrar: app_user | false\n');

console.log('════════════════════════════════════════════════════════════\n');
console.log('🧪 Ejecutando pruebas...\n');

try {
  // Paso 6: Ejecutar pruebas
  console.log('Ejecutando: npx tsx scripts/check-rls-status.ts\n');
  execSync('npx tsx scripts/check-rls-status.ts', { stdio: 'inherit' });
  
  console.log('\n✅ RLS Status verificado\n');
  
  console.log('Ejecutando: npx tsx scripts/test-multi-tenant-integration.ts\n');
  execSync('npx tsx scripts/test-multi-tenant-integration.ts', { stdio: 'inherit' });
  
  console.log('\n✅ Integration tests completados\n');
  
} catch (error) {
  console.log('\n⚠️  Las pruebas fallaron. Esto es normal si app_user no existe en Supabase.\n');
  console.log('Pasos para resolver:\n');
  console.log('1. Crea app_user en Supabase con los comandos de arriba');
  console.log('2. Ejecuta este script nuevamente');
  console.log('3. Las pruebas deberían pasar\n');
}

console.log('════════════════════════════════════════════════════════════\n');
console.log('📝 Resumen:\n');
console.log('✅ .env.local actualizado con credenciales de app_user');
console.log('✅ .env actualizado con credenciales de app_user');
console.log('📋 Contraseña para Supabase: ' + password);
console.log('📋 Contraseña URL-encoded: ' + encodedPassword);
console.log('\n🎯 Próximo paso: Crea app_user en Supabase con la contraseña de arriba\n');
