#!/usr/bin/env npx tsx

/**
 * Test de Conexión Directa con app_user (Puerto 5432)
 * 
 * Prueba la conexión directa sin pooler para diagnosticar
 * si el problema es con PgBouncer o con el usuario.
 */

import { Client } from 'pg';

const APP_USER_PASSWORD = 'M1k1sB3ll.$';

async function testDirectConnection() {
  console.log('\n🔐 Probando Conexión Directa con app_user (Puerto 5432)...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Configuración de conexión DIRECTA (sin pooler)
  const config = {
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 5432, // Puerto directo, NO pooler
    database: 'postgres',
    user: 'app_user',
    password: APP_USER_PASSWORD,
    ssl: { rejectUnauthorized: false }
  };

  console.log('📋 Configuración:\n');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port} (DIRECTO, sin pooler)`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Usuario: ${config.user}`);
  console.log(`   Password: ${'*'.repeat(APP_USER_PASSWORD.length)}\n`);

  const client = new Client(config);

  try {
    console.log('1️⃣  Intentando conectar...\n');
    await client.connect();
    console.log('✅ Conexión exitosa!\n');

    // Verificar usuario actual
    console.log('2️⃣  Verificando usuario actual...\n');
    const currentUser = await client.query('SELECT current_user, current_database()');
    console.log('✅ Usuario actual:\n');
    console.log(`   Usuario: ${currentUser.rows[0].current_user}`);
    console.log(`   Base de datos: ${currentUser.rows[0].current_database}\n`);

    // Verificar RLS bypass
    console.log('3️⃣  Verificando RLS bypass...\n');
    const rlsCheck = await client.query(`
      SELECT usename, usebypassrls 
      FROM pg_user 
      WHERE usename = 'app_user'
    `);

    if (rlsCheck.rows.length > 0) {
      const user = rlsCheck.rows[0];
      console.log('✅ Configuración de RLS:\n');
      console.log(`   Usuario: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS está correctamente configurado (bypass = false)\n');
      } else {
        console.log('⚠️  RLS bypass está activado (debería ser false)\n');
      }
    }

    // Verificar permisos
    console.log('4️⃣  Verificando permisos en tabla orders...\n');
    const permissions = await client.query(`
      SELECT privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_name = 'orders' AND grantee = 'app_user'
      ORDER BY privilege_type
    `);

    if (permissions.rows.length > 0) {
      console.log('✅ Permisos encontrados:\n');
      permissions.rows.forEach((row: any) => {
        console.log(`   - ${row.privilege_type}`);
      });
      console.log();
    } else {
      console.log('⚠️  No se encontraron permisos en tabla orders\n');
    }

    // Probar query simple
    console.log('5️⃣  Probando query simple...\n');
    const testQuery = await client.query('SELECT COUNT(*) as count FROM orders');
    console.log(`✅ Query exitosa: ${testQuery.rows[0].count} órdenes en la base de datos\n`);

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ CONEXIÓN DIRECTA FUNCIONA!\n');
    console.log('⚠️  PROBLEMA: El pooler (puerto 6543) no reconoce a app_user\n');
    console.log('🔧 SOLUCIÓN:\n');
    console.log('   Supabase necesita agregar app_user a la lista de usuarios del pooler.\n');
    console.log('   Esto solo se puede hacer desde el Dashboard de Supabase.\n');
    console.log('\n📋 OPCIONES:\n');
    console.log('   1. Usar conexión directa (puerto 5432) en producción');
    console.log('      - Menos eficiente pero funciona');
    console.log('      - Actualizar DATABASE_URL para usar puerto 5432\n');
    console.log('   2. Contactar soporte de Supabase para agregar app_user al pooler');
    console.log('      - Más eficiente');
    console.log('      - Requiere intervención de Supabase\n');
    console.log('   3. Usar usuario postgres (tiene acceso al pooler)');
    console.log('      - Funciona inmediatamente');
    console.log('      - Pero tiene RLS bypass activado\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error de conexión:\n');
    console.log(`   ${error.message}\n`);

    if (error.message.includes('password authentication failed')) {
      console.log('🔧 Problema: Contraseña incorrecta\n');
      console.log('Solución: Resetear contraseña de app_user:\n');
      console.log('   ALTER USER app_user WITH PASSWORD \'M1k1sB3ll.$\';\n');
    } else if (error.message.includes('Tenant or user not found')) {
      console.log('🔧 Problema: Usuario no existe\n');
      console.log('Solución: Crear app_user:\n');
      console.log('   npx tsx scripts/create-app-user-with-postgres.ts\n');
    }

    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
testDirectConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
