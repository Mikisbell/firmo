#!/usr/bin/env tsx

/**
 * Script: Verificar Estado de app_user
 * 
 * Verifica si el usuario app_user está configurado correctamente
 * y si las variables de entorno están actualizadas.
 * 
 * Uso: npx tsx scripts/check-app-user-status.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

async function checkAppUserStatus(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1. Check DATABASE_URL in .env.local
  console.log('\n🔍 Verificando variables de entorno...\n');
  
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');
  
  let envLocalContent = '';
  let envContent = '';
  
  try {
    envLocalContent = fs.readFileSync(envLocalPath, 'utf-8');
  } catch (error) {
    results.push({
      name: '.env.local',
      status: 'warning',
      message: 'Archivo .env.local no encontrado',
      details: 'Crear archivo .env.local con DATABASE_URL y DIRECT_URL',
    });
  }
  
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch (error) {
    results.push({
      name: '.env',
      status: 'warning',
      message: 'Archivo .env no encontrado',
      details: 'Crear archivo .env con DATABASE_URL y DIRECT_URL',
    });
  }

  // Check if DATABASE_URL uses app_user
  const databaseUrlMatch = envLocalContent.match(/DATABASE_URL="([^"]+)"/);
  const directUrlMatch = envLocalContent.match(/DIRECT_URL="([^"]+)"/);
  
  if (databaseUrlMatch) {
    const databaseUrl = databaseUrlMatch[1];
    if (databaseUrl.includes('app_user')) {
      results.push({
        name: 'DATABASE_URL (.env.local)',
        status: 'pass',
        message: 'Usa app_user ✅',
        details: databaseUrl.replace(/:[^@]+@/, ':***@'), // Hide password
      });
    } else if (databaseUrl.includes('postgres')) {
      results.push({
        name: 'DATABASE_URL (.env.local)',
        status: 'fail',
        message: 'Usa usuario postgres (con RLS bypass) ❌',
        details: 'Necesita cambiar a app_user',
      });
    }
  }
  
  if (directUrlMatch) {
    const directUrl = directUrlMatch[1];
    if (directUrl.includes('app_user')) {
      results.push({
        name: 'DIRECT_URL (.env.local)',
        status: 'pass',
        message: 'Usa app_user ✅',
        details: directUrl.replace(/:[^@]+@/, ':***@'), // Hide password
      });
    } else if (directUrl.includes('postgres')) {
      results.push({
        name: 'DIRECT_URL (.env.local)',
        status: 'fail',
        message: 'Usa usuario postgres (con RLS bypass) ❌',
        details: 'Necesita cambiar a app_user',
      });
    }
  }

  // 2. Check database connection
  console.log('🔍 Verificando conexión a base de datos...\n');
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.push({
      name: 'Conexión a BD',
      status: 'pass',
      message: 'Conexión exitosa ✅',
    });
  } catch (error: any) {
    results.push({
      name: 'Conexión a BD',
      status: 'fail',
      message: 'Error de conexión ❌',
      details: error.message,
    });
    return results; // Can't continue without connection
  }

  // 3. Check current user
  console.log('🔍 Verificando usuario actual...\n');
  
  try {
    const currentUser = await prisma.$queryRaw<Array<{ current_user: string }>>`
      SELECT current_user
    `;
    
    const username = currentUser[0]?.current_user;
    
    if (username === 'app_user') {
      results.push({
        name: 'Usuario Actual',
        status: 'pass',
        message: `Usuario: ${username} ✅`,
        details: 'Usuario correcto sin RLS bypass',
      });
    } else if (username === 'postgres') {
      results.push({
        name: 'Usuario Actual',
        status: 'fail',
        message: `Usuario: ${username} ❌`,
        details: 'Usuario postgres tiene RLS bypass activado',
      });
    } else {
      results.push({
        name: 'Usuario Actual',
        status: 'warning',
        message: `Usuario: ${username} ⚠️`,
        details: 'Usuario desconocido, verificar permisos',
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Usuario Actual',
      status: 'fail',
      message: 'Error al verificar usuario ❌',
      details: error.message,
    });
  }

  // 4. Check if app_user exists
  console.log('🔍 Verificando si app_user existe...\n');
  
  try {
    const userExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM pg_roles WHERE rolname = 'app_user'
      ) as exists
    `;
    
    if (userExists[0]?.exists) {
      results.push({
        name: 'Usuario app_user',
        status: 'pass',
        message: 'Usuario app_user existe ✅',
      });
      
      // Check if app_user has RLS bypass
      const bypassStatus = await prisma.$queryRaw<Array<{ usebypassrls: boolean }>>`
        SELECT usebypassrls 
        FROM pg_roles 
        WHERE rolname = 'app_user'
      `;
      
      const hasBypass = bypassStatus[0]?.usebypassrls;
      
      if (hasBypass === false) {
        results.push({
          name: 'RLS Bypass (app_user)',
          status: 'pass',
          message: 'RLS bypass desactivado ✅',
          details: 'app_user NO bypasea RLS (correcto)',
        });
      } else {
        results.push({
          name: 'RLS Bypass (app_user)',
          status: 'fail',
          message: 'RLS bypass activado ❌',
          details: 'app_user bypasea RLS (incorrecto)',
        });
      }
    } else {
      results.push({
        name: 'Usuario app_user',
        status: 'fail',
        message: 'Usuario app_user NO existe ❌',
        details: 'Ejecutar script: scripts/setup-app-user-supabase.sql',
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Usuario app_user',
      status: 'fail',
      message: 'Error al verificar app_user ❌',
      details: error.message,
    });
  }

  // 5. Check RLS status on tables
  console.log('🔍 Verificando estado de RLS en tablas...\n');
  
  try {
    const rlsStatus = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('employees', 'products', 'orders', 'tenant_settings', 'stations')
      ORDER BY tablename
    `;
    
    const allEnabled = rlsStatus.every(t => t.rowsecurity);
    
    if (allEnabled && rlsStatus.length > 0) {
      results.push({
        name: 'RLS en Tablas',
        status: 'pass',
        message: `RLS activado en ${rlsStatus.length} tablas ✅`,
        details: rlsStatus.map(t => `${t.tablename}: ${t.rowsecurity ? 'ON' : 'OFF'}`).join(', '),
      });
    } else {
      results.push({
        name: 'RLS en Tablas',
        status: 'warning',
        message: `RLS no activado en todas las tablas ⚠️`,
        details: rlsStatus.map(t => `${t.tablename}: ${t.rowsecurity ? 'ON' : 'OFF'}`).join(', '),
      });
    }
  } catch (error: any) {
    results.push({
      name: 'RLS en Tablas',
      status: 'fail',
      message: 'Error al verificar RLS ❌',
      details: error.message,
    });
  }

  return results;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔐 Verificación de Estado de app_user                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = await checkAppUserStatus();

  console.log('\n📊 RESULTADOS:\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Detalles: ${result.details}`);
    }
    console.log('');

    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') failCount++;
    else warningCount++;
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`✅ Pasadas: ${passCount}`);
  console.log(`❌ Fallidas: ${failCount}`);
  console.log(`⚠️  Advertencias: ${warningCount}`);
  console.log('');

  // Recommendations
  if (failCount > 0) {
    console.log('🔧 ACCIONES RECOMENDADAS:\n');
    
    const hasAppUserFail = results.some(r => r.name === 'Usuario app_user' && r.status === 'fail');
    const hasEnvFail = results.some(r => r.name.includes('DATABASE_URL') && r.status === 'fail');
    
    if (hasAppUserFail) {
      console.log('1. Crear usuario app_user en Supabase:');
      console.log('   - Abrir Supabase Dashboard → SQL Editor');
      console.log('   - Ejecutar: scripts/setup-app-user-supabase.sql');
      console.log('   - Cambiar contraseña en el script antes de ejecutar');
      console.log('');
    }
    
    if (hasEnvFail) {
      console.log('2. Actualizar variables de entorno:');
      console.log('   - Editar .env.local y .env');
      console.log('   - Cambiar usuario de "postgres" a "app_user"');
      console.log('   - Actualizar contraseña con la del paso 1');
      console.log('   - Ejecutar: npx tsx scripts/update-env-app-user.ts "tu-contraseña"');
      console.log('');
    }
    
    console.log('3. Verificar nuevamente:');
    console.log('   npx tsx scripts/check-app-user-status.ts');
    console.log('');
    
    console.log('📚 Documentación completa:');
    console.log('   - RLS_SETUP_INSTRUCTIONS.md');
    console.log('   - RLS_RESOLUTION_SUMMARY.md');
    console.log('');
  } else if (warningCount > 0) {
    console.log('⚠️  Hay advertencias, pero el sistema debería funcionar.');
    console.log('   Revisar detalles arriba para más información.');
    console.log('');
  } else {
    console.log('🎉 ¡TODO CORRECTO!');
    console.log('   El usuario app_user está configurado correctamente.');
    console.log('   Los integration tests deberían pasar 10/10.');
    console.log('');
    console.log('   Ejecutar tests:');
    console.log('   npx tsx scripts/test-multi-tenant-integration.ts');
    console.log('');
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('\n❌ Error fatal:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  });
