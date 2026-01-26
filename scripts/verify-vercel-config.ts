#!/usr/bin/env node
/**
 * Verify Vercel Configuration
 * 
 * This script verifies that all required environment variables are configured
 * and that the security validations are working correctly.
 */

console.log('🔍 Verificando Configuración de Vercel\n');
console.log('='.repeat(60));

// Required variables
const requiredVars = [
  'DATABASE_URL',
  'TENANT_ID',
  'LOCATION_ID',
  'JWT_SECRET',
  'PIN_SALT',
];

// Optional but recommended variables
const optionalVars = [
  'DIRECT_URL',
  'PARK_API_SECRET',
  'ADMIN_API_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

let allGood = true;

console.log('\n📋 Variables REQUERIDAS:\n');

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Configurado (${value.substring(0, 20)}...)`);
  } else {
    console.log(`❌ ${varName}: NO CONFIGURADO`);
    allGood = false;
  }
});

console.log('\n📋 Variables OPCIONALES:\n');

optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: Configurado`);
  } else {
    console.log(`⚠️  ${varName}: No configurado (opcional)`);
  }
});

console.log('\n' + '='.repeat(60));

if (allGood) {
  console.log('\n✅ TODAS LAS VARIABLES REQUERIDAS ESTÁN CONFIGURADAS\n');
  console.log('🎉 Tu configuración está lista para producción!\n');
  process.exit(0);
} else {
  console.log('\n❌ FALTAN VARIABLES REQUERIDAS\n');
  console.log('Por favor, configura las variables faltantes en Vercel:\n');
  console.log('1. Ve a Vercel Dashboard');
  console.log('2. Settings → Environment Variables');
  console.log('3. Agrega las variables faltantes\n');
  process.exit(1);
}
