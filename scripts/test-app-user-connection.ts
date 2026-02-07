#!/usr/bin/env npx tsx

/**
 * Test de Conexión Directa con app_user
 * 
 * Este script prueba la conexión directa con app_user
 * para diagnosticar problemas de autenticación.
 */

import { Client } from 'pg';

const APP_USER_PASSWORD = 'M1k1sB3ll.$';

async function testConnection() {
  console.log('\n🔐 Probando Conexión con app_user...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Configuración de conexión
  const config = {
    host: 'aws-1-sa-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'app_user',
    password: APP_USER_PASSWORD,
    ssl: { rejectUnauthorized: false }
  };

  console.log('📋 Configuración:\n');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
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

    // Verificar permisos
    console.log('3️⃣  Verificando permisos en tabla orders...\n');
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
    console.log('4️⃣  Probando query simple...\n');
    const testQuery = await client.query('SELECT COUNT(*) as count FROM orders');
    console.log(`✅ Query exitosa: ${testQuery.rows[0].count} órdenes en la base de datos\n`);

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ TODAS LAS PRUEBAS PASARON!\n');
    console.log('🎉 app_user está correctamente configurado y funcionando\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error de conexión:\n');
    console.log(`   ${error.message}\n`);

    if (error.message.includes('password authentication failed')) {
      console.log('🔧 Problema: Contraseña incorrecta\n');
      console.log('Soluciones:\n');
      console.log('1. Verificar que la contraseña en el script es correcta');
      console.log('2. Resetear contraseña de app_user en Supabase Dashboard:\n');
      console.log('   ALTER USER app_user WITH PASSWORD \'M1k1sB3ll.$\';\n');
    } else if (error.message.includes('Tenant or user not found')) {
      console.log('🔧 Problema: Usuario no existe o no tiene acceso\n');
      console.log('Soluciones:\n');
      console.log('1. Crear app_user ejecutando:');
      console.log('   npx tsx scripts/create-app-user-with-postgres.ts\n');
      console.log('2. O ejecutar SQL en Supabase Dashboard:');
      console.log('   Ver: scripts/setup-app-user-supabase.sql\n');
    } else {
      console.log('🔧 Problema desconocido\n');
      console.log('Verificar:\n');
      console.log('1. Conectividad a Supabase');
      console.log('2. Configuración de firewall');
      console.log('3. Estado del servicio de Supabase\n');
    }

    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
