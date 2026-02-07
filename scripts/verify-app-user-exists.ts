#!/usr/bin/env npx tsx

/**
 * Verificar si app_user existe en PostgreSQL
 * 
 * Conecta con postgres para verificar si app_user fue creado correctamente.
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function verifyAppUser() {
  console.log('\n🔍 Verificando Existencia de app_user...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Extraer credenciales de postgres desde DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('❌ ERROR: DATABASE_URL no encontrada\n');
    return false;
  }

  // Cambiar temporalmente a postgres para verificar
  const postgresUrl = databaseUrl.replace('app_user', 'postgres.ncwdmdjnelopikpgrhty');
  const postgresPassword = 'M1k1sB3ll.$';

  const urlMatch = postgresUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?|$)/);
  if (!urlMatch) {
    console.log('❌ ERROR: No se pudo parsear URL\n');
    return false;
  }

  const [, username, , host, port, database] = urlMatch;

  console.log('📋 Conectando con usuario postgres para verificar...\n');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Usuario: ${username}\n`);

  const client = new Client({
    host,
    port: parseInt(port),
    database: database.split('?')[0],
    user: username,
    password: postgresPassword,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado con postgres\n');

    // Verificar si app_user existe
    console.log('1️⃣  Buscando usuario app_user...\n');
    const userCheck = await client.query(`
      SELECT 
        usename,
        usebypassrls,
        usecreatedb,
        usesuper,
        valuntil
      FROM pg_user 
      WHERE usename = 'app_user'
    `);

    if (userCheck.rows.length === 0) {
      console.log('❌ app_user NO EXISTE en PostgreSQL\n');
      console.log('🔧 Solución: Crear app_user ejecutando:\n');
      console.log('   npx tsx scripts/create-app-user-with-postgres.ts\n');
      return false;
    }

    const user = userCheck.rows[0];
    console.log('✅ app_user EXISTE en PostgreSQL:\n');
    console.log(`   Username: ${user.usename}`);
    console.log(`   RLS Bypass: ${user.usebypassrls}`);
    console.log(`   Can Create DB: ${user.usecreatedb}`);
    console.log(`   Is Superuser: ${user.usesuper}`);
    console.log(`   Valid Until: ${user.valuntil || 'Sin expiración'}\n`);

    // Verificar permisos
    console.log('2️⃣  Verificando permisos de app_user...\n');
    const permissions = await client.query(`
      SELECT 
        table_name,
        privilege_type
      FROM information_schema.role_table_grants 
      WHERE grantee = 'app_user'
      AND table_schema = 'public'
      ORDER BY table_name, privilege_type
      LIMIT 20
    `);

    if (permissions.rows.length > 0) {
      console.log(`✅ Permisos encontrados (mostrando primeros 20):\n`);
      const groupedPerms: Record<string, string[]> = {};
      permissions.rows.forEach((row: any) => {
        if (!groupedPerms[row.table_name]) {
          groupedPerms[row.table_name] = [];
        }
        groupedPerms[row.table_name].push(row.privilege_type);
      });

      Object.entries(groupedPerms).forEach(([table, perms]) => {
        console.log(`   ${table}: ${perms.join(', ')}`);
      });
      console.log();
    } else {
      console.log('⚠️  No se encontraron permisos para app_user\n');
    }

    // Verificar roles
    console.log('3️⃣  Verificando roles de app_user...\n');
    const roles = await client.query(`
      SELECT 
        rolname
      FROM pg_roles
      WHERE pg_has_role('app_user', oid, 'member')
    `);

    if (roles.rows.length > 0) {
      console.log('✅ Roles asignados:\n');
      roles.rows.forEach((row: any) => {
        console.log(`   - ${row.rolname}`);
      });
      console.log();
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('📊 DIAGNÓSTICO:\n');
    console.log('✅ app_user existe en PostgreSQL');
    console.log(`✅ RLS Bypass: ${user.usebypassrls ? 'ACTIVADO ⚠️' : 'DESACTIVADO ✅'}`);
    console.log(`✅ Permisos: ${permissions.rows.length > 0 ? 'CONFIGURADOS ✅' : 'FALTANTES ⚠️'}\n`);

    console.log('🔧 PROBLEMA IDENTIFICADO:\n');
    console.log('El usuario app_user existe en PostgreSQL, pero Supabase no lo reconoce');
    console.log('en su sistema de autenticación. Esto es porque Supabase usa un sistema');
    console.log('de autenticación propio que no reconoce usuarios creados directamente.\n');

    console.log('💡 SOLUCIONES:\n');
    console.log('1. OPCIÓN A: Usar postgres user (tiene acceso completo)');
    console.log('   - Ventaja: Funciona inmediatamente');
    console.log('   - Desventaja: Tiene RLS bypass activado\n');

    console.log('2. OPCIÓN B: Crear app_user en Supabase Dashboard');
    console.log('   - Ir a: https://app.supabase.com');
    console.log('   - Database → Roles → Create Role');
    console.log('   - Nombre: app_user');
    console.log('   - Password: M1k1sB3ll.$');
    console.log('   - Permisos: Sin RLS bypass\n');

    console.log('3. OPCIÓN C: Usar DIRECT_URL solo (puerto 5432)');
    console.log('   - Cambiar DATABASE_URL para usar puerto 5432');
    console.log('   - Menos eficiente pero puede funcionar\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error:\n');
    console.log(`   ${error.message}\n`);
    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
verifyAppUser()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
