#!/usr/bin/env npx tsx

/**
 * Script Automatizado: Crear app_user usando credenciales de postgres
 * 
 * Este script se conecta con el usuario postgres y crea el app_user
 * sin necesidad de acceso manual al Supabase Dashboard.
 * 
 * Uso:
 *   npx tsx scripts/create-app-user-with-postgres.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const APP_USER_PASSWORD = 'M1k1sB3ll.$';

async function createAppUser() {
  console.log('\n🔐 Creando app_user en Supabase (Automatizado)...\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Extraer credenciales de postgres desde DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('❌ ERROR: DATABASE_URL no encontrada en .env.local\n');
    return false;
  }

  // Parsear URL para obtener credenciales
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?|$)/);
  if (!urlMatch) {
    console.log('❌ ERROR: No se pudo parsear DATABASE_URL\n');
    return false;
  }

  const [, username, password, host, port, database] = urlMatch;

  console.log('📋 Configuración de Conexión:\n');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${database.split('?')[0]}`);
  console.log(`   Usuario: ${username}\n`);

  // Crear cliente de PostgreSQL directo (sin Prisma)
  const client = new Client({
    host,
    port: parseInt(port),
    database: database.split('?')[0],
    user: username,
    password: decodeURIComponent(password),
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Conectar
    console.log('1️⃣  Conectando a PostgreSQL...\n');
    await client.connect();
    console.log('✅ Conexión exitosa\n');

    // Verificar si app_user ya existe
    console.log('2️⃣  Verificando si app_user existe...\n');
    const checkUser = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (checkUser.rows.length > 0) {
      const user = checkUser.rows[0];
      console.log('ℹ️  app_user ya existe:\n');
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS está correctamente configurado (usebypassrls = false)\n');
        console.log('🎉 app_user está listo para usar!\n');
        return true;
      } else {
        console.log('⚠️  RLS bypass está activado. Necesita corrección manual.\n');
        console.log('💡 Ejecutar en Supabase Dashboard:\n');
        console.log('   ALTER USER app_user WITH NOBYPASSRLS;\n');
        return false;
      }
    }

    console.log('❌ app_user no existe. Creando...\n');

    // Crear usuario app_user
    console.log('3️⃣  Creando usuario app_user...\n');
    await client.query(
      `CREATE USER app_user WITH PASSWORD '${APP_USER_PASSWORD}'`
    );
    console.log('✅ Usuario app_user creado\n');

    // Dar permisos de conexión
    console.log('4️⃣  Otorgando permisos de conexión...\n');
    await client.query(
      `GRANT CONNECT ON DATABASE postgres TO app_user`
    );
    console.log('✅ Permiso CONNECT otorgado\n');

    // Dar permisos en schema public
    console.log('5️⃣  Otorgando permisos en schema public...\n');
    await client.query(
      `GRANT USAGE ON SCHEMA public TO app_user`
    );
    console.log('✅ Permiso USAGE otorgado en schema public\n');

    // Dar permisos en todas las tablas
    console.log('6️⃣  Otorgando permisos en tablas...\n');
    await client.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user`
    );
    console.log('✅ Permisos SELECT, INSERT, UPDATE, DELETE otorgados\n');

    // Dar permisos en secuencias
    console.log('7️⃣  Otorgando permisos en secuencias...\n');
    await client.query(
      `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user`
    );
    console.log('✅ Permiso USAGE otorgado en secuencias\n');

    // Dar permisos en funciones
    console.log('8️⃣  Otorgando permisos en funciones...\n');
    await client.query(
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user`
    );
    console.log('✅ Permiso EXECUTE otorgado en funciones\n');

    // Verificar configuración
    console.log('9️⃣  Verificando configuración de app_user...\n');
    const verifyUser = await client.query(
      `SELECT usename, usebypassrls FROM pg_user WHERE usename = 'app_user'`
    );

    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      console.log('✅ app_user verificado:\n');
      console.log(`   Username: ${user.usename}`);
      console.log(`   RLS Bypass: ${user.usebypassrls}\n`);

      if (!user.usebypassrls) {
        console.log('✅ RLS está correctamente configurado!\n');
      } else {
        console.log('⚠️  RLS bypass está activado (inesperado)\n');
      }
    }

    // Verificar permisos
    console.log('🔟 Verificando permisos...\n');
    const permissions = await client.query(
      `SELECT grantee, privilege_type 
       FROM information_schema.role_table_grants 
       WHERE table_name = 'orders' AND grantee = 'app_user'
       ORDER BY privilege_type`
    );

    if (permissions.rows.length > 0) {
      console.log('✅ Permisos verificados:\n');
      permissions.rows.forEach((perm: any) => {
        console.log(`   ${perm.grantee}: ${perm.privilege_type}`);
      });
      console.log();
    } else {
      console.log('⚠️  No se encontraron permisos en tabla orders\n');
    }

    console.log('════════════════════════════════════════════════════════════\n');
    console.log('✅ app_user creado y configurado exitosamente!\n');
    console.log('📋 Credenciales:\n');
    console.log(`   Username: app_user`);
    console.log(`   Password: ${APP_USER_PASSWORD}`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: postgres\n`);

    console.log('🎯 Próximos pasos:\n');
    console.log('1. Actualizar .env.local y .env con credenciales de app_user:');
    console.log(`   npx tsx scripts/update-env-app-user.ts "${APP_USER_PASSWORD}"\n`);
    console.log('2. Verificar configuración:');
    console.log('   npx tsx scripts/check-app-user-status.ts\n');
    console.log('3. Ejecutar integration tests:');
    console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');

    return true;

  } catch (error: any) {
    console.log('❌ Error al crear app_user:\n');
    console.log(`   ${error.message}\n`);

    if (error.message.includes('already exists')) {
      console.log('ℹ️  app_user ya existe. Esto es normal.\n');
      console.log('🎯 Próximos pasos:\n');
      console.log('1. Verificar configuración:');
      console.log('   npx tsx scripts/check-app-user-status.ts\n');
      console.log('2. Ejecutar integration tests:');
      console.log('   npx tsx scripts/test-multi-tenant-integration.ts\n');
      return true;
    }

    if (error.message.includes('permission denied')) {
      console.log('🔧 Solución:\n');
      console.log('El usuario postgres no tiene permisos para crear usuarios.\n');
      console.log('Opciones:\n');
      console.log('1. Ejecutar script SQL manualmente en Supabase Dashboard');
      console.log('   Ver: scripts/setup-app-user-supabase.sql\n');
      console.log('2. Contactar al administrador de Supabase\n');
      return false;
    }

    console.log('🔧 Troubleshooting:\n');
    console.log('1. Verificar que DATABASE_URL en .env.local es correcta');
    console.log('2. Verificar que el usuario postgres tiene permisos');
    console.log('3. Verificar conectividad a Supabase\n');

    return false;

  } finally {
    await client.end();
  }
}

// Ejecutar
createAppUser()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
